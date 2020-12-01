import {window, utils, mail, component, Q, Types} from "pmc-mail";
import Inject = utils.decorators.Inject;
import { i18n } from "./i18n/index";
import { UpdateAppsSpinnersEvent } from "../../main/AppsPlugin";

export interface SectionModel {
    primary: boolean,
    id: string,
    name: string,
    private: boolean,
    breadcrumb: string
    pinned: boolean;
}

export interface ViewModel {
    instanceName: string;
    appWindows: {
        id: string,
        icon: string,
        label: string,
        count: number,
        action: string
    }[];
    chatFullyLoaded: boolean;
    notes2FullyLoaded: boolean;
    tasksFullyLoaded: boolean;
    calendarFullyLoaded: boolean;
    appVersion?: string;
}

export class AppsWindowController extends window.base.BaseAppWindowController {
    
    static textsPrefix: string = "plugin.apps.window.apps.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject sectionManager: mail.section.SectionManager;
    @Inject userConfig: Types.app.ConfigEx;
    sections: utils.collection.BaseCollection<mail.section.SectionService>;
    sortedSectionsCollection: utils.collection.SortedCollection<SectionModel>;
    sectionList: component.extlist.ExtListController<SectionModel>;
    fullyLoadedModule: {[id: string]: any} = {};
    userGuide: component.userguide.UserGuideController;
    basicTooltip: component.tooltip.TooltipController;
    pinnedSectionIds: string[] = [];
    allSpinnersHidden: boolean = false;
    session: mail.session.Session;
    
    refreshBadgesLoaded(): void {
        for (let id in this.fullyLoadedModule) {
            this.callViewMethod("scheduleSetAppWindowBadgeFullyLoaded", id, this.fullyLoadedModule[id]);
        }
    }
    
    constructor(parentWindow: window.container.ContainerWindowController) {
        super(parentWindow, __filename, __dirname, null);
        this.ipcMode = true;
        this.session = this.app.sessionManager.getLocalSession();
        this.setPluginViewAssets("apps");
        this.openWindowOptions.fullscreen = true;
        this.openWindowOptions.cssClass = "app-window";
        this.basicTooltip = this.addComponent("basicTooltip", this.componentFactory.createComponent("tooltip", [this]));
        this.basicTooltip.getContent = (id: string) => {
            let dblClick: boolean = this.app.userPreferences.getUnreadBadgeUseDoubleClick();
            return this.app.localeService.i18n(`markAllAsRead.tooltip.${dblClick?'double':'single'}Click`);
        };
        this.refreshPinnedSectionIdsList();
        this.app.userPreferences.eventDispatcher.addEventListener<Types.event.UserPreferencesChangeEvent>("userpreferenceschange", (event) => {
            this.onUserPreferencesChange(event);
        });

        this.navBar.activeLogo = false;
    }
    
    registerBadgesEvents(): void {
        this.parent.appWindows.forEach(x => {
            if (x.count) {
                this.registerChangeEvent(x.count.changeEvent, () => {
                    this.callViewMethod("setAppWindowBadge", x.id, x.count.get());
                }, "multi");
            }
            if (x.countFullyLoaded) {
                this.registerChangeEvent(x.countFullyLoaded.changeEvent, () => {
                    this.fullyLoadedModule[x.id] = x.countFullyLoaded.get();
                    this.refreshBadgesLoaded();
                    // this.callViewMethod("scheduleSetAppWindowBadgeFullyLoaded", x.id, x.countFullyLoaded.get());

                }, "multi");
            }
        });
    }

    registerBadgesEvents_old(): void {
        this.parent.appWindows.forEach(x => {
            if (x.count) {
                this.registerChangeEvent(x.count.changeEvent, () => {
                    this.callViewMethod("setAppWindowBadge", x.id, x.count.get());
                }, "multi");
            }
            if (x.countFullyLoaded) {
                this.registerChangeEvent(x.countFullyLoaded.changeEvent, () => {
                    this.callViewMethod("scheduleSetAppWindowBadgeFullyLoaded", x.id, x.countFullyLoaded.get());
                }, "multi");
            }
        });
    }
    
    init() {
        return Q().then(() => {
            return this.app.mailClientApi.prepareSectionManager();
        })
        .then(() => {
            this.sections = this.addComponent("sections", new utils.collection.FilteredCollection(this.sectionManager.filteredCollection , x => {
                return x.hasAccess() && !x.isPrivateOrUserGroup() && (x.isChatModuleEnabled() || x.isKvdbModuleEnabled() || x.isFileModuleEnabled());
            }));
            let transformCollection = this.addComponent("transformCollection", new utils.collection.TransformCollection<SectionModel, mail.section.SectionService>(this.sections, s => {
                  let parents: mail.section.SectionService[] = [];
                  let lastParent = s.getParent();
                  while (lastParent) {
                    parents.unshift(lastParent);
                    lastParent = lastParent.getParent();
                  }
                  let breadcrumb = "";
                  parents.forEach(p => {
                    breadcrumb += p.getName() + " / ";
                  });
                
                    return {
                        primary: s.sectionData.primary,
                        id: s.getId(),
                        name: s.getName(),
                        private: s.getScope() == "private",
                        breadcrumb: breadcrumb,
                        pinned: this.pinnedSectionIds.indexOf(s.getId()) >= 0,
                    };
            }));
            
            this.sortedSectionsCollection = this.addComponent("sortedList", new utils.collection.SortedCollection(transformCollection, utils.Utils.makeMultiComparatorSorter(this.sectionComparator_isPrimary.bind(this), this.sectionComparator_isPinned.bind(this))));

            this.sectionList = this.addComponent("sectionList", this.componentFactory.createComponent("extlist", [this, this.sortedSectionsCollection]));
            this.sectionList.ipcMode = true;
            this.app.eventDispatcher.addEventListener("first-login-info-closed", this.showFilesUserGuide.bind(this));

            return this.app.mailClientApi.loadUserPreferences();
        })
        .then(() => {
            this.registerBadgesEvents();
            return;
        })
        .then(() => {
            this.app.addEventListener<UpdateAppsSpinnersEvent>("update-apps-spinners", e => {
                this.callViewMethod("updateSpinners", e.sectionId, e.moduleName, e.state, true);
            });
        });
    }
    
    getModel(): ViewModel {
        let chatFullyLoaded: boolean = false;
        let notes2FullyLoaded: boolean = false;
        let tasksFullyLoaded: boolean = false;
        let calendarFullyLoaded: boolean = false;
        this.parent.appWindows.forEach(x => {
            if (x.countFullyLoaded && x.countFullyLoaded.get()) {
                if (x.id == "chat") {
                    chatFullyLoaded = true;
                }
                else if (x.id == "notes2") {
                    notes2FullyLoaded = true;
                }
                else if (x.id == "tasks") {
                    tasksFullyLoaded = true;
                }
                else if (x.id == "calendar") {
                    calendarFullyLoaded = true;
                }
            }
        });
        return {
            instanceName: this.userConfig.instanceName,
            appWindows: this.getAppWindows(),
            chatFullyLoaded: chatFullyLoaded,
            notes2FullyLoaded: notes2FullyLoaded,
            tasksFullyLoaded: tasksFullyLoaded,
            calendarFullyLoaded: calendarFullyLoaded,
            appVersion: this.app.getVersion().ver
        };
    }
    
    onViewSetAllSpinnersHidden(allSpinnersHidden: boolean): void {
        this.allSpinnersHidden = allSpinnersHidden;
    }
    
    getAppWindows() {
        return this.parent.appWindows
            .filter(x => x.visible !== false)
            .map(x => {
                return {
                    id: x.id,
                    icon: x.icon,
                    label: x.label,
                    count: x.count ? x.count.get() : 0,
                    action: x.action,
                    order: x.order ? x.order : 0,
                };
            }).sort((a, b) => {
                return a.order - b.order;
            });
    }
    
    onViewSectionClick(id: string): void {
        let selected = this.sectionManager.getSection(id);
        let singletonId = "sectionsummarywindow-"+id;
        let registered = this.app.manager.getSingleton(singletonId);

        if (registered) {
            registered.controller.nwin.focus();
            registered.controller.reopenWithParams([this, selected]);
            return;
        }
        this.app.ioc.create(window.sectionsummary.SectionSummaryWindowController, [this, this.session, selected]).then(win => {
            this.app.openChildWindow(win);
            this.app.manager.registerSingleton(singletonId, win.manager);
        });
    }
    
    onViewAppWindowOpen(appWindowId: string): void {
        this.parent.redirectToAppWindow(appWindowId);
    }
    
    onNwinInitialized(): Q.Promise<void> {
        return super.onNwinInitialized()
        .then(() => {
            this.refreshBadgesLoaded();
        })
    }

    isFirstAdmin(): Q.Promise<boolean> {
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getIdentityProvider()
        })
        .then(identityProvider => {
            if (! identityProvider.isAdmin()) {
                return false;
            }
            else {
                return this.app.mailClientApi.privmxRegistry.getUserAdminService().then(admService => admService.refreshUsersCollection().thenResolve(admService))
                .then(adminService => {
                    return adminService.usersCollection.size() == 1;                
                })     
            }
        })
    }

    isStartingContentAvailable(): Q.Promise<boolean> {
        return Q().then(() => {
            return this.sectionManager.load()
        })
        .then(() => {
            if (this.sectionManager.sectionsCollection.list.length == 1 && this.sectionManager.sectionsCollection.list[0].getId() == "private:admin") {
                return false;
            }
            return true;
        })
    }

    async showFilesUserGuide() {
        return Q().then(() => {
            return Q.all([
                this.isFirstAdmin(),
                this.isStartingContentAvailable()
            ])
        })
        .then(res => {
            let [firstAdmin, startingContent] = res;
            return firstAdmin && startingContent ? this.retrieveFromView("getFilesPos") : null;
        })
        .then((result: {x: number, y: number}) => {
            if (! result) {
                return;
            }
            this.userGuide = this.addComponent("userguide", this.componentFactory.createComponent("userguide", [this, {
                width: 200,
                height: 200,
                centerX: result.x,
                centerY: result.y,
                shape: "rounded-rectangle",
                text: this.i18n("plugin.apps.window.apps.filesUserGuide.text"),
                side: "bottom",
                onClick: () => {
                    this.userGuide.close();
                    this.callViewMethod("closeFilesUserGuide");
                    this.removeComponent("userguide");
                    this.parent.redirectToAppWindow("notes2");
                },
                // actionButton: {
                //     text: "Ok",
                //     onClick: () => {
                //         console.log("button clicked");
                //         this.userGuide.close();
                //         this.callViewMethod("closeFilesUserGuide");
                //         this.removeComponent("userguide");
                //     }
                // }
                }]));
            this.callViewMethod("showFilesUserGuide");
        })
    }
    
    onViewModuleBadgeClick(moduleName: "chat"|"notes2"|"tasks"|"calendar"): void {
        if (!this.fullyLoadedModule[moduleName] || moduleName == "calendar" || !this.allSpinnersHidden) {
            return;
        }
        this.dispatchEvent<Types.event.TryMarkAsReadEvent>({
            type: "try-mark-as-read",
            moduleName: moduleName,
        });
    }
    
    onViewSectionBadgeClick(sectionId: string): void {
        if (!this.fullyLoadedModule["chat"] || !this.fullyLoadedModule["notes2"] || !this.fullyLoadedModule["tasks"] || !this.fullyLoadedModule["calendar"] || !this.allSpinnersHidden) {
            return;
        }
        this.dispatchEvent<Types.event.TryMarkAsReadEvent>({
            type: "try-mark-as-read",
            sectionId,
        });
    }
    
    sectionComparator_isPrimary(a: SectionModel, b: SectionModel): number {
        let ap = a.primary ? 1 : 0;
        let bp = b.primary ? 1 : 0;
        return bp -ap;
    }
    
    sectionComparator_isPinned(a: SectionModel, b: SectionModel): number {
        let ap = this.getIsPinned(a) ? 1 : 0;
        let bp = this.getIsPinned(b) ? 1 : 0;
        return bp - ap;
    }
    
    getIsPinned(sectionModel: SectionModel): boolean {
        return this.pinnedSectionIds.indexOf(sectionModel.id) >= 0;
    }
    
    refreshPinnedSectionIdsList(): void {
        let prevStr = JSON.stringify(this.pinnedSectionIds);
        this.pinnedSectionIds = this.app.userPreferences.getPinnedSectionIds();
        let newStr = JSON.stringify(this.pinnedSectionIds);
        if (prevStr != newStr && this.sortedSectionsCollection) {
            this.sortedSectionsCollection.rebuild();
        }
    }
    
    onUserPreferencesChange(event: Types.event.UserPreferencesChangeEvent) {
        this.refreshPinnedSectionIdsList();
    }

}
