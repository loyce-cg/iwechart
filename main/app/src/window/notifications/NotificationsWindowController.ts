import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, section, section as sectionT, utils} from "../../Types";
import { TreeController } from "../../component/tree/TreeController";
import { SectionEditWindowController, RemoveEvent } from "../sectionedit/SectionEditWindowController";
import { SectionNewWindowController } from "../sectionnew/SectionNewWindowController";
import { SectionManager } from "../../mail/section/SectionManager";
import { SectionService, VirtualSectionService } from "../../mail/section/SectionService";
import { DockedWindow } from "../../app/common/window/DockedWindow";
import { MutableCollection } from "../../utils/collection/MutableCollection";
import { TransformCollection } from "../../utils/collection/TransformCollection";
import { WithActiveCollection } from "../../utils/collection/WithActiveCollection";
import { MergedCollection } from "../../utils/collection/MergedCollection";
import {Inject, Dependencies} from "../../utils/Decorators"
import { UserPreferences } from "../../mail/UserPreferences";
import { MailConst, LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    notificationsEnabled: boolean;
}

export interface SectionEntry {
    id: section.SectionId;
    parentId: section.SectionId;
    name: string;
    scope: string;
    isRoot: boolean;
    enabled: boolean;
    visible: boolean;
    notificationSettings: section.NotificationSettings;
    enabledModules: string[];
    breadcrumb?: string;
    showInTheList: boolean;
}

@Dependencies(["tree"])
export class NotificationsWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.notifications.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static GLOBAL_STATE_ID = "__global__";
    static ROOT_ID = "virtual:root";
    static NOT_SELECTED = "not-selected";
    
    @Inject identityProvider: utils.IdentityProvider;
    @Inject userPreferences: UserPreferences;
    sectionsTree: TreeController<SectionEntry>;
    sectionManager: SectionManager;
    mergedCollection: MergedCollection<SectionService>;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 750,
            height: 500,
            minWidth: 500,
            minHeight: 400,
            icon: "icon fa fa-bell-o",
            title: this.i18n("window.notifications.title")
        };
    }
    
    init(): Q.IWhenable<void> {
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getSectionManager();
        })
        .then(sectionManager => {
            this.sectionManager = sectionManager;
            return this.sectionManager.load();
        }).then(() => {
            let merged = new MergedCollection<SectionService>();
            merged.addCollection(new MutableCollection<SectionService>([new VirtualSectionService({
                id: NotificationsWindowController.ROOT_ID,
                name: this.i18n("window.notifications.rootName", this.identityProvider.getIdentity().host),
                editableMyBe: false,
                valid: true,
                canCreateSubsection: this.identityProvider.isAdmin()
            })]));
            merged.addCollection(this.sectionManager.managabledCollection);
            this.mergedCollection = merged;
            let castCollection = this.addComponent("castCollection", new TransformCollection<SectionEntry, SectionService>(this.mergedCollection, this.convertSection.bind(this)));
            this.sectionsTree = this.addComponent("sectionsTree", this.componentFactory.createComponent<SectionEntry>("tree", [
                this, NotificationsWindowController.ROOT_ID, castCollection, this.getActiveId.bind(this)]));
        });
    }
    
    getModel(): Model {
        return {
            notificationsEnabled: this.getGlobalNotificationsEnabled(),
        };
    }
    
    convertSection(sectionService: SectionService): SectionEntry {
        let parents: SectionService[] = [];
        let lastParent = sectionService.getParent();
        while (lastParent) {
            parents.unshift(lastParent);
            lastParent = lastParent.getParent();
        }
        let breadcrumb = "";
        parents.forEach(p => {
            breadcrumb += p.getName() + " / ";
        });
        
        let parent = sectionService.getParent();
        let notificationSettings: section.NotificationSettings = {};
        let enabledModules: string[] = [];
        let availModules = this.sectionManager.getSupportedModules();
        availModules.forEach( x => {
            if (sectionService.getId() == NotificationsWindowController.ROOT_ID) {
                return;
            }
            if (sectionService.isModuleEnabled(x)) {
                enabledModules.push(x);
            }
            let y = this.convertModuleName(x);
            notificationSettings[y] = sectionService.userSettings.mutedModules[y];
        });
        
        return {
            id: sectionService.getId(),
            parentId: parent ? parent.getId() : (sectionService.getId() == NotificationsWindowController.ROOT_ID ? null : NotificationsWindowController.ROOT_ID),
            enabled: sectionService.isValid(),
            visible: sectionService.userSettings ? sectionService.userSettings.visible : true,
            name: sectionService.getName(),
            scope: sectionService.getScope(),
            isRoot: sectionService.getId() == NotificationsWindowController.ROOT_ID,
            notificationSettings: notificationSettings,
            enabledModules: enabledModules,
            breadcrumb: breadcrumb,
            showInTheList: enabledModules.filter(x => x != section.NotificationModule.CALENDAR).length > 0,
        };
    }
    
    convertModuleName(name: string): string {
        let map: { [key: string]: string }  = {
            chat: section.NotificationModule.CHAT,
            file: section.NotificationModule.NOTES2,
            kvdb: section.NotificationModule.TASKS,
            calendar: section.NotificationModule.CALENDAR,
        }
        return name in map ? map[name] : name;
    }
    
    getActiveId(): number {
        return -1;
    }
        
    onViewClose(): void {
        this.close();
    }
    
    onViewRefresh() {
        this.sectionManager.load().fail(this.logError);
    }
    
    getGlobalNotificationsEnabled(): boolean {
        return this.userPreferences.getValue(MailConst.UI_NOTIFICATIONS, true);
    }
    
    setGlobalNotificationsEnabled(value: boolean) {
        this.userPreferences.set(MailConst.UI_NOTIFICATIONS, value, true);
    }
    
    onViewSave(changesStr: string) {
        let changes = <{ [key: string]: boolean }>JSON.parse(changesStr);
        let prom = Q();
        
        this.mergedCollection.forEach(section => {
            let settings: sectionT.NotificationSettings = {
                chat: section.userSettings && section.userSettings.mutedModules ? section.userSettings.mutedModules.chat : true,
                notes2: section.userSettings && section.userSettings.mutedModules ? section.userSettings.mutedModules.notes2 : true,
                tasks: section.userSettings && section.userSettings.mutedModules ? section.userSettings.mutedModules.tasks : true,
            };
            let update = false;
            this.sectionManager.getSupportedModules().forEach(x => {
                let moduleName = this.convertModuleName(x);
                let key = section.getId() + "/" + moduleName;
                if (key in changes && settings[moduleName] != changes[key]) {
                    settings[moduleName] = changes[key];
                    update = true;
                }
            });
            if (update) {
                prom = prom.then(() => {
                    section.updateUserSettings({
                        visible: section.userSettings.visible,
                        mutedModules: settings,
                    });
                });
            }
        });
        
        prom.then(() => {
            if (NotificationsWindowController.GLOBAL_STATE_ID in changes) {
                this.setGlobalNotificationsEnabled(changes[NotificationsWindowController.GLOBAL_STATE_ID]);
            }
            
            this.close();
        });
    }
    
}
