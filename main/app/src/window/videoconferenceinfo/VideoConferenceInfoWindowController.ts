import { BaseWindowController } from "../base/BaseWindowController";
import { app, webUtils, section as sectionTypes } from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";
import { PersonsController } from "../../component/persons/main";
import { Conv2Section, SectionService } from "../../mail/section";
import { Converter } from "../../utils/Converter";
import { SectionListController } from "../../component/sectionlist/SectionListController";
import { BaseWindowManager } from "../../app/BaseWindowManager";
import { ContextType } from "../../app/common/contexthistory/Context";

export interface ConferenceData {
    sectionId: string;
    startedBy: {
        hashmail: string;
        displayName: string;
    };
    conferenceTitle: string | null;
}

export enum WindowType {
    VIDEO_CONFERENCE_STARTED = "videoConferenceStarted",
    GONG = "gong",
}

export interface Model extends ConferenceData {
    sectionModel: webUtils.SectionListElementModel | null;
    conversationModel: webUtils.ConversationModel | null;
    isOneOnOne: boolean;
    windowType: WindowType;
    isGong: boolean;
    gongMessage: string;
}

export interface Options extends ConferenceData {
    session: Session;
    sectionId: string;
    windowType: WindowType;
    gongMessage?: string;
}

interface PartialChatPlugin {
    tryJoinExistingVideoConference(session: Session, section: SectionService | null, conv2section: Conv2Section | null): Promise<void>;
}

export class VideoConferenceInfoWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.videoconferenceinfo.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    private options: Options;
    personsComponent: PersonsController;
    
    constructor(parent: app.WindowParent, options: Options) {
        super(parent, __filename, __dirname, null, null, "basic");
        this.ipcMode = true;
        this.options = options;
        const isGong = this.options.windowType == WindowType.GONG;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 360;
        this.openWindowOptions.height = (options.conferenceTitle || isGong) ? (isGong && this.isOneOnOne() ? 180 : 230) : 150;
        this.openWindowOptions.title = this.i18n("window.videoconferenceinfo.title." + (isGong ? "gong" : "newVideo"));
        this.openWindowOptions.icon = isGong ? "fa fa-bell" : "privmx-icon privmx-icon-videocall";
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.maximizable = false;
        this.openWindowOptions.alwaysOnTop = true;
        
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
    }
    
    async init(): Promise<void> {
        const origPos = this.nwin.getPosition();
        await this.loadWindowState(true);
        const newPos = this.nwin.getPosition();
        
        // Center if the window is less than 200px from it's centered position
        if (origPos.x != newPos.x && origPos.y != newPos.y && Math.pow(newPos.x - origPos.x, 2) + Math.pow(newPos.y - origPos.y, 2) < 200 * 200) {
            this.nwin.setPosition(origPos.x, origPos.y);
        }
    }
    
    getModel(): Model {
        return {
            sectionId: this.options.sectionId + "/"+this.app.identity.hashmail,
            startedBy: {
                displayName: this.options.startedBy.displayName,
                hashmail: this.options.startedBy.hashmail,
            },
            conferenceTitle: this.options.conferenceTitle,
            sectionModel: this.options.sectionId ? this.getSectionModel(this.options.sectionId) : null,
            conversationModel: this.options.sectionId ? this.getConversationModel(this.options.sectionId) : null,
            isOneOnOne: this.isOneOnOne(),
            windowType: this.options.windowType,
            isGong: this.options.windowType == WindowType.GONG,
            gongMessage: this.options.gongMessage,
        };
    }
    
    getSection(): SectionService | null {
        if (!this.options.sectionId) {
            return null;
        }
        const section: SectionService = this.options.session.sectionManager.getSection(this.options.sectionId);
        return section;
    }
    
    getConv2Section(): Conv2Section | null {
        const section: SectionService = this.getSection();
        if (!section || !section.isUserGroup()) {
            return null;
        }
        const c2s: Conv2Section = this.options.session.conv2Service.collection.find(x => x.section == section);
        return c2s;
    }
    
    isOneOnOne(): boolean {
        const c2s: Conv2Section = this.getConv2Section();
        if (!c2s) {
            return false;
        }
        return c2s.users.length == 2;
    }
    
    onViewJoin(): void {
        const chatPlugin: PartialChatPlugin = this.app.getComponent("chat-plugin");
        const section = this.options.sectionId ? this.options.session.sectionManager.getSection(this.options.sectionId) : null;
        const conv2section = this.options.sectionId ? this.options.session.conv2Service.collection.find(x => x.section == section) : null;
        chatPlugin.tryJoinExistingVideoConference(this.options.session, section, conv2section);
        this.close();
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewShowChat(): void {
        const section = this.getSection();
        const c2s = this.getConv2Section();
        if (!section && !c2s) {
            return;
        }
        const isRemote = this.options.session.hostHash != this.app.sessionManager.getLocalSession().hostHash;
        let contextType: ContextType;
        if (isRemote) {
            contextType = c2s ? "remote-conversation" : "remote-section";
        }
        else {
            contextType = c2s ? "conversation" : "section";
        }
        const contextId: string = c2s ? c2s.id : section.getId();
        if (this.app.isElectronApp()) {
            const electronApp = this.app as any;
            electronApp.showMainWindow();
            electronApp.refreshTrayMenu();
        }
        this.app.router.navigateTo("chat", contextType, contextId, this.options.session.hostHash);
        if (this.options.windowType == WindowType.GONG) {
            this.close();
        }
    }
    
    async beforeClose(_force?: boolean): Promise<void> {
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        if (this.options.windowType == WindowType.VIDEO_CONFERENCE_STARTED) {
            await this.app.videoConferencesService.infoWindowsManager.onWindowClosed(this.options.session, this.options.sectionId);
        }
        await this.saveWindowState();
        this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
    }
    
    getSectionModel(sectionId: string): webUtils.SectionListElementModel | null {
        const section: SectionService = this.options.session.sectionManager.getSection(sectionId);
        if (section.isUserGroup()) {
            return null;
        }
        return SectionListController.convertSection(section, 0, 0, 0, true, false, false, sectionTypes.NotificationModule.CHAT, null, true);
    }
    
    getConversationModel(sectionId: string): webUtils.ConversationModel | null {
        const section: SectionService = this.options.session.sectionManager.getSection(sectionId);
        if (!section.isUserGroup()) {
            return null;
        }
        const c2s: Conv2Section = this.options.session.conv2Service.collection.find(x => x.section == section);
        return Converter.convertConv2(c2s, 0, 0, 0, true, 0, false, false, false, null);
    }
    
}
