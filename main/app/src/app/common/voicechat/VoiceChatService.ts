import { CommonApplication } from "..";
import * as Types from "../../../Types";
import { SectionService, Conv2Section } from "../../../mail/section";
import { Contact } from "../../../mail/contact";
import { Session } from "../../../mail/session/SessionManager";
import { VoiceChatServiceApi, section } from "../../../mail";
import * as Q from "q";
export interface VoiceChatUserNetworkInfo {
    ping: number;
}
export interface PersonModel {
    hashmail: string;
    name: string;
    networkInfo: VoiceChatUserNetworkInfo;
}

export interface VoiceChatUser {
    contact: Contact;
    networkInfo: VoiceChatUserNetworkInfo;
}

export type RoomConnectedUsersUpdater = () => Q.Promise<string[]>;

export class VoiceChatService {
    
    static readonly LISTENING_USERS_UPDATER_INTERVAL: number = 5000;
    static readonly SIDEBAR_BELL_DURATION: number = 5000;
    _session: Session;
    _activeSection: SectionService = null;
    _isTalking: boolean = false;
    _talkingActivityInterval: number;
    _listeningUsersUpdaterInterval: number;
    _voiceApi: VoiceChatServiceApi;
    roomConnectedUsersUpdater: RoomConnectedUsersUpdater;
    _lastSeenUsers: string[] = [];
    constructor(
        public app: CommonApplication, 
        ) {
    }

    initAfterLogin(): void {
        this.app.eventDispatcher.addEventListener<Types.event.VoiceChatUsersPresenceChangeEvent>("voice-chat-users-presence-change", event => {
            this._lastSeenUsers = event.users;
            let eventSession = this.app.sessionManager.getSession(event.host);
            let listeningUsers =  this.convertUsers(event.users, eventSession);

            this.app.eventDispatcher.dispatchEvent<Types.event.RefreshListeningUsersEvent>({
                type: "refreshListeningUsers",
                listeningUsers: listeningUsers,
                sectionId: event.sectionId,
                hostHash: event.hostHash,
            }); 
        })
    }

    joinVoiceChat(session: Session, section: SectionService, roomConnectedUsers: string[], roomConnectedUsersUpdater: RoomConnectedUsersUpdater): Q.Promise<void> {
        return Q().then(() => {
            return this.app.askForMicrophoneAccess()
        })
        .then(micAccessible => {
            if (! micAccessible) {
                this.app.msgBox.alert(this.app.localeService.i18n("voicechat.microphone.access.refused." + this.app.getSystemPlatfrom()));
                return;
            }
            this._session = session;
            this._activeSection = section;
            this._voiceApi = session.services.voiceChatServiceApi;
            this._lastSeenUsers = roomConnectedUsers;
            this.roomConnectedUsersUpdater = roomConnectedUsersUpdater;
            this.app.dispatchEvent<Types.event.JoinedVoiceChatTalkingEvent>({
                type: "joinedVoiceChat",
                sectionId: section.getId(),
                hostHash: session.hostHash,
            });
            // this.startListeningUsersUpdater();
            this.startTalking(true);
        })

        
    }
    
    leaveVoiceChat(): void {
        // console.log("VoiceChatService: on leaveVoiceChat");
        // if (this.isTalking()) {
        //     this.stopTalking();
        //     setTimeout(() => {
        //         this.leaveVoiceChat();
        //     }, 0);
        //     return;
        // }
        if (this.isTalking) {
            this.stopTalking(true);
        }
        this.roomConnectedUsersUpdater = null;
        let activeSection = this.getActiveSection();
        let activeSession = this.getActiveSession();

        activeSession.webSocketNotifier.removeMyselfFromCache(activeSession, activeSection.getId());

        this._activeSection = null;
        this._session = null;
        this.app.dispatchEvent<Types.event.LeftVoiceChatTalkingEvent>({
            type: "leftVoiceChat",
            sectionId: activeSection.getId(),
            hostHash: activeSession.hostHash,
        });
    }
    
    startTalking(noMuteCallEvent: boolean = false): void {
        // console.log("VoiceChatService: on startTalking");
        if (this.getActiveSection() && this.getActiveSession()) {
            this._isTalking = true;
            if (this._talkingActivityInterval) {
                clearInterval(this._talkingActivityInterval);
                this._talkingActivityInterval = null;
            }
            this._talkingActivityInterval = <any>setInterval(() => {
                this.app.getUIEventsListener()();
            }, 1000);
            if (! noMuteCallEvent) {
                this.app.dispatchEvent<Types.event.StartedTalkingEvent>({
                    type: "startedTalking",
                    sectionId: this.getActiveSection().getId(),
                    hostHash: this.getActiveSession().hostHash
                });        
            }
        }
    }
    
    stopTalking(noMuteCallEvent: boolean = false): void {
        // console.log("VoiceChatService: on stopTalking");
        this._isTalking = false;
        clearInterval(this._talkingActivityInterval);
        this._talkingActivityInterval = null;
        if (! noMuteCallEvent) {
            this.app.dispatchEvent<Types.event.StoppedTalkingEvent>({
                type: "stoppedTalking",
                sectionId: this.getActiveSection().getId(),
                hostHash: this.getActiveSession().hostHash
            });    
        }
    }
    
    ringTheBell(session?: Session, section?: SectionService, conv2Section?: Conv2Section): void {
        // console.log("VoiceChatService: on ringTheBell");
        if (!session) {
            session = this.getActiveSession();
        }
        if (!section) {
            section = this.getActiveSection();
        }
        this.app.dispatchEvent<Types.event.RingTheBellTalkingEvent>({
            type: "ringTheBell",
            sectionId: section.getId(),
            hostHash: session.hostHash,
        });
        
        let sectionId: string = undefined;
        let conversationId: string = undefined;
        if (section.isUserGroup()) {
            conversationId = conv2Section.id;
        }
        else {
            sectionId = section.getId();
        }
        this.toggleSidebarBellState(session, sectionId, conversationId, true);
    }

    onDingDong(session?: Session, section?: SectionService, conv2Section?: Conv2Section): void {
        // console.log("VoiceChatService: on ringTheBell");
        if (!session) {
            session = this.getActiveSession();
        }
        if (!section) {
            section = this.getActiveSection();
        }
        this.app.dispatchEvent<Types.event.DingDongTalkingEvent>({
            type: "dingDong",
            sectionId: section.getId(),
            hostHash: session.hostHash,
        });
        
        let sectionId: string = undefined;
        let conversationId: string = undefined;
        if (section.isUserGroup()) {
            let conv = session.conv2Service.collection.find(x => x.section && x.section.getId() == section.getId());
            if (conv) {
                conversationId = conv.id;
            }
        }
        else {
            sectionId = section.getId();
        }
        this.toggleSidebarBellState(session, sectionId, conversationId, true);
    }
    

    isInVoiceChat(): boolean {
        return !!this._activeSection;
    }

    isInCurrentVoiceChat(session: Session, sectionId: string): boolean {
        return this.isInVoiceChat() && this._activeSection.getId() == sectionId && this._session.hostHash == session.hostHash;
    }

    isVoiceChatActive(session: Session, sectionId: string): boolean {
        return !this.isInCurrentVoiceChat(session, sectionId) && session.webSocketNotifier.getVoiceChatCachedUsers(session, sectionId).length > 0;
    }
    
    isTalking(): boolean {
        return !!this._isTalking;
    }
    
    getActiveSection(): SectionService {
        return this._activeSection;
    }

    getActiveSession(): Session {
        return this._session;
    }
    
    convertUsers(users: string[], session: Session): VoiceChatUser[] {             
        return users.map(user => {
            let contact = session.conv2Service.contactService.getContactByHashmail(user + "#" + session.host);
            return {contact: contact, networkInfo: null}
        })
    }
    
    getLastSeenUsers(): VoiceChatUser[] {
        return this._session && this._session.webSocketNotifier ? this._session.webSocketNotifier.getVoiceChatCachedUsers(this._session, this._activeSection.getId()).map(user => {
            let contact = this._session.conv2Service.contactService.getContactByHashmail(user + "#" + this._session.host);
            return {contact: contact, networkInfo: null}
        }) : []
    }

    getPersonNetworkInfo(hashmail: string): VoiceChatUserNetworkInfo {
        // @todo
        return {
            ping: Math.round(Math.random() * (Math.random() > 0.9 ? 3500 : 350)),
        };
    }
    
    onServerConnectionLost(): void {
        // if (this.isTalking()) {
        //     this.stopTalking();
        // }
    }
    
    startListeningUsersUpdater(): void {
        this.app.eventDispatcher.addEventListener<Types.event.VoiceChatUsersPresenceChangeEvent>("voice-chat-users-presence-change-event", event => {
            this._lastSeenUsers = event.users;
            let listeningUsers =  this.getLastSeenUsers();
            this.app.eventDispatcher.dispatchEvent<Types.event.RefreshListeningUsersEvent>({
                type: "refreshListeningUsers",
                listeningUsers: listeningUsers,
                sectionId: event.sectionId,
                hostHash: this.getActiveSession().hostHash,
            }); 
    
        })

        // this._listeningUsersUpdaterInterval = <any>setInterval(() => {
        //     this.updateListeningUsers();
        // }, VoiceChatService.LISTENING_USERS_UPDATER_INTERVAL);
    }
    
    
    toggleSidebarBellState(session: Session, sectionId: string, conversationId: string, isRinging: boolean): void {
        this.app.dispatchEvent<Types.event.ToggleSidebarBellStateEvent>({
            type: "toggleSidebarBellState",
            conversationId: conversationId,
            sectionId: sectionId,
            hostHash: session.hostHash,
            isRinging: isRinging,
        });
        if (isRinging) {
            setTimeout(() => {
                this.toggleSidebarBellState(session, sectionId, conversationId, false);
            }, VoiceChatService.SIDEBAR_BELL_DURATION);
        }
    }

    updateVoiceChatSectionsStates(): Q.Promise<void> {
        return Q().then(() => {
            return this._voiceApi.getRoomsInfo().then(data => {
                let sections = (data.sections as {users: string[], sectionId: string, roomId: string}[]);
                if (sections.length > 0) {
                    sections.forEach(s => {
                        this._session.webSocketNotifier._notifyVoiceChatUsersChange(this._session, s.users, s.sectionId);
                    })
                }
            })            
        })

    }
    
}
