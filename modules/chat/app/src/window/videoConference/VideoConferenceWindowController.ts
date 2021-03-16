import {component, mail, privfs, utils, window, Types, Q, app} from "pmc-mail";
import {ChatMessagesController, MessagesFilterUpdater, ChatUpdateSearchStatsEvent, UpdateVoiceChatUsersEvent} from "../../component/chatmessages/ChatMessagesController";
import {ChatMessage} from "../../main/ChatMessage";
import {ChatType} from "../../main/Types";
import {ChatPlugin, ChatComponentFactory, ChatValidMessageTypeForUnreadChangeEvent, ChatValidMessageTypeForDisplayChangeEvent, GUISettings, RequestOpenChatEvent, UpdateChatSidebarSpinnersEvent, MarkedChatsAsReadEvent } from "../../main/ChatPlugin";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { PrivateConversationsController } from "../../component/privateconversations/PrivateConversationsController";
import { i18n } from "./i18n/index";
import { VideoConferenceController } from "../../component/videoconference/VideoConferenceController";


export interface Model {
}

@Dependencies(["videoconference"])
export class VideoConferenceWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.chat.window.videoconference.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    chatPlugin: ChatPlugin;
    componentFactory: ChatComponentFactory;
    personsComponent: component.persons.PersonsController;
    videoConference: VideoConferenceController;
    leftVideoConference: boolean = false;
    onLeaveVideoConferenceBound: (event: Types.event.LeaveVideoConferenceEvent) => void = this.onLeaveVideoConference.bind(this);
    closeDeferred: Q.Deferred<void> = Q.defer<void>();
    
    constructor(parentWindow: Types.app.WindowParent, public joinVideoConferenceEvent: Types.event.JoinVideoConferenceEvent) {
        super(parentWindow, __filename, __dirname, {
            isPublic: false
        });
        this.ipcMode = true;
        let screenSize = this.app.getScreenResolution();
        let minInitialWindowWidth = 900;
        let minInitialWindowHeight = 400;
        let maxInitialWindowWidth = 1800;
        let maxInitialWindowHeight = 800;
        let percentInitialWindowWidth = 0.8;
        let percentInitialWindowHeight = 0.8;
        let initialWindowWidth: number = Math.max(minInitialWindowWidth, Math.min(maxInitialWindowWidth, percentInitialWindowWidth * screenSize.width));
        let initialWindowHeight: number = Math.max(minInitialWindowHeight, Math.min(maxInitialWindowHeight, percentInitialWindowHeight * screenSize.height));
        this.openWindowOptions.width = Math.floor(initialWindowWidth);
        this.openWindowOptions.height = Math.floor(initialWindowHeight);
        this.openWindowOptions.electronPartition = app.ElectronPartitions.HTTPS_SECURE_CONTEXT;
        this.openWindowOptions.backgroundColor = "#1b1d1d";
        this.openWindowOptions.minWidth = 250;
        this.openWindowOptions.minHeight = 220;
        this.openWindowOptions.icon = "privmx-icon privmx-icon-videocall";
        this.chatPlugin = this.app.getComponent("chat-plugin");
        this.chatPlugin.currentVideoConferenceWindowController = this;
        this.setPluginViewAssets("chat");
        this.openWindowOptions.title = this.i18n("plugin.chat.window.videoconference.title");
        this.addViewScript({ path: "build/jitsi/lib-jitsi-meet.min.js", plugin: "chat" });
    }
    
    init(): Q.IWhenable<void> {
        return this.app.mailClientApi.checkLoginCore().then(() => {
            return this.app.mailClientApi.prepareSectionManager();
        })
        .then(() => {
            this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
            this.videoConference = this.addComponent("videoConference", this.componentFactory.createComponent("videoconference", [this, this.joinVideoConferenceEvent.roomMetadata]));
            
            this.bindEvent<Types.event.LeaveVideoConferenceEvent>(this.app, "leave-video-conference", this.onLeaveVideoConferenceBound);
        });
    }
    
    onViewLoad(): void {
        this.joinVideoConference(this.joinVideoConferenceEvent);
    }
    
    getModel(): Model {
        return {};
    }
    
    joinVideoConference(event: Types.event.JoinVideoConferenceEvent): Q.Promise<void> {
        let session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
        let section = event.section ? event.section : (event.conversation ? event.conversation.section : null);
        if (session && section) {
            return this.videoConference.connect(session, section, event.roomMetadata)
            .fail(e => {
                this.videoConference.disconnect();
            });
        }
        return Q();
    }
    
    leaveVideoConference(): Q.Promise<void> {
        return this.videoConference.disconnect();
    }
    
    onLeaveVideoConference(event: Types.event.LeaveVideoConferenceEvent): void {
        // console.log("@@@ onLeaveVideoConference")
        if (this.app) {
            this.unbindEvent<Types.event.LeaveVideoConferenceEvent>(this.app, "leave-video-conference", this.onLeaveVideoConferenceBound);
        }
        this.leftVideoConference = true;
        if (this.manager && this.manager.stateListeners) {
            this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
        }
        this.close();
    }
    
    beforeClose(_force?: boolean): Q.IWhenable<void> {
        // console.log("@@@ beforeClose")
        if (!this.leftVideoConference) {
            this.manager.stateChanged(app.BaseWindowManager.STATE_CLOSE_CANCELLED);
            return this.leaveVideoConference()
            .fin(() => {
                this.chatPlugin.currentVideoConferenceWindowController = null;
                this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
            });
        }
        else {
            this.chatPlugin.currentVideoConferenceWindowController = null;
            this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
        }
    }
    
    onClose(): void {
        // console.log("@@@ onClose")
        super.onClose();
        this.closeDeferred.resolve();
    }
    
}

