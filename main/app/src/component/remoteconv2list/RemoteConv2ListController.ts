import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {SortedCollection} from "../../utils/collection/SortedCollection";
import {TransformCollection} from "../../utils/collection/TransformCollection";
import {ExtListController} from "../extlist/ExtListController";
import {Conv2Section, Conv2Service} from "../../mail/section/Conv2Service";
import * as Types from "../../Types";
import {Converter} from "../../utils/Converter";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import {ComponentFactory} from "../main";
import {Utils} from "../../utils/Utils";
import { FilteredCollection } from "../../utils/collection";
import { LocaleService } from "../../mail";
import { UserPreferences } from "../../mail/UserPreferences";
import { i18n } from "./i18n";
import { BaseWindowController } from "../../window/base/main";
import { Conv2ListController, Conv2ListOptions } from "../conv2list/Conv2ListController";
import { Session } from "../../mail/session/SessionManager";

export interface RemoteConv2BeforeActivateEvent extends Types.event.Event<boolean> {
    type: "remoteconv2beforeactivate";
    conv2: Conv2Section;
    hostHash: string;
}

export interface RemoteConv2ActivatedEvent extends Types.event.Event {
    type: "remoteconv2activated";
    conv2: Conv2Section;
    hostHash: string;
}

export interface RemoteConv2ListOptions extends Conv2ListOptions {
    session: Session;
}

@Dependencies(["extlist"])
export class RemoteConv2ListController extends ComponentController {
    
    static textsPrefix: string = "component.remoteconv2list.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    // @Inject identity: privfs.identity.Identity;
    @Inject componentFactory: ComponentFactory;
    // @Inject conv2Service: Conv2Service;
    @Inject userPreferences: UserPreferences;
    session: Session;
    conv2Service: Conv2Service;
    identity: privfs.identity.Identity;

    filteredCollection: FilteredCollection<Conv2Section>;
    sortedCollection: SortedCollection<Conv2Section>;
    conversationCollection: WithActiveCollection<Conv2Section>;
    convTransform: TransformCollection<Types.webUtils.ConversationModel, Conv2Section>;
    conversations: ExtListController<Types.webUtils.ConversationModel>;
    pinnedSectionIds: string[] = null;
    protected onlineFirst: boolean = false;
    
    constructor(
        parent: Types.app.IpcContainer,
        public options: RemoteConv2ListOptions
    ) {
        super(parent);
    
        this.session = this.options.session;
    
        this.conv2Service = this.options.session.conv2Service;
        this.identity = this.options.session.sectionManager.identity;

        this.refreshPinnedSectionIdsList();

        this.onlineFirst = !!options.onlineFirst;

        let sorter = Utils.makeMultiComparatorSorter(this.hasSearchResultsSectionSorter.bind(this), this.pinnedSorter.bind(this), this.onlineFirstSorter.bind(this), this.isSingleContactConditionalSorter.bind(this), options.sorter || Conv2ListController.lastTimeConversationSorter);

        this.filteredCollection = this.addComponent("filteredCollection", new FilteredCollection(this.conv2Service.collection, (el) => {
            return this.filter(el);
        }));
        this.sortedCollection = this.addComponent("sortedCollection", new SortedCollection(this.filteredCollection, sorter));
        this.conversationCollection = this.addComponent("conversationCollection", new WithActiveCollection(this.sortedCollection));
        this.registerChangeEvent(this.conversationCollection.changeEvent, this.onConversationCollectionChange);

        this.convTransform = this.addComponent("convTransform", new TransformCollection<Types.webUtils.ConversationModel, Conv2Section>(this.conversationCollection, this.convertConversation.bind(this)))
        this.conversations = this.addComponent("conversations", this.componentFactory.createComponent("extlist", [this, this.convTransform]));
        this.conversations.ipcMode = true;
        this.ipcMode = true;

        this.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            this.onUserPreferencesChange(event);
        });
        this.conv2Service.sectionManager.customSectionNames.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            let customSectionNames = this.conv2Service.sectionManager.customSectionNames.getCustomSectionNames();
            let elemsToUpdate: Types.webUtils.ConversationModel[] = this.convTransform.list.filter(x => x && x.customName != customSectionNames[x.id]);
            if (elemsToUpdate.length > 0) {
                for (let el of elemsToUpdate) {
                    this.convTransform.triggerBaseUpdateAt(this.convTransform.indexOf(el));
                }
            }
        });        
    }
    
    
    getUnread(conv2: Conv2Section): number {
        return this.options.unreadProvider ? this.options.unreadProvider(conv2) : 0;
    }
    
    getUnmutedUnread(conv2: Conv2Section): number {
        return this.options.unmutedUnreadProvider ? this.options.unmutedUnreadProvider(conv2) : null;
    }
    
    getElementsCount(conv2: Conv2Section): number {
        return this.options.elementsCountProvider ? this.options.elementsCountProvider(conv2) : null;
    }
    
    getSearchCount(conv2: Conv2Section): number {
        return this.options.searchCountProvider ? this.options.searchCountProvider(conv2) : 0;
    }
    
    getAllSearched(conv2: Conv2Section): boolean {
        return this.options.searchAllSearchedProvider ? this.options.searchAllSearchedProvider(conv2) : true;
    }
    
    getWithSpinner(conv2: Conv2Section): boolean {
        return this.options.withSpinnerProvider ? this.options.withSpinnerProvider(conv2) : false;
    }
    
    getIsPinned(conv2: Conv2Section): boolean {
        return this.pinnedSectionIds.indexOf(conv2.id) >= 0;
    }
    
    convertConversation(model: Conv2Section): Types.webUtils.ConversationModel {
        return Converter.convertConv2(model, this.getUnread(model), this.getElementsCount(model), this.getSearchCount(model), this.getAllSearched(model), this.getUnmutedUnread(model), this.getWithSpinner(model), this.getIsPinned(model), true, null);
    }
    
    static lastTimeConversationSorter(a: Conv2Section, b: Conv2Section): number {
        return b.getLastTimeIgnoreSaveFileMessageType() - a.getLastTimeIgnoreSaveFileMessageType();
    }
    
    
    
    filter(el: Conv2Section): boolean {
        if (this.options.hideConversations && !el.isSingleContact()) {
            return false;
        }
        if (!el.isSingleContact() && el.users.indexOf(this.identity.user) == -1) {        
            return false;
        }
        
        let hasMessages: boolean = el.getLastTime() > 0;
        let contact = this.conv2Service.contactService.getContactByHashmail(this.identity.hashmail);
        let iAmBasicUser = contact && contact.basicUser;
        // if (el.isSingleContact() && !hasMessages && iAmBasicUser) {
        //     console.log("el", el);
        //     console.log("filter hit 3");   
 
        //     return false;
        // }

        // todo: do poprawy - wylaczone do testow sekcji remote
        // if (el.persons.length == 1) {
        //     let person = el.persons[0];
        //     let userExtraInfo = this.conv2Service.contactService.getUserExtraInfo(person.hashmail);
        //     if (userExtraInfo && (<any>userExtraInfo).lastSeenDate == null) {
        //         return false;
        //     }
        // }

        let allUsersDeleted: boolean = true;
        el.persons.forEach(person => {
            if (person.username != this.identity.user && el.conv2Service.contactService.deletedUsers.indexOf(person.username) == -1 ) {
                allUsersDeleted = false;
            }        
        });
        if (allUsersDeleted && !hasMessages) {
            // console.log("filter hit 4");   
 
            return false;
        }
        
        return true;
    }
    
    setOnlineFirst(onlineFirst: boolean) {
        if (this.onlineFirst == onlineFirst) {
            return;
        }
        this.onlineFirst = onlineFirst;
        this.sortedCollection.refresh();
    }
    
    pinnedSorter(a: Conv2Section, b: Conv2Section): number {
        let ap = this.getIsPinned(a) ? 1 : 0;
        let bp = this.getIsPinned(b) ? 1 : 0;
        return bp - ap;
    }
    
    onlineFirstSorter(a: Conv2Section, b: Conv2Section): number {
        if (!this.onlineFirst) {
            return 0;
        }
        return Converter.getOnlineValue(b) - Converter.getOnlineValue(a);
    }
    
    hasSearchResultsSectionSorter(a: Conv2Section, b: Conv2Section): number {
        let aHas = this.getSearchCount(a) > 0 ? 1 : 0;
        let bHas = this.getSearchCount(b) > 0 ? 1 : 0;
        return bHas - aHas;
    }
    
    isSingleContactConditionalSorter(a: Conv2Section, b: Conv2Section): number {
        // Extra condition: this sorter is enabled only when sorting by online
        if (!this.onlineFirst) {
            return 0;
        }
        let aIsSingleContact = a.isSingleContact() ? 1 : 0;
        let bIsSingleContact = b.isSingleContact() ? 1 : 0;
        return bIsSingleContact - aIsSingleContact;
    }
    
    onViewActivateConv2(conv2Id: string): void {
        let conv2 = this.conversationCollection.find(x => x.id == conv2Id);
        if (conv2 == null) {
            return;
        }
        this.setActive(conv2, true);
    }
    
    getActive(): Conv2Section {
        return this.conversationCollection.getActive();
    }
    
    
    onConversationCollectionChange(event: Types.utils.collection.CollectionEvent<Conv2Section>): void {
        if (event.type == "active" && event.newActive) {
            this.dispatchEvent<RemoteConv2ActivatedEvent>({
                type: "remoteconv2activated",
                conv2: event.newActive.obj,
                hostHash: this.session.hostHash
            });
        }
    }
    
    refresh() {
        this.convTransform.rebuild();
    }
    
    onUserPreferencesChange(event: Types.event.UserPreferencesChangeEvent) {
        let oldList = this.pinnedSectionIds;
        this.refreshPinnedSectionIdsList();
        let newList = this.pinnedSectionIds;
        let needsSorting: boolean = false;
        for (let sectionId of oldList) {
            if (newList.indexOf(sectionId) < 0) {
                //this.callViewMethod("setPinned", sectionId, false);
                needsSorting = true;
            }
        }
        for (let sectionId of newList) {
            if (oldList.indexOf(sectionId) < 0) {
                //this.callViewMethod("setPinned", sectionId, true);
                needsSorting = true;
            }
        }
        if (needsSorting) {
            this.sortedCollection.rebuild();
        }
        this.refresh();
    }
    
    updateSidebarSpinners(id: string): void {
        let states: { [id: string]: boolean } = {};
        this.conversationCollection.forEach(x => {
            if (!id || x.id == id) {
                states[x.id] = this.getWithSpinner(x);
            }
        });
        this.callViewMethod("updateSidebarSpinners", JSON.stringify(states));
    }

    
    setActive(conv2: Conv2Section, dispatchBeforeEvent: boolean) {
        // console.log("on remoteConv2 setActive");
        let result = true;
        if (dispatchBeforeEvent) {
            result = this.dispatchEventResult(<RemoteConv2BeforeActivateEvent>{
                type: "remoteconv2beforeactivate",
                conv2: conv2,
                hostHash: this.session.hostHash
            });
        }
        if (result !== false) {
            // console.log("on remoteConv2 result", result);
            this.conversationCollection.setActive(conv2);
        }
    }
    
    
    onViewOpenSettings(conv2Id: string): void {
        let parent: any = this.parent;
        while (parent != null && !(parent instanceof BaseWindowController)) {
            parent = parent.parent;
        }
        if (parent instanceof BaseWindowController) {
            let conv2Section = this.conv2Service.collection.find(x => x.id == conv2Id);
            let customName = (this.conv2Service.sectionManager.customSectionNames.getCustomSectionName(conv2Section) || "").trim();
            parent.prompt(parent.i18n("component.remoteconv2list.changeSectionNamePrompt.text"), customName).then(result => {
                if (result.result == "ok") {
                    let newCustomName = (result.value || "").trim();
                    if (customName != newCustomName) {
                        this.conv2Service.sectionManager.customSectionNames.setCustomSectionName(conv2Section, newCustomName.length == 0 ? null : newCustomName);
                    }
                }
            });
        }
    }
    
    refreshPinnedSectionIdsList(): void {
        this.pinnedSectionIds = this.userPreferences.getPinnedSectionIds();
    }
}