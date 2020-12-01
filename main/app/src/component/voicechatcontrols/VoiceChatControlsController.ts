import { ComponentController } from "../base/ComponentController";
import { CommonApplication } from "../../app/common/CommonApplication";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import * as Types from "../../Types";
import { Inject, Dependencies } from "../../utils/Decorators";
import { Conv2Service, Conv2Section, SectionService } from "../../mail/section";
import { Converter } from "../../utils";
import { SectionListController } from "../sectionlist/main";
import { Contact } from "../../mail/contact";
import { ComponentFactory } from "../main";
import { PersonsController } from "../persons/main";
import { VoiceChatUser, VoiceChatUserNetworkInfo } from "../../app/common/voicechat/VoiceChatService";
import { Session } from "../../mail/session/SessionManager";
import * as Q from "q";

export interface Model {
    isInVoiceChat: boolean;
    isTalking: boolean;
    listeningUsers: PersonModel[];
    conversationModel: Types.webUtils.ConversationModel;
    sectionModel: Types.webUtils.SectionListElementModel;
};

export interface PersonModel {
    hashmail: string;
    name: string;
    networkInfo: VoiceChatUserNetworkInfo;
}

@Dependencies(["persons"])
export class VoiceChatControlsController extends ComponentController {

    static textsPrefix: string = "component.voicechatcontrols.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    

    @Inject componentFactory: ComponentFactory;
    
    app: CommonApplication;
    parent: Types.app.IpcContainer;
    personsComponent: PersonsController;
    session: Session;
    currentSectionId: string;
    currentHostHash: string;
    loadingDefer: Q.Deferred<void>;

    constructor(
        parent: Types.app.IpcContainer,
        app: CommonApplication,
    ) {
        super(parent);
        this.ipcMode = true;
        this.app = app;
        this.loadingDefer = Q.defer<void>();
        this.session = this.app.voiceChatService.getActiveSession();

        this.app.addEventListener<Types.event.JoinedVoiceChatTalkingEvent>("joinedVoiceChat", event => {
            // this.session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
            this.setCurrentContext(event.hostHash, event.sectionId);
            this.refreshModel();
        });
        this.app.addEventListener<Types.event.LeftVoiceChatTalkingEvent>("leftVoiceChat", event => {
            // this.refreshModel();
            this.refreshModelIfInCurrentContext(event);
        });
        this.app.addEventListener<Types.event.StartedTalkingEvent>("startedTalking", event => {
            this.refreshModelIfInCurrentContext(event);
        });
        this.app.addEventListener<Types.event.StoppedTalkingEvent>("stoppedTalking", event => {
            this.refreshModelIfInCurrentContext(event);
        });
        this.app.addEventListener<Types.event.RefreshListeningUsersEvent>("refreshListeningUsers", event => {
            this.refreshModelIfInCurrentContext(event);
        });
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
    }
    
    setCurrentContext(hostHash: string, sectionId: string): void {
        this.currentHostHash = hostHash;
        this.currentSectionId = sectionId;
    }

    refreshModelIfInCurrentContext(event: Types.event.VoiceChatTalkingBaseEvent): void {
        if (event.hostHash == this.currentHostHash && event.sectionId == this.currentSectionId) {
            this.session = this.app.sessionManager.getSessionByHostHash(event.hostHash);
            this.refreshModel();    
        }
    }

    getModel(): Model {
        if (this.loadingDefer.promise) {
            this.loadingDefer.resolve();
        } 
        let isInVoiceChat = this.getIsInVoiceChat();
        let isTalking = this.getIsTalking();
        return {
            isInVoiceChat: isInVoiceChat,
            isTalking: isTalking,
            listeningUsers: isInVoiceChat ? this.app.voiceChatService.getLastSeenUsers().map(x => this.getPersonModel(x)) : [],
            conversationModel: this.session && isInVoiceChat && this.getActiveSection().isUserGroup() ? this.getConv2Model(this.session.conv2Service.collection.find(x => x.section == this.getActiveSection())) : null,
            sectionModel: this.session && isInVoiceChat && !this.getActiveSection().isUserGroup() ? SectionListController.convertSection(this.getActiveSection(), 0, 0, 0, true, false, false, Types.section.NotificationModule.CHAT, null, true) : null,
        };
    }
    
    refreshModel(): void {
        this.loadingDefer.promise.then(() => {
            this.callViewMethod("setModelStr", JSON.stringify(this.getModel()));
        })
    }
    
    getConv2Model(c2s: Conv2Section): Types.webUtils.ConversationModel {
        return Converter.convertConv2(c2s, 0, 0, 0, true, 0, false, false, false, null);
    }
    
    getPersonModel(user: VoiceChatUser): PersonModel {
        return {
            hashmail: user.contact.getHashmail(),
            name: user.contact.getDisplayName(),
            networkInfo: user.networkInfo,
        };
    }
    
    getSectionModel(ss: SectionService): Types.webUtils.SectionListElementModel {
        return SectionListController.convertSection(ss, 0, 0, 0, true, false, false, Types.section.NotificationModule.CHAT, null);
    }
    
    getIsInVoiceChat(): boolean {
        let ret = this.app.voiceChatService.isInVoiceChat();
        // console.log("isInVoiceChat", ret);
        return ret;
    }
    
    getIsTalking(): boolean {
        return this.app.voiceChatService.isTalking();
    }
    
    getActiveSection(): SectionService {
        return this.app.voiceChatService.getActiveSection();
    }
    
    onViewLeaveVoiceChat(): void {
        this.app.voiceChatService.leaveVoiceChat();
    }
    
    onViewRingTheBell(): void {
        this.app.voiceChatService.ringTheBell();
    }
    
    onViewToggleTalking(): void {
        if (this.app.voiceChatService.isTalking()) {
            this.app.voiceChatService.stopTalking();
        }
        else {
            this.app.voiceChatService.startTalking();
        }
    }
}
