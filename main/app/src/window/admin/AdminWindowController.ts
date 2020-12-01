import {BaseWindowController} from "../base/BaseWindowController";
import {TabController, TabsControllers} from "./TabsControllers";
import * as Q from "q";
import {app, utils} from "../../Types";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators"
import {UserAdminService} from "../../mail/UserAdminService";
import {HashmailResolver} from "../../mail/HashmailResolver";
import {MessageService} from "../../mail/MessageService";
import {CosignerService} from "../../mail/CosignerService";
import {AdminKeyHolder} from "../../mail/admin/AdminKeyHolder";
import {PersonsController} from "../../component/persons/PersonsController";
import { LocaleService, UtilApi } from "../../mail";
import { i18n } from "./i18n";
import { ServerProxyService } from "../../mail/proxy";
import * as PmxApi from "privmx-server-api";
import { Persons } from "../../mail/person/Persons";

export interface PreloadedData {
    config: privfs.types.core.ConfigEx;
    usersLimitReached: boolean;
}

@Dependencies(["autorefresh", "extlist", "persons"])
export class AdminWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.admin.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    active: string;
    tabs: {[tabName: string]: TabController};
    loadingTab: string;
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    @Inject identityProvider: utils.IdentityProvider;
    @Inject userConfig: app.ConfigEx;
    @Inject userAdminService: UserAdminService;
    @Inject hashmailResolver: HashmailResolver;
    @Inject messageService: MessageService;
    @Inject cosignerService: CosignerService;
    @Inject adminKeyHolder: AdminKeyHolder;
    @Inject serverProxyService: ServerProxyService;
    @Inject utilApi: UtilApi;
    @Inject persons: Persons;
    personsComponent: PersonsController;

    preloadedData: PreloadedData;

    constructor(parent: app.WindowParent, section: string) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.addViewScript({path: "build/colorpicker/a-color-picker/dist/acolorpicker.js"});
        this.addViewStyle({path: "build/aggrid/ag-grid.min.css"});
        this.addViewStyle({path: "build/aggrid/ag-theme-balham-dark.min.css"});

        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 1100;
        this.openWindowOptions.height = 620;
        this.openWindowOptions.minWidth = 730;
        this.openWindowOptions.minHeight = 200;
        this.openWindowOptions.title = this.i18n("window.admin.title");
        this.openWindowOptions.icon = "icon fa fa-server";
        this.openWindowOptions.backgroundColor = "#0a2a35";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
        this.tabs = {};
        
        TabsControllers.forEach(tabClass => {
            this.registerTab({id: tabClass.tabId, tab: new tabClass(this)});
        });
        this.active = section || "sysinfo";
    }


    init() {
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        return Q.all([
            this.app.mailClientApi.checkAdminKey().thenResolve(null),
            this.preloadData()
        ]).thenResolve(null);
    }
    
    reopenWithParams(section: string): void {
        if (section && this.active != section) {
            this.onViewChoose(section);
        }
    }
    
    registerTab(options: {id: string, tab: TabController, componentId?: string, replace?: boolean}): void {
        if (options.id in this.tabs && !options.replace) {
            throw new Error("Tab with id '" + options.id + "' already exists");
        }
        let componentId = options.componentId || options.id;
        this.tabs[options.id] = this.addComponent("tab-component-" + componentId, options.tab);
    }
    
    onViewLoad(): void {
        this.onViewChoose(this.active);
    }
    
    onViewChoose(name: string): void {
        this.loadingTab = name;
        this.callViewMethod("loadingTab", name);
        this.addTaskEx(this.i18n(""), true, () => {
            return Q().then(() => {
                return this.tabs[name].prepare();
            })
            .then(() => {
                if (name == this.loadingTab) {
                    this.active = name;
                    this.callViewMethod("activateTab", name);
                }
            });
        });
    }

    preloadData(): Q.Promise<void> {
        return Q().then(() => {
            return Q.all([
                this.srpSecure.getConfigEx(),
                this.userAdminService.refreshUsersCollection()
            ])
        })
        .then(res => {
            let config = res[0];
            let currentUsers = this.userAdminService.usersCollection.size();
            let maxUsers = (<any>config).maxUsersCount;
            let limitReached = maxUsers != -1 && maxUsers <= currentUsers;
            this.preloadedData = {
                config: config,
                usersLimitReached: limitReached
            }
        })
    }
    isMaxUsersLimitReached(): boolean {
        return this.preloadedData.usersLimitReached;
    }
}
