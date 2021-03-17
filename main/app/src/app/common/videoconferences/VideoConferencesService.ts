import * as privfs from "privfs-client";
import { CommonApplication } from "..";
import { videoconferences, section, session } from "../../../mail";
import * as Q from "q";
import { Types } from "../../../build/core";
import { JoinResult, VideoRoomAction, JoinCreateResult, JoinGetResult } from "../../../mail/videoconferences/VideoConferencesServiceApi";
import { VideoConferencesPolling } from "./VideoConferencesPolling";
import { RoomSecretData, RoomSecretEncryptor } from "./RoomSecretEncryptor";
import { InfoWindowsManager } from "./InfoWindowsManager";

export interface RoomMetadata {
    creatorHashmail: string;
    title: string;
}


export interface ConferenceInfo {
    jitsiDomain: string;
    id: string;
    password: string;
    encryptionKey: string;
    encryptionIV: string;
    tsVideoRoomId: string;
    roomMetadata: RoomMetadata;
}

export interface CreatorData {
    domain: string;
    roomName: string;
    tmpUser: {
        username: string;
        password: string;
    };
    token: string;
    conferencePassword: string;
}

export interface ConferenceCreatorResult {
    encryptionKey: string;
    encryptionIV: string;
    roomMetadata: RoomMetadata;
}

export type ConferenceCreator = (creatorData: CreatorData) => Q.Promise<ConferenceCreatorResult>;

export interface InAnyVideoConferenceStateChanged extends Types.event.Event {
    type: "in-any-video-conference-state-changed";
}

export interface ConferenceHandler {
    session: session.Session;
    section: section.SectionService;
}

export class VideoConferencesService {
    
    static readonly ACTIVITY_CONFIRMATION_INTERVAL: number = 10 * 1000;
    static readonly WAIT_TIMEOUT: number = 5 * 1000;
    static readonly MIN_TIME_BETWEEN_GONGS: number = 5 * 1000;
    
    protected _videoConferencesServiceApis: { [hostHash: string]: videoconferences.VideoConferencesServiceApi } = {};
    protected _activityConfirmationTimers: { [hostHash: string]: { [conferenceId: string]: number } } = {};
    protected _activeConferences: { [hostHash: string]: { [sectionId: string]: ConferenceInfo } } = {};
    protected _knownDomains: { [domain: string]: boolean } = {};
    protected _lastOwnGongTimes: { [id: string]: number } = {};
    polling: VideoConferencesPolling = new VideoConferencesPolling(this);
    infoWindowsManager: InfoWindowsManager = new InfoWindowsManager(this.app);
    
    constructor(
        public app: CommonApplication,
    ) {
        app.addEventListener<Types.event.BeforeLogoutPlugin>("beforelogout", () => {
            this.cleanupBeforeLogout();
        }, "main", "ethernal");
    }

    initAfterLogin(): void {
    }
    
    protected cleanupBeforeLogout(): void {
        for (let hostHash in this._activityConfirmationTimers) {
            for (let conferenceId in this._activityConfirmationTimers[hostHash]) {
                clearTimeout(this._activityConfirmationTimers[hostHash][conferenceId]);
            }
        }
        
        this._videoConferencesServiceApis = {};
        this._activityConfirmationTimers = {};
        this._activeConferences = {};
        this._knownDomains = {};
        this._lastOwnGongTimes = {};
        this.polling.clear();
        this.infoWindowsManager.clear();
    }
    
    joinConference(session: session.Session, section: section.SectionService, conferenceCreator: ConferenceCreator): Q.Promise<ConferenceInfo> {
        return this.joinConferenceByHandler({session, section}, conferenceCreator);
    }
    
    joinConferenceByHandler(handler: ConferenceHandler, conferenceCreator: ConferenceCreator): Q.Promise<ConferenceInfo> {
        if (this.hasConference(handler)) {
            return Q(this.getConferenceInfo(handler));
        }
        return Q().then(() => {
            return this.getApi(handler.session).joinToVideoRoom(handler.section);
        })
        .then(result => {
            if (result.action == VideoRoomAction.CREATE) {
                return this.createConference(handler, result, conferenceCreator);
            }
            else if (result.action == VideoRoomAction.JOIN) {
                return this.joinToExistingConference(handler, result);
            }
            throw new Error("Unsupported action " + (<JoinResult>result).action);
        })
        .then(conferenceInfo => {
            const hostHash = handler.session.hostHash;
            const sectionId = handler.section.getId();
            if (!(hostHash in this._activeConferences)) {
                this._activeConferences[hostHash] = {};
            }
            this._activeConferences[hostHash][sectionId] = conferenceInfo;
            this.triggerInAnyVideoConferenceStateChanged();
            return conferenceInfo;
        })
        .fail(e => {
            this.deleteConference(handler);
            this.triggerInAnyVideoConferenceStateChanged();
            throw e;
        });
    }
    
    leaveConference(session: session.Session, section: section.SectionService, conferenceId: string): Q.Promise<void> {
        this._stopActivityConfirmationTimer(session, conferenceId);
        let sectionId = section.getId();
        if (!sectionId || !this._activeConferences[session.hostHash] || !this._activeConferences[session.hostHash][sectionId]) {
            if (this._activeConferences[session.hostHash]) {
                delete this._activeConferences[session.hostHash][sectionId];
            }
            this.triggerInAnyVideoConferenceStateChanged();
            return Q().then(() => {
                return this.polling.pollNow(session).thenResolve(null);
            });
        }
        let conference = this._activeConferences[session.hostHash][sectionId];
        let isLastUser = this.getConferenceUsersCount(session, section) == 1;
        delete this._activeConferences[session.hostHash][sectionId];
        this.triggerInAnyVideoConferenceStateChanged();
        return this.getApi(session).disconnectFromVideoRoom(section, conference.tsVideoRoomId).then(() => {})
        .then(() => {
            return this.polling.pollNow(session).thenResolve(null);
        })
        .then(() => {
            if (isLastUser && this.getConferenceUsersCount(session, section) == 0) {
                section.getChatModule().sendVideoConferenceEndMessage(conferenceId);
            }
        });
    }
    
    getConferenceUsersCount(session: session.Session, section: section.SectionService): number {
        let results = this.polling.recentPollingResults[session.hostHash];
        let conferenceData = results ? results.conferencesData.find(x => x.sectionId == section.getId()) : null;
        return conferenceData ? conferenceData.users.length : 0;
    }
    
    getConferenceIdBySection(session: session.Session, section: section.SectionService): string {
        if (this._activeConferences[session.hostHash] && this._activeConferences[session.hostHash][section.getId()]) {
            return this._activeConferences[session.hostHash][section.getId()].id;
        }
        return null;
    }
    
    getConference(session: session.Session, conferenceId: string): ConferenceInfo {
        let sectionId = this.getSectionIdByConferenceId(session, conferenceId);
        if (!this._activeConferences[session.hostHash] || !this._activeConferences[session.hostHash][sectionId]) {
            return null;
        }
        return this._activeConferences[session.hostHash][sectionId];
    }
    
    getSectionIdByConferenceId(session: session.Session, conferenceId: string): string {
        if (this._activeConferences[session.hostHash]) {
            for (let sectionId in this._activeConferences[session.hostHash]) {
                if (this._activeConferences[session.hostHash][sectionId] && this._activeConferences[session.hostHash][sectionId].id == conferenceId) {
                    return sectionId;
                }
            }
        }
        return null;
    }
    
    isUserInAnyConference(): boolean {
        for (let hostHash in this._activeConferences) {
            let sessionConferences = this._activeConferences[hostHash];
            if (Object.keys(sessionConferences).length > 0) {
                return true;
            }
        }
        return false;
    }
    
    triggerInAnyVideoConferenceStateChanged(): void {
        try {
            this.app.dispatchEvent<InAnyVideoConferenceStateChanged>({
                type: "in-any-video-conference-state-changed",
            });
        }
        catch {}
    }
    
    isUrlInKnownDomain(url: string): boolean {
        let domain = url.split("://")[1].split("/")[0];
        return !!this._knownDomains[domain];
    }
    
    protected _generateConferencePassword(): string {
        return privfs.crypto.service.randomBytes(64).toString("hex");
    }
    
    protected _startActivityConfirmationTimer(session: session.Session, conferenceId: string): void {
        if (!(session.hostHash in this._activityConfirmationTimers)) {
            this._activityConfirmationTimers[session.hostHash] = {};
        }
        if (conferenceId in this._activityConfirmationTimers[session.hostHash]) {
            clearTimeout(this._activityConfirmationTimers[session.hostHash][conferenceId]);
        }
        let conference = this.getConference(session, conferenceId);
        if (!conference) {
            return;
        }
        this._confirmActivity(session, conferenceId).then(() => {
            this._activityConfirmationTimers[session.hostHash][conferenceId] = <any>setTimeout(() => {
                if (this._activityConfirmationTimers[session.hostHash] && (conferenceId in this._activityConfirmationTimers[session.hostHash])) {
                    this._startActivityConfirmationTimer(session, conferenceId);
                }
            }, VideoConferencesService.ACTIVITY_CONFIRMATION_INTERVAL);
        });
    }
    
    protected _stopActivityConfirmationTimer(session: session.Session, conferenceId: string): void {
        if (this._activityConfirmationTimers[session.hostHash] && (conferenceId in this._activityConfirmationTimers[session.hostHash])) {
            clearTimeout(this._activityConfirmationTimers[session.hostHash][conferenceId]);
            delete this._activityConfirmationTimers[session.hostHash][conferenceId];
            if (Object.keys(this._activityConfirmationTimers[session.hostHash]).length == 0) {
                delete this._activityConfirmationTimers[session.hostHash];
            }
        }
    }
    
    protected _confirmActivity(session: session.Session, conferenceId: string): Q.Promise<void> {
        let listener = this.app.getUIEventsListener();
        if (listener) {
            listener();
        }
        let section = session.sectionManager.getSection(this.getSectionIdByConferenceId(session, conferenceId));
        let conference = this.getConference(session, conferenceId);
        return this.getApi(session).commitVideoRoomAccess(section, conference.tsVideoRoomId).catch(() => {}).thenResolve(null);
    }
    
    getApi(session: session.Session): videoconferences.VideoConferencesServiceApi {
        return session.services.videoConferencesServiceApi;
    }
    
    getActiveVideoConferenceInfoForSection(hostHash: string, section: section.SectionService): Types.webUtils.ActiveVideoConferenceInfo {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let recentResult = this.polling.recentPollingResults[hostHash];
        if (recentResult && recentResult.conferencesData) {
            for (let conferenceData of recentResult.conferencesData) {
                if (conferenceData.sectionId == section.getId()) {
                    return {
                        users: conferenceData.users.map(u => this._getSimplePersonModel(session, u)).filter(u => !!u),
                    };
                }
            }
        }
        return null;
    }
    
    getActiveVideoConferenceInfoForConv2Section(hostHash: string, conv2section: section.Conv2Section): Types.webUtils.ActiveVideoConferenceInfo {
        let session = this.app.sessionManager.getSessionByHostHash(hostHash);
        let recentResult = this.polling.recentPollingResults[hostHash];
        if (recentResult && recentResult.conferencesData) {
            for (let conferenceData of recentResult.conferencesData) {
                if (conv2section.section && conferenceData.sectionId == conv2section.section.getId()) {
                    return {
                        users: conferenceData.users.map(u => this._getSimplePersonModel(session, u)).filter(u => !!u),
                    };
                }
            }
        }
        return null;
    }
    
    protected _getSimplePersonModel(session: session.Session, hashmail: string): Types.webUtils.PersonSimpleModel {
        if (!session.conv2Service || !session.conv2Service.personService) {
            return null;
        }
        let person = session.conv2Service.personService.getPerson(hashmail);
        if (!person) {
            return null;
        }
        return {
            description: person.getDescription(),
            hashmail: hashmail,
            name: person.getName() || hashmail,
            present: person.isPresent(),
        };
    }
    
    gong(session: session.Session, section: section.SectionService, message: string): void {
        const conferenceId = this.getConferenceIdBySection(session, section);
        const gongId = this.getGongId(session, section);
        const lastOwnGongTime = this._lastOwnGongTimes[gongId] || 0;
        const now = new Date().getTime();
        if (now - lastOwnGongTime < VideoConferencesService.MIN_TIME_BETWEEN_GONGS) {
            return;
        }
        this._lastOwnGongTimes[gongId] = now;
        section.getChatModule().sendVideoConferenceGongMessage(conferenceId ? conferenceId : null, message ? message : null);
    }
    
    getGongId(session: session.Session, section: section.SectionService): string {
        return `gong-${session.hostHash}-${section}`;
    }
    
    // =================
    //     private
    // =================
    
    createConference(handler: ConferenceHandler, result: JoinCreateResult, conferenceCreator: ConferenceCreator): Q.Promise<ConferenceInfo> {
        return Q().then(() => {
            this.markDomainAsKnown(result.domain);
            return this.invokeConferenceCreator(result, conferenceCreator);
        })
        .then(roomSecretData => {
            return Q().then(() => {
                return RoomSecretEncryptor.encryptWithSectionKey(roomSecretData, handler.section);
            })
            .then(roomSecret => {
                return this.getApi(handler.session).switchVideoRoomState(handler.section, roomSecret, result.token);
            })
            .then(switchResult => {
                const conferenceInfo = this.createConferenceInfo(roomSecretData, switchResult.tsVideoRoomId);
                this.saveConference(handler, conferenceInfo);
                handler.section.getChatModule().sendVideoConferenceStartMessage(conferenceInfo.id, roomSecretData.metadata.title);
                this._startActivityConfirmationTimer(handler.session, conferenceInfo.id);
                return this.polling.pollNow(handler.session).thenResolve(conferenceInfo);
            });
        });
    }
    
    invokeConferenceCreator(joinResult: JoinCreateResult, conferenceCreator: ConferenceCreator): Q.Promise<RoomSecretData> {
        const roomPassword = this._generateConferencePassword();
        const roomName = this.createRoomName();
        return Q().then(() => {
            return conferenceCreator({
                domain: joinResult.domain,
                conferencePassword: roomPassword,
                tmpUser: joinResult.tmpUser,
                roomName: roomName,
                token: joinResult.token
            });
        })
        .then(creatorResult => {
            const roomSecretData: RoomSecretData = {
                domain: joinResult.domain,
                encryptionIV: creatorResult.encryptionIV,
                encryptionKey: creatorResult.encryptionKey,
                roomName: roomName,
                roomPassword: roomPassword,
                metadata: creatorResult.roomMetadata,
            };
            return roomSecretData;
        });
    }
    
    joinToExistingConference(handler: ConferenceHandler, result: JoinGetResult) {
        return Q().then(() => {
            return RoomSecretEncryptor.decryptWithSectionKey(result.roomSecret, handler.section);
        })
        .then(roomSecretData => {
            this.markDomainAsKnown(roomSecretData.domain);
            const conferenceInfo = this.createConferenceInfo(roomSecretData, result.tsVideoRoomId);
            this.saveConference(handler, conferenceInfo);
            this._startActivityConfirmationTimer(handler.session, conferenceInfo.id);
            return conferenceInfo;
        });
    }
    
    getConferenceInfo(handler: ConferenceHandler): ConferenceInfo {
        return this.getConferencesMapForSession(handler.session)[handler.section.getId()];
    }
    
    hasConference(handler: ConferenceHandler): boolean {
        return handler.section.getId() in this.getConferencesMapForSession(handler.session);
    }
    
    getConferencesMapForSession(session: session.Session): {[sessionId: string]: ConferenceInfo} {
        const key = session.hostHash;
        if (!(key in this._activeConferences)) {
            this._activeConferences[key] = {};
        }
        return this._activeConferences[key];
    }
    
    deleteConference(handler: ConferenceHandler) {
        delete this.getConferencesMapForSession(handler.session)[handler.section.getId()];
    }
    
    clearConference(handler: ConferenceHandler) {
        this.getConferencesMapForSession(handler.session)[handler.section.getId()] = null;
    }
    
    saveConference(handler: ConferenceHandler, conferenceInfo: ConferenceInfo) {
        this.getConferencesMapForSession(handler.session)[handler.section.getId()] = conferenceInfo;
    }
    
    markDomainAsKnown(domain: string) {
        if (domain && !this._knownDomains[domain]) {
            this._knownDomains[domain] = true;
        }
    }
    
    createRoomName() {
        return privfs.crypto.service.randomBytes(64).toString("hex");
    }
    
    createConferenceInfo(roomSecretData: RoomSecretData, tsVideoRoomId: string): ConferenceInfo {
        const conferenceInfo: ConferenceInfo = {
            jitsiDomain: roomSecretData.domain,
            id: roomSecretData.roomName,
            password: roomSecretData.roomPassword,
            encryptionKey: roomSecretData.encryptionKey,
            encryptionIV: roomSecretData.encryptionIV,
            tsVideoRoomId: tsVideoRoomId,
            roomMetadata: roomSecretData.metadata,
        };
        return conferenceInfo;
    }
    
}
