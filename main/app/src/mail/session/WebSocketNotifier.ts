import * as Q from "q";
import { Session } from "./SessionManager";
import * as privfs from "privfs-client";
import {event, section} from "../../Types";
import { EventDispatcher } from "../../utils/EventDispatcher";
import { webUtils } from "../../Types";
import { SectionUtils, Conv2Section } from "../../mail/section";
import * as PmxApi from "privmx-server-api";
import * as RootLogger from "simplito-logger";
import { LocaleService, person } from "..";
import { PersonModel } from "../../app/common/voicechat/VoiceChatService";
import { CommonApplication } from "../../app/common/CommonApplication";
let Logger = RootLogger.get("privfs-mail-client.mail.WebSocketNotifier");


export class WebSocketNotifier {
    static readonly NOTIFICATION_TYPE_PKI_REVISION: string = "userPkiRevision";
    static readonly NOTIFICATION_TYPE_ONLINE_STATE: string = "onlineState";
    static readonly NOTIFICATION_TYPE_ROOM_STATE: string = "roomState";
    static readonly NOTIFICATION_TYPE_VIDEO_ROOM_STATE: string = "videoRoomState";
    
    notifier: privfs.rpc.NotifyService;
    connected: boolean = false;
    connectionCheckerInterval: NodeJS.Timer;
    reconnecting: boolean = false;
    cachedVoiceChatUsersDataMap: {[id: string]: string[]} = {};

    constructor(public eventDispatcher: EventDispatcher, public session: Session, public localeService: LocaleService, public app: CommonApplication) {}

    _notifyVoiceChatUsersChange(session: Session, users: string[], sectionId: string): void {
        this.showSystemNotification(session, sectionId, users);
        this.updateVoiceChatUsersCache(session, sectionId, users);
        this.eventDispatcher.dispatchEvent<event.VoiceChatUsersPresenceChangeEvent>({
            type: "voice-chat-users-presence-change",
            users: users,
            host: session.host,
            sectionId: sectionId,
            hostHash: session.hostHash,
        });
        
        let isConversation = SectionUtils.isConversationId(sectionId);
        
        this.eventDispatcher.dispatchEvent<event.ToggleSidebarVoiceChatActiveEvent>({
            type: "toggleSidebarVoiceChatActive",
            hostHash: session.hostHash,
            sectionId: isConversation ? null : sectionId,
            conversationSectionId: isConversation ? sectionId : null,
            active: (users as string[]).length > 0,
            users: WebSocketNotifier.getListeningPeople(session, sectionId, users)
        })

    }
    
    _notifyVideoChatUsersChange(session: Session, users: string[], sectionId: string): void {
        users = users.map(user => {
            if (user.indexOf("#") < 0) {
                return `${user}#${session.host}`;
            }
            return user;
        })
        this.app.videoConferencesService.polling.update(session, sectionId, users);
    }

    getContext(session: Session, sectionId: string): string {
        let conv2Id: string = null;
        if (sectionId.indexOf("usergroup") >= 0) {
            session.conv2Service.collection.list.forEach(x => {
                if (x.section && x.section.getId() == sectionId) {
                    conv2Id = x.id;
                    return;
                }
            });
            return conv2Id;
        }
        else {
            return "section:" + sectionId;

        }
    }

    showSystemNotification(session: Session, sectionId: string, users: string[]) {
        let recentUsers = this.getVoiceChatCachedUsers(session, sectionId);
        let joinedUsers = users.filter(x => !recentUsers.includes(x) && x != session.sectionManager.identity.user)
        let leftUsers = recentUsers.filter(x => !users.includes(x) && x != session.sectionManager.identity.user);

        if (joinedUsers.length > 0) {
            joinedUsers.forEach(user => {
                let event = this.createNotification(session, sectionId, user, true);
                this.eventDispatcher.dispatchEvent<event.NotificationServiceEvent>(event);
            })
        }

        if (leftUsers.length > 0) {
            leftUsers.forEach(user => {
                let event = this.createNotification(session, sectionId, user, false);
                this.eventDispatcher.dispatchEvent<event.NotificationServiceEvent>(event);
            })
        }

    }

    static getPersonModel(person: person.Person, session: Session): PersonModel {
        let contactService = session.conv2Service.contactService;
        return {
            hashmail: person.getHashmail(),
            name: person.getName(),
            networkInfo: null
        };
    }


    createNotification(session: Session, sectionId: string, user: string, joined: boolean) {
        let userHashmail = new privfs.identity.Hashmail({user: user, host: this.session.host});
        let sectionName: string = null;
        let conv2Section: Conv2Section = null;
        if (sectionId.indexOf("usergroup") >= 0) {
            session.conv2Service.collection.list.forEach(x => {
                if (x.section && x.section.getId() == sectionId) {
                    conv2Section = x;
                    return;
                }
            });
        }

        let message: string = null;


        if (conv2Section) {
            let customName = session.conv2Service.sectionManager.customSectionNames.getCustomSectionName(conv2Section);
            if (customName) {
                message = this.localeService.i18n("voicechatNotification." + (joined ? "joined" : "left"), customName);
            }
            else
            if (conv2Section.isSingleContact()) {
                message = this.localeService.i18n("voicechatNotification." + (joined ? "joined" : "left") + ".private");
            }
            else {
                let persons = conv2Section.persons.map(x => WebSocketNotifier.getPersonModel(x, this.session));
                let names = persons.map(x => x.name || x.hashmail);
                sectionName = names.join(", ");
                message = this.localeService.i18n("voicechatNotification." + (joined ? "joined" : "left"), sectionName);
            }

        }
        else {
            sectionName = this.session.sectionManager.getSection(sectionId).getName();
            message = this.localeService.i18n("voicechatNotification." + (joined ? "joined" : "left"), sectionName);
        }

        let event: event.NotificationServiceEvent = {type: "notifyUser", options: {
            sender: userHashmail.hashmail,
            tray: false,
            sound: true,
            tooltip: true,
            tooltipOptions: {
                title: "",
                text: message,
                sender: userHashmail.hashmail,
                withAvatar: true,
                withUserName: true,

            },
            context: {
                module: section.NotificationModule.CHAT,
                sinkId: this.getContext(session, sectionId),
                hostHash: session.hostHash,
            },
        }};
        return event;
    }

    static getListeningPeople(session: Session, sectionId: string, users: string[]): webUtils.PersonSimpleModel[] {
        if (!users) {
            return [];
        }
        return users.map(user => {
            let person = session.conv2Service.personService.persons.get(user + "#" + session.host);
            return {
                name: person.getName(),
                description: person.getDescription(),
                hashmail: person.hashmail,
                present: person.isPresent()
            }
        })
    }

    updateVoiceChatUsersCache(session: Session, sectionId: string, users: string[]): void {
        this.cachedVoiceChatUsersDataMap[session.hostHash + "-" + sectionId] = users;
    }

    getProperId(session: Session, id: string): string {
        if (!id) {
            return null;
        }
        if (id.indexOf("c2:") == 0) {
            let found = session.conv2Service.collection.find(x => x && x.id == id);
            if (found && found.section) {
                return found.section.getId();
            }
        }
        return id;
    }

    getVoiceChatCachedUsers(session: Session, sectionId: string): string[] {
        let id = this.getProperId(session, sectionId);
        return id && this.cachedVoiceChatUsersDataMap[session.hostHash + "-" + id] ? this.cachedVoiceChatUsersDataMap[session.hostHash + "-" + id] : [];
    }

    removeMyselfFromCache(session: Session, sectionId: string): void {
        let key = session.hostHash + "-" + this.getProperId(session, sectionId);
        if (key in this.cachedVoiceChatUsersDataMap) {
            let myself = this.session.sectionManager.identity.user;
            let idx = this.cachedVoiceChatUsersDataMap[key].indexOf(myself);
            if (idx > -1) {
                this.cachedVoiceChatUsersDataMap[key].splice(idx, 1);
            }
        }
    }

    private startReconnectLoop(): void {
        this.stopReconnectLoop();
        this.connectionCheckerInterval = setInterval(() => {
            this.reconnect()
        }, 5000);
    }

    private stopReconnectLoop(): void {
        if (this.connectionCheckerInterval) {
            clearInterval(this.connectionCheckerInterval);
            this.connectionCheckerInterval = null;
        }
    }

    async init(): Promise<void> {
        if (this.connected) {
            return;
        }
        this.reconnecting = true;
        this.startReconnectLoop();

        const gateway = await this.session.mailClientApi.privmxRegistry.getGateway();
        try {
            const notifier = await gateway.rpc.createWebSocketNotifier(
                this.onSocketNotification.bind(this),
                this.onSocketDisconnect.bind(this)
            );  
            this.notifier = notifier;
            this.connected = true;
            this.reconnecting = false;
            this.refreshUsersPresence();
            Logger.info("connected");
            this.stopReconnectLoop();
        }
        catch(e) {
            this.connected = false;
            this.reconnecting = false;
            Logger.info("WebSocket error", e);
            this.eventDispatcher.dispatchEvent<event.LostConnectionInWebSocketEvent>({
                type: "lost-connection-in-web-socket",
                hostHash: this.session.hostHash
            })
            this.startReconnectLoop();
        }
    }

    private onSocketNotification(role: string, data: any): void {
        if (role == WebSocketNotifier.NOTIFICATION_TYPE_PKI_REVISION) {
            let eData = <PmxApi.api.event.UserPkiRevisionEventData>data;
            let userHashmail = new privfs.identity.Hashmail({user: eData.username, host: this.session.host});
            this.session.conv2Service.personService.updatePkiRevision(userHashmail.hashmail, eData.pkiRevision);
        }
        else
        if (role == WebSocketNotifier.NOTIFICATION_TYPE_ONLINE_STATE) {
            let eData = <PmxApi.api.user.UsernameEx>data;
            let userHashmail = new privfs.identity.Hashmail({user: eData.username, host: this.session.host});
            this.session.conv2Service.personService.updateExtraInfo(userHashmail.hashmail, eData);
            this.eventDispatcher.dispatchEvent<event.UserPresenceChangeEvent>({
                type: "user-presence-change",
                hostHash: this.session.hostHash,
                host: this.session.host,
                role: role,
                data: eData
            });
        }
        else
        if (role == WebSocketNotifier.NOTIFICATION_TYPE_ROOM_STATE) {
            if (! this.app.serverConfigForUser.privmxStreamsEnabled) {
                return;
            }
            let eData = <PmxApi.api.event.RoomStateEventData>data;
            this._notifyVoiceChatUsersChange(this.session, eData.users, eData.sectionId);
        }
        else if (role == WebSocketNotifier.NOTIFICATION_TYPE_VIDEO_ROOM_STATE) {
            let eData = <PmxApi.api.video.RoomInfo>data;
            this._notifyVideoChatUsersChange(this.session, eData.users, eData.sectionId);
        }
        else
        if (role == "descriptorReleased" || role == "descriptorLocked" || role == "descriptorModified" || role == "descriptorDeleted"
        || role == "descriptorCreated" || role == "descriptorUpdated") {
            this.fireFileLockChangedEvent(role, data);
        }

    }

    private onSocketDisconnect(): void {
        Logger.info("websocket disconnected (in main)");
        this.connected = false;
        this.reconnecting = false;
        this.destroyNotifier();
        this.startReconnectLoop();
    }

    destroyNotifier(): void {
        this.notifier.rpc.disconnect();
        this.notifier.disconnect();
        this.notifier.onDisconnect = null;
        this.notifier.onNotification = null;
        clearTimeout(this.notifier.rpc.timer);
        this.notifier.rpc.timer = null;
        this.notifier.rpc.connection.onDisconnect = null;
        this.notifier.rpc.connection.onReceivedMessage = null;
        this.notifier.rpc.connection.ticketsManager.clearTickets();
        this.notifier.rpc.connection.ticketsManager.savedStates = null;
        this.notifier.rpc.connection.ticketsManager = null;
        this.notifier.rpc.connection = null;
        this.notifier.rpc = null;
        this.notifier = null;
    }

    fireFileLockChangedEvent(role: event.DescriptorLockEventRole, data: PmxApi.api.event.DescriptorCreatedEventData | PmxApi.api.event.DescriptorUpdatedEventData
            | PmxApi.api.event.DescriptorDeletedEventData | PmxApi.api.event.DescriptorReleasedEventData | PmxApi.api.event.DescriptorLockedEventData
        ) {
        
        let locked: boolean;
        let lockReleased: boolean;
        if (role == "descriptorCreated") {
            locked = (data as PmxApi.api.event.DescriptorCreatedEventData).locked;
        }
        else
        if (role == "descriptorLocked") {
            locked = true;
        }
        else
        if (role == "descriptorUpdated") {
            lockReleased = (data as PmxApi.api.event.DescriptorUpdatedEventData).lockReleased;
        }
        else
        if (role == "descriptorDeleted") {
            lockReleased = true;
        }
        else
        if (role == "descriptorReleased") {
            lockReleased = true;
        }

        
        this.eventDispatcher.dispatchEvent<event.FileLockChangedEvent>({
            type: "file-lock-changed",
            role: role,
            did: data.did,
            user: data.user,
            locked: locked,
            lockReleased: lockReleased
        })
    }

    async reconnect(): Promise<void> {
        if (this.reconnecting || this.connected) {
            if (this.connected) {
                Logger.info("already connected");
            }
            return;
        }
        Logger.info("reconnecting ...");
        return this.init();
    }

    closeConnection(): void {
        if (this.notifier) {
            this.notifier.disconnect();
            this.destroyNotifier();
        }
    }

    refreshUsersPresence(): void {
        this.eventDispatcher.dispatchEvent<event.RefreshUsersPresence>({type: "refresh-users-presence"});
    }
}