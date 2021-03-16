import { mail, window, Types, component } from "pmc-mail";
import { DesktopSharingSource } from "../../main/videoConference/jitsi/JitsiMeetScreenObtainer";
import { i18n } from "./i18n/index";

export interface ItemModel {
    icon?: string;
    label: string;
    thumbnail: string;
    sourceId: string;
    sourceType: string;
}

export interface TabModel {
    id: DesktopSharingSource;
    header: string;
    canShareDesktopAudio: boolean;
}

export interface Model {
    tabs: TabModel[];
}

export interface Model {
}

export class DesktopPickerController extends component.base.ComponentController {
    
    static textsPrefix: string = "plugin.chat.component.desktoppicker.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(public parent: window.base.WindowComponentController<window.base.BaseWindowController>) {
        super(parent);
        this.ipcMode = true;
    }
    
    init() {
    }
    
    getModel(): Model {
        return {
            tabs: [
                {
                    id: "screen",
                    header: this.i18n("plugin.chat.component.desktoppicker.tab.screen.label"),
                    canShareDesktopAudio: false,
                },
                {
                    id: "window",
                    header: this.i18n("plugin.chat.component.desktoppicker.tab.window.label"),
                    canShareDesktopAudio: false,
                },
            ],
        };
    }
    
    i18n(key: string, ...args: any[]): string {
        return this.parent.i18n(key, ...args);
    }
    
}
    