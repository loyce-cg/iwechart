import {app, component, mail, utils, window, Q, PrivmxException, privfs, Types} from "pmc-mail";
import {ChatPlugin} from "../../main/ChatPlugin";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";

export interface Model {
    data: any;
}

export class PrivateConversationsController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.chat.component.privateConversations.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject hashmailResolver: mail.HashmailResolver;
    @Inject personService: mail.person.PersonService;
    @Inject sinkIndexManager: mail.SinkIndexManager;
    @Inject messageService: mail.MessageService;
    @Inject conv2Service: mail.section.Conv2Service;
    
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
