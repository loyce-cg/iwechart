import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {FilteredCollection} from "../../utils/collection/FilteredCollection";
import {SortedCollection} from "../../utils/collection/SortedCollection";
import {TransformCollection} from "../../utils/collection/TransformCollection";
import {ExtListController} from "../extlist/ExtListController";
import {Conversation} from "../../mail/conversation/Conversation";
import {ConversationService} from "../../mail/conversation/ConversationService";
import * as Types from "../../Types";
import {Converter} from "../../utils/Converter";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import {ComponentFactory} from "../main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

@Dependencies(["extlist"])
export class ConversationListController extends ComponentController {
    
    static textsPrefix: string = "component.conversationList.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject componentFactory: ComponentFactory;
    @Inject conversationService: ConversationService;
    
    conversationCollection: WithActiveCollection<Conversation>;
    conversations: ExtListController<Types.webUtils.ConversationModel>;
    
    constructor(
        parent: Types.app.IpcContainer,
        public statsType: string
    ) {
        super(parent);
        let filterdeConversations = this.addComponent("filterdeConversations", new FilteredCollection(this.conversationService.getConversationCollection(), this.conversationFilter.bind(this)));
        let sortedConversations = this.addComponent("sortedConversations", new SortedCollection(filterdeConversations, ConversationListController.lastTimeConversationSorter));
        this.conversationCollection = this.addComponent("conversationCollection", new WithActiveCollection(sortedConversations));
        let convTransform = this.addComponent("convTransform", new TransformCollection<Types.webUtils.ConversationModel, Conversation>(this.conversationCollection, this.convertConversation.bind(this)))
        this.conversations = <ExtListController<Types.webUtils.ConversationModel>>this.addComponent("conversations", this.componentFactory.createComponent("extlist", [this, convTransform]));
        this.conversations.ipcMode = true;
        this.ipcMode = true;
    }
    
    conversationFilter(x: Conversation) {
        let hashmails = x.getHashmails();
        for (let i = 0; i < hashmails.length; i++) {
            if (hashmails[i].indexOf("chat-channel-") == 0 || hashmails[i].indexOf("server-admins-") == 0) {
                return false;
            }
        }
        if (x.persons.length == 1 && x.persons[0].hashmail == this.identity.hashmail) {
            return false;
        }
        for (let i = 0; i < x.persons.length; i++) {
            if (x.persons[i].isEmail() || x.persons[i].isAnonymous() || (x.persons[i].hasContact() && x.persons[i].contact.isEmail())) {
                return false;
            }
        }
        return true;
    }
    
    convertConversation(model: Conversation): Types.webUtils.ConversationModel {
        return Converter.convertConversation(model, this.statsType);
    }
    
    static lastTimeConversationSorter(a: Conversation, b: Conversation): number {
        return b.getLastTime() - a.getLastTime();
    }
    
    static typeConversationSorter(a: Conversation, b: Conversation): number {
        if (a.isSingleContact() != b.isSingleContact()) {
            return a.isSingleContact() ? -1 : 1;
        }
        if (!a.isSingleContact()) {
            return a.id.localeCompare(b.id);
        }
        let aPerson = a.getFirstPerson();
        let bPerson = b.getFirstPerson();
        if (aPerson.isStarred() != bPerson.isStarred()) {
            return aPerson.isStarred() ? -1 : 1;
        }
        let aText = aPerson.getName().toLowerCase();
        let bText = bPerson.getName().toLowerCase();
        return aText.localeCompare(bText);
    }
}