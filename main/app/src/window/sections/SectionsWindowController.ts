import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, utils, event} from "../../Types";
import { TreeController } from "../../component/tree/TreeController";
import { SectionEditWindowController, RemoveEvent, AddSectionEvent, SectionChangeLockEvent } from "../sectionedit/SectionEditWindowController";
import { SectionNewWindowController } from "../sectionnew/SectionNewWindowController";
import { SectionManager } from "../../mail/section/SectionManager";
import { SectionService, VirtualSectionService } from "../../mail/section/SectionService";
import { DockedWindow } from "../../app/common/window/DockedWindow";
import { MutableCollection } from "../../utils/collection/MutableCollection";
import { TransformCollection } from "../../utils/collection/TransformCollection";
import { WithActiveCollection } from "../../utils/collection/WithActiveCollection";
import { MergedCollection } from "../../utils/collection/MergedCollection";
import {Inject, Dependencies} from "../../utils/Decorators"
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { MsgBoxResult } from "../msgbox/MsgBoxWindowController";
import { BaseWindowManager } from "../../app";
import { SectionEntry, Model, State } from "./SectionUITypes";
export * from "./SectionUITypes";

@Dependencies(["tree"])
export class SectionsWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.sections.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static ROOT_ID = "virtual:root";
    static NOT_SELECTED = "not-selected";
    
    @Inject identityProvider: utils.IdentityProvider;
    sectionsTree: TreeController<SectionEntry>;
    sectionManager: SectionManager;
    sectionEdit: SectionEditWindowController;
    activeCollection: WithActiveCollection<SectionService>;
    activeSectionLock: boolean = false;
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    sectionsLimitReached: boolean = false;
    
    constructor(parent: app.WindowParent, public sectionId?: string) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 1000,
            height: 620,
            minWidth: 900,
            minHeight: 450,
            icon: "icon privmx-icon privmx-icon-logo",
            title: this.i18n("window.sections.title")
        };
        
        this.bindEvent<SectionChangeLockEvent>(this, "section-change-lock", this.onSectionChangeLock.bind(this));
        this.bindEvent<event.SectionsLimitReachedEvent>(this.app, "sectionsLimitReached", event => {
            this.sectionsLimitReached = event.reached;
            this.callViewMethod("setButtonsState", this.getActiveState());
        })
    }

    init(): Q.IWhenable<void> {
        let section: SectionService = null;
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getSectionManager();
        })
        .then(sectionManager => {
            this.sectionManager = sectionManager;
            return this.sectionManager.load();
        })
        .then(() => {
            return this.sectionManager.isSectionsLimitReached();
        })
        .then(limitReached => {
            this.sectionsLimitReached = limitReached;
            if (this.sectionId) {
                section = this.sectionManager.getSection(this.sectionId);
            }
            return this.app.ioc.create(SectionEditWindowController, [this, {
                manager: this.sectionManager,
                docked: true,
                empty: true,
                section: section ? section : undefined,
            }]);
        })
        .then(sectionEdit => {
            this.sectionEdit = this.addComponent("sectionEdit", sectionEdit);
            this.sectionEdit.addEventListener<RemoveEvent>("remove", event => {
                let newActive = this.activeCollection.find(x => x.getId() == event.parentId);
                if (newActive == null) {
                    newActive = this.activeCollection.find(x => x.getId() == SectionsWindowController.ROOT_ID);
                }
                this.setActiveCore(newActive);
                if (this.sectionManager) {
                    this.sectionManager.load();
                }
            });
            this.sectionEdit.addEventListener<AddSectionEvent>("add", event => {
                if (! event.section) {
                    return;
                }
                this.addSection(true);
            })
            
            let merged = new MergedCollection<SectionService>();
            merged.addCollection(new MutableCollection<SectionService>([new VirtualSectionService({
                id: SectionsWindowController.ROOT_ID,
                name: this.i18n("window.sections.rootName", this.identityProvider.getIdentity().host),
                editableMyBe: false,
                valid: true,
                canCreateSubsection: this.identityProvider.isAdmin()
            })]));
            merged.addCollection(this.sectionManager.managabledCollection);
            this.registerChangeEvent(merged.changeEvent, this.onCollectionChange);
            this.activeCollection = this.addComponent("activeCollection", new WithActiveCollection(merged));
            if (section) {
                this.activeCollection.setActive(section);
            }
            // this.activeCollection.setActive(this.activeCollection.find(x => x.getId() != SectionsWindowController.ROOT_ID));
            // this.activeCollection.setActive(this.activeCollection.get(0));
            let castCollection = this.addComponent("castCollection", new TransformCollection<SectionEntry, SectionService>(this.activeCollection, this.convertSection.bind(this)));
            this.sectionsTree = this.addComponent("sectionsTree", this.componentFactory.createComponent<SectionEntry>("tree", [
                this, SectionsWindowController.ROOT_ID, castCollection, this.getActiveId.bind(this)]));

            this.app.eventDispatcher.addEventListener<event.UserDeletedEvent>("user-deleted", event => {
                if (this.activeCollection.active != null) {
                    // this will refresh sectionEdit window if any user has been deleted
                    this.setActiveCore(this.activeCollection.getActive());
                }
            });
            if (section)
            this.setActiveCore(section);
        });
    }
    
    reopenWithParams(sectionId: string): void {
        let section = this.sectionManager.getSection(sectionId);
        if (section) {
            this.setActive(section);
        }
    }
    
    convertSection(section: SectionService): SectionEntry {
        let parents: SectionService[] = [];
        let lastParent = section.getParent();
        while (lastParent) {
            parents.unshift(lastParent);
            lastParent = lastParent.getParent();
        }
        let breadcrumb = "";
        parents.forEach(p => {
            breadcrumb += p.getName() + " / ";
        });
        
        let parent = section.getParent();
        let enabledModules: string[] = [];
        let availModules = this.sectionManager.getSupportedModules();
        availModules.forEach( x => {
            if (section.isModuleEnabled(x)) {
                enabledModules.push(x);
            }
        });
        
        return {
            id: section.getId(),
            parentId: parent ? parent.getId() : (section.getId() == SectionsWindowController.ROOT_ID ? null : SectionsWindowController.ROOT_ID),
            enabled: section.isValid(),
            visible: section.userSettings ? section.userSettings.visible : true,
            name: section.getName(),
            scope: section.getScope(),
            isRoot: section.getId() == SectionsWindowController.ROOT_ID,
            enabledModules: enabledModules,
            breadcrumb: breadcrumb
        };
    }
    
    getActiveId(): string {
        let active = this.activeCollection.getActive();
        return active ? active.getId() : null;
    }
    
    onViewLoad(): void {
        if (this.sectionEdit.nwin == null) {
            this.sectionEdit.openDocked(this.nwin, 1);
        }
        this.callViewMethod("openIframe", (<DockedWindow>this.sectionEdit.nwin).id, (<DockedWindow>this.sectionEdit.nwin).load);
        this.afterViewLoaded.resolve();
    }
    
    getModel(): Model {
        return {
            state: this.getActiveState(),
            server: this.identityProvider.getIdentity().host
        }
    }
        
    onViewClose(): void {
        this.close();
    }
    
    onViewSetActive(id: string) {
        let active = this.activeCollection.find(x => x.getId() == id);
        if (active == null) {
            return;
        }
        this.setActive(active);
    }

    setActive(active: SectionService): void {
        this.sectionEdit.isDirty().then(dirty => {
            if (dirty) {
                // this.activeSectionLock = true;
                this.fireUnsavedChangesAction().then(result => {
                    if (result.result == "yes") {
                        // this.activeSectionLock = false;
                        this.setActiveCore(active);
                    }
                });
            }
            else {
                this.setActiveCore(active);
            }
        });
    } 

    fireUnsavedChangesAction(): Q.Promise<MsgBoxResult> {
        return this.confirm(this.i18n("window.sections.unsavedChanges"));
    }
    
    setActiveCore(active: SectionService) {
        this.activeCollection.setActive(active);
        this.callViewMethod("setButtonsState", this.getActiveState());
        if (active != null && active.getId() != SectionsWindowController.ROOT_ID) {
            this.sectionEdit.setState(active, null, false);
        }
        else {
            this.sectionEdit.setState(null, null, true);
        }
    }
    
    getActiveState(): State {
        let active = this.activeCollection ? this.activeCollection.getActive(): null;
        return {
            canAdd: active ? active.canCreateSubsection() : this.identityProvider.isAdmin(),
            sectionsLimitReached: this.sectionsLimitReached,
            isAdmin: this.identityProvider.isAdmin()
        };
    }
    
    onViewRefresh() {
        this.sectionManager.load().fail(this.logError);
    }
    
    onViewAddSection(): void {
        this.addSection();
    }

    addSection(subSection?: boolean): void {
        let active = this.activeCollection.getActive();
        

        if ((subSection && (active == null || !active.canCreateSubsection())) || (!subSection && !this.identityProvider.isAdmin())) {
            this.alert(this.i18n("window.sections.error.cannotCreateSubsection"));
            return;
        }
        this.app.ioc.create(SectionNewWindowController, [this, {
            parentId: subSection ? active.getId() : SectionsWindowController.ROOT_ID,
            manager: this.sectionManager
        }])
        .then(win => {
            this.openChildWindow(win).getSectionPromise().then(section => {
                this.sectionEdit.isDirty().then(dirty => {
                    if (!dirty) {
                        this.setActiveCore(section);

                        //force refresh sections to trigger sections limit checks
                        this.sectionManager.load()
                    }
                });
            });
        });
    }
    
    onCollectionChange(event: utils.collection.CollectionEvent<SectionService>): void {
        if (event.type == "update" && event.element == this.activeCollection.getActive()) {
            this.sectionEdit.isDirty().then(dirty => {
                if (!dirty && event.element == this.activeCollection.getActive()) {
                    this.setActiveCore(event.element);
                }
            });
            let children = event.element.getDescantsAndMe().filter(x => x.getId() != event.element.getId());
            children.forEach(x => {
                this.activeCollection.collection.triggerUpdateElement(x);
            });
        }
    }
    
    onSectionChangeLock(event: SectionChangeLockEvent): void {
        this.callViewMethod("setSectionsChangeLock", event.lock);
    }

    beforeClose(_force?: boolean): Q.IWhenable<void> {
        if (_force) {
            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
            return;
        }
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);

        return Q().then(() => {
            return this.sectionEdit.isDirty().then(dirty => {
                if (dirty) {
                    this.sectionEdit.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
                    this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
                    return this.fireUnsavedChangesAction().then(result => {
                        if (result.result == "yes") {
                            this.sectionEdit.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                            this.sectionEdit.close(true);
                            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);                           
                        }
                        else {
                            this.manager.cancelClosing();
                        }
                    });
                }
                else {
                    this.sectionEdit.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                    this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                    return;
                }
            });
        })
    }
    
    centerSelectedSection(): void {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("centerSelectedSection");
        });
    }
    
}
