import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {SortedCollection} from "../../utils/collection/SortedCollection";
import {TransformCollection} from "../../utils/collection/TransformCollection";
import {ExtListController} from "../extlist/ExtListController";
import * as Types from "../../Types";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {SectionService} from "../../mail/section/SectionService";
import {ComponentFactory} from "../main";
import {Utils} from "../../utils/Utils";
import { UserPreferences } from "../../mail/UserPreferences";
import { FilteredCollection } from "../../utils/collection/FilteredCollection";
import { LocaleService, section } from "../../mail";
import { i18n } from "./i18n";
import { CommonApplication } from "../../app/common/CommonApplication";

export interface SectionListOptions {
    baseCollection: BaseCollection<SectionService>;
    unreadProvider: (section: SectionService) => number;
    elementsCountProvider?: (section: SectionService) => number;
    searchCountProvider: (section: SectionService) => number;
    searchAllSearchedProvider?: (section: SectionService) => boolean;
    withSpinnerProvider?: (section: SectionService) => boolean;
    sorter?: (a: SectionService, b: SectionService) => number;
    activeVoiceChatInfoProvider?: (section: SectionService) => Types.webUtils.ActiveVoiceChatInfo;
    moduleName: Types.section.NotificationModule;
    checkShowAllAvailSections?: boolean,
}

export interface SectionBeforeActivateEvent extends Types.event.Event<boolean> {
    type: "sectionbeforeactivate";
    section: SectionService;
}

export interface SectionActivatedEvent extends Types.event.Event {
    type: "sectionactivated";
    section: SectionService;
}

@Dependencies(["extlist"])
export class SectionListController extends ComponentController {
    
    static textsPrefix: string = "component.sectionList.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject componentFactory: ComponentFactory;
    @Inject userPreferences: UserPreferences;
    
    sortedCollection: SortedCollection<SectionService>;
    filteredCollection: FilteredCollection<SectionService>;
    sectionsCollection: WithActiveCollection<SectionService>;
    transformCollection: TransformCollection<Types.webUtils.SectionListElementModel, SectionService>;
    sections: ExtListController<Types.webUtils.SectionListElementModel>;
    showAllSections: boolean;
    pinnedSectionIds: string[] = null;
    ringingBellsInSectionIds: string[] = [];
    sectionsWithActiveVoiceChatMap: {[id: string]: string} = {};
    
    constructor(
        parent: Types.app.IpcContainer,
        public options: SectionListOptions
    ) {
        super(parent);
        this.refreshPinnedSectionIdsList();
        let sorter = Utils.makeMultiComparatorSorter(this.pinnedSorter.bind(this), this.hasSearchResultsSectionSorter.bind(this), this.options.sorter || SectionListController.nameSectionSorter);
        this.sortedCollection = this.addComponent("sortedCollection", new SortedCollection(this.options.baseCollection, sorter));
        this.filteredCollection = this.addComponent("filteredCollection", new FilteredCollection(this.sortedCollection, (x: SectionService) => {
            if (this.options.checkShowAllAvailSections) {
                if (this.showAllSections) {
                    return true;
                }
                else {
                    return (
                        (this.options.moduleName == Types.section.NotificationModule.CHAT && x.isChatModuleEnabled()) ||
                        (this.options.moduleName == Types.section.NotificationModule.NOTES2 && x.isFileModuleEnabled()) ||
                        (this.options.moduleName == Types.section.NotificationModule.TASKS && x.isKvdbModuleEnabled()) ||
                        (this.options.moduleName == Types.section.NotificationModule.CALENDAR && x.isCalendarModuleEnabled())
                    );
                }
            }
            else {
                return true;
            }
        }))
        this.sectionsCollection = this.addComponent("sectionsCollection", new WithActiveCollection(this.filteredCollection));
        this.registerChangeEvent(this.sectionsCollection.changeEvent, this.onSectionsCollectionChange);
        this.transformCollection = this.addComponent("transformCollection", new TransformCollection<Types.webUtils.SectionListElementModel, SectionService>(this.sectionsCollection, this.convertSection.bind(this)))
        this.sections = this.addComponent("sections", this.componentFactory.createComponent("extlist", [this, this.transformCollection]));
        this.sections.ipcMode = true;
        this.ipcMode = true;
        this.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            this.onUserPreferencesChange(event);
        }, this.getEventsReferer(), "normal");
        if (this.options.checkShowAllAvailSections) {
            this.userPreferences.load()
            .then(() => {
                this.showAllSections = this.userPreferences.getValue<boolean>("ui.showAllSections");
            });
        }
    }
    
    getUnread(section: SectionService): number {
        return this.options.unreadProvider ? this.options.unreadProvider(section) : 0;
    }
    
    getElementsCount(section: SectionService): number {
        return this.options.elementsCountProvider ? this.options.elementsCountProvider(section) : null;
    }
    
    getSearchCount(section: SectionService): number {
        return this.options.searchCountProvider ? this.options.searchCountProvider(section) : 0;
    }
    
    getAllSearched(section: SectionService): boolean {
        return this.options.searchAllSearchedProvider ? this.options.searchAllSearchedProvider(section) : true;
    }
    
    getWithSpinner(section: SectionService): boolean {
        return this.options.withSpinnerProvider ? this.options.withSpinnerProvider(section) : false;
    }
    
    getIsPinned(section: SectionService): boolean {
        return this.pinnedSectionIds.indexOf(section.getId()) >= 0;
    }

    getActiveVoiceChatInfo(section: SectionService): Types.webUtils.ActiveVoiceChatInfo {
        return this.options.activeVoiceChatInfoProvider ? this.options.activeVoiceChatInfoProvider(section) : null;
    } 
    
    getIsBellRinging(section: SectionService): boolean {
        return this.ringingBellsInSectionIds.indexOf(section.getId()) >= 0;
    }
    
    getActiveVideoConferenceInfo(section: SectionService): Types.webUtils.ActiveVideoConferenceInfo {
        let hostHash = CommonApplication.instance.sessionManager.getLocalSession().hostHash;
        return CommonApplication.instance.videoConferencesService.getActiveVideoConferenceInfoForSection(hostHash, section);
    }
    
    convertSection(model: SectionService): Types.webUtils.SectionListElementModel {
        return SectionListController.convertSection(model, this.getUnread(model), this.getElementsCount(model), this.getSearchCount(model), this.getAllSearched(model), this.getWithSpinner(model), this.getIsPinned(model), this.options.moduleName, this.getActiveVoiceChatInfo(model), true, this.getIsBellRinging(model), this.getActiveVideoConferenceInfo(model));
    }
    
    static convertSection(model: SectionService, unread: number, elementsCount: number, searchCount: number, allSearched: boolean, withSpinner: boolean, isPinned: boolean, moduleName: Types.section.NotificationModule, activeVoiceChatInfo: Types.webUtils.ActiveVoiceChatInfo, fullSectionName: boolean = true, isBellRinging: boolean = false, activeVideoConferenceInfo: Types.webUtils.ActiveVideoConferenceInfo = null): Types.webUtils.SectionListElementModel {
        let parents: SectionService[] = [];
        let lastParent = model.getParent();
        while (lastParent) {
            parents.unshift(lastParent);
            lastParent = lastParent.getParent();
        }
        let breadcrumb = "";
        parents.forEach(p => {
            breadcrumb += p.getName() + " / ";
        });

        return {
            id: model.getId(),
            name: model.getName(),
            description: model.getDescription(),
            unread: unread,
            elementsCount: elementsCount,
            searchCount: searchCount,
            allSearched: allSearched,
            withSpinner: withSpinner,
            scope: model.getScope(),
            breadcrumb: fullSectionName ? breadcrumb : "",
            primary: model.sectionData.primary,
            openOnFirstLogin: model.secured.extraOptions ? model.secured.extraOptions.openOnFirstLogin : false,
            muted: model.userSettings.mutedModules[moduleName],
            disabled:  !(
                (moduleName == Types.section.NotificationModule.CHAT && model.isChatModuleEnabled()) ||
                (moduleName == Types.section.NotificationModule.NOTES2 && model.isFileModuleEnabled()) ||
                (moduleName == Types.section.NotificationModule.TASKS && model.isKvdbModuleEnabled()) ||
                (moduleName == Types.section.NotificationModule.CALENDAR && model.isCalendarModuleEnabled())
            ),
            pinned: isPinned,
            isBellRinging: isBellRinging,
            activeVoiceChatInfo: activeVoiceChatInfo,
            activeVideoConferenceInfo: activeVideoConferenceInfo,
        };
    }
    
    static nameSectionSorter(a: SectionService, b: SectionService): number {
        return a.getName().localeCompare(b.getName());
    }
    
    hasSearchResultsSectionSorter(a: SectionService, b: SectionService): number {
        let ax = (this.getSearchCount(a) > 0 ? 2 : !this.getAllSearched(a)) ? 1 : 0;
        let bx = (this.getSearchCount(b) > 0 ? 2 : !this.getAllSearched(b)) ? 1 : 0;
        return bx - ax;
    }
    
    pinnedSorter(a: SectionService, b: SectionService): number {
        let ap = this.getIsPinned(a) ? 1 : 0;
        let bp = this.getIsPinned(b) ? 1 : 0;
        return bp - ap;
    }
    
    onViewActivateSection(sectionId: string): void {
        let section = this.sectionsCollection.find(x => x.getId() == sectionId);
        if (section == null) {
            return;
        }
        this.setActive(section, true);
    }
    
    getActive(): SectionService {
        return this.sectionsCollection.getActive();
    }
    
    setActive(section: SectionService, dispatchBeforeEvent: boolean) {
        let result = true;
        if (dispatchBeforeEvent) {
            result = this.dispatchEventResult(<SectionBeforeActivateEvent>{
                type: "sectionbeforeactivate",
                section: section
            });
        }
        if (result !== false) {
            this.sectionsCollection.setActive(section);
        }
    }
    
    onSectionsCollectionChange(event: Types.utils.collection.CollectionEvent<SectionService>): void {
        if (event.type == "active" && event.newActive) {
            this.dispatchEvent<SectionActivatedEvent>({
                type: "sectionactivated",
                section: event.newActive.obj
            });
        }
        if (event.type == "update" && event.element.getDescantsAndMe().length > 1) {
            this.refresh();
        }
    }
    
    refresh() {
        this.transformCollection.rebuild();
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
        if (this.options.checkShowAllAvailSections) {
            let showAll = event.userPreferences.data.ui.showAllSections;
            if (showAll != this.showAllSections) {
                this.showAllSections = showAll;
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
        this.sectionsCollection.forEach(x => {
            if (!id || x.getId() == id) {
                states[x.getId()] = this.getWithSpinner(x);
            }
        });
        this.callViewMethod("updateSidebarSpinners", JSON.stringify(states));
    }
    
    onViewOpenSettings(sectionId: string): void {
        this.dispatchEvent<Types.event.OpenEditSectionDialogEvent>({
            type: "open-edit-section-dialog",
            sectionId: sectionId,
        });
    }
    
    onViewTogglePinned(sectionId: string, newIsPinned: boolean): void {
        let idx = this.pinnedSectionIds.indexOf(sectionId);
        if (idx >= 0) {
            this.pinnedSectionIds.splice(idx, 1);
        }
        if (newIsPinned) {
            this.pinnedSectionIds.push(sectionId);
        }
        this.userPreferences.setPinnedSectionIds(this.pinnedSectionIds);
        this.callViewMethod("setPinned", sectionId, newIsPinned);
        this.sortedCollection.rebuild();
    }
    
    refreshPinnedSectionIdsList(): void {
        this.pinnedSectionIds = this.userPreferences.getPinnedSectionIds();
    }
    
    toggleBellState(sectionId: string, isRinging: boolean): void {
        let idx = this.ringingBellsInSectionIds.indexOf(sectionId);
        let prevIsRinging = idx >= 0;
        if (isRinging != prevIsRinging) {
            if (isRinging) {
                this.ringingBellsInSectionIds.push(sectionId);
            }
            else {
                this.ringingBellsInSectionIds.splice(idx, 1);
            }
            this.callViewMethod("toggleBellState", sectionId, isRinging);
        }
    }
    
    toggleVoiceChatActive(sectionId: string, active: boolean, users: Types.webUtils.PersonSimpleModel[]): void {
        let usersStr = JSON.stringify(users);
        if (active && !(sectionId in this.sectionsWithActiveVoiceChatMap)) {
            this.sectionsWithActiveVoiceChatMap[sectionId] = usersStr;
        }
        else
        if (!active && (sectionId in this.sectionsWithActiveVoiceChatMap)) {
            delete this.sectionsWithActiveVoiceChatMap[sectionId];
        }
        this.callViewMethod("toggleVoiceChatActive", sectionId, active, usersStr);
    }

    refreshActiveVoiceChats() {
        for (let sectionId in this.sectionsWithActiveVoiceChatMap) {
            let usersStr = this.sectionsWithActiveVoiceChatMap[sectionId];
            this.callViewMethod("toggleVoiceChatActive", sectionId, true, usersStr);
        }
    }
    
}