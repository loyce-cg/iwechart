import {app, component, mail, utils, window, Q, PrivmxException, privfs, Types} from "pmc-mail";
import {ChatPlugin} from "../../main/ChatPlugin";
import { i18n } from "./i18n/index";

export interface Model {
    data: any;
}

export class NoSectionsController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.chat.component.noSections.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    chatPlugin: ChatPlugin;
    
    isSectionSet: boolean = false;
    constructor(parent: window.base.BaseWindowController) {
        super(parent);
        
        this.ipcMode = true;
        this.chatPlugin = this.app.getComponent("chat-plugin");
      }
    
    init() {
    }
    
    
    
    getModel(): Model {
        return {data: null}
    }
}
