import { ComponentController } from "../base/ComponentController";
import { WithActiveCollection } from "../../utils/collection/WithActiveCollection";
import { SortedCollection } from "../../utils/collection/SortedCollection";
import { TransformCollection } from "../../utils/collection/TransformCollection";
import { ExtListController } from "../extlist/ExtListController";
import * as Types from "../../Types";
import * as privfs from "privfs-client";
import { Inject, Dependencies } from "../../utils/Decorators";
import { BaseCollection } from "../../utils/collection/BaseCollection";
import { SectionService } from "../../mail/section/SectionService";
import { ComponentFactory } from "../main";
import { Utils } from "../../utils/Utils";
import { UserPreferences } from "../../mail/UserPreferences";
import { FilteredCollection } from "../../utils/collection/FilteredCollection";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";
import { SectionListOptions } from "../sectionlist/SectionListController";

export interface RemoteSectionListOptions extends SectionListOptions {
    session: Session;
}

export interface RemoteSectionBeforeActivateEvent extends Types.event.Event<boolean> {
    type: "remotesectionbeforeactivate";
    section: SectionService;
    hostHash: string;
}

export interface RemoteSectionActivatedEvent extends Types.event.Event {
    type: "remotesectionactivated";
    section: SectionService;
    hostHash: string;
}

@Dependencies(["extlist"])
export class RemoteSectionListController extends ComponentController {

    static textsPrefix: string = "component.remoteSectionList.";

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

    constructor(
        parent: Types.app.IpcContainer,
        public options: RemoteSectionListOptions
    ) {
        super(parent);
        let sorter = Utils.makeMultiComparatorSorter(this.hasSearchResultsSectionSorter.bind(this), this.options.sorter || RemoteSectionListController.nameSectionSorter);
        this.sortedCollection = this.addComponent("sortedCollection", new SortedCollection(this.options.baseCollection, sorter));
        this.filteredCollection = this.addComponent("filteredCollection", new FilteredCollection(this.sortedCollection, (x: SectionService) => {
            if (x.isPrivateOrUserGroup() || !x.isVisible() || !x.hasAccess()) {
                return false;
            }
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
        });
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

    convertSection(model: SectionService): Types.webUtils.SectionListElementModel {
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
            unread: this.getUnread(model),
            elementsCount: this.getElementsCount(model),
            searchCount: this.getSearchCount(model),
            allSearched: this.getAllSearched(model),
            withSpinner: this.getWithSpinner(model),
            pinned: this.getIsPinned(model),
            scope: model.getScope(),
            breadcrumb: breadcrumb,
            primary: model.sectionData.primary,
            muted: this.userPreferences.isGloballyMuted() || model.userSettings.mutedModules[this.options.moduleName],
            disabled: !(
                (this.options.moduleName == Types.section.NotificationModule.CHAT && model.isChatModuleEnabled()) ||
                (this.options.moduleName == Types.section.NotificationModule.NOTES2 && model.isFileModuleEnabled()) ||
                (this.options.moduleName == Types.section.NotificationModule.TASKS && model.isKvdbModuleEnabled()) ||
                (this.options.moduleName == Types.section.NotificationModule.CALENDAR && model.isCalendarModuleEnabled())
            ),
            openOnFirstLogin: false
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
            result = this.dispatchEventResult(<RemoteSectionBeforeActivateEvent>{
                type: "remotesectionbeforeactivate",
                section: section,
                hostHash: this.options.session.hostHash
            });
        }
        if (result !== false) {
            this.sectionsCollection.setActive(section);
        }
    }

    onSectionsCollectionChange(event: Types.utils.collection.CollectionEvent<SectionService>): void {
        if (event.type == "active" && event.newActive) {
            this.dispatchEvent<RemoteSectionActivatedEvent>({
                type: "remotesectionactivated",
                section: event.newActive.obj,
                hostHash: this.options.session.hostHash
            });
        }
    }

    refresh() {
        this.transformCollection.rebuild();
    }

    onUserPreferencesChange(event: Types.event.UserPreferencesChangeEvent) {
        if (this.options.checkShowAllAvailSections) {
            let showAll = event.userPreferences.data.ui.showAllSections;
            if (showAll != this.showAllSections) {
                this.showAllSections = showAll;
                this.sortedCollection.rebuild();
            }
        }
        this.refresh();
    }

    getWithSpinner(section: SectionService): boolean {
        return this.options.withSpinnerProvider ? this.options.withSpinnerProvider(section) : false;
    }

    getIsPinned(section: SectionService): boolean {
        return false;
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
    
}