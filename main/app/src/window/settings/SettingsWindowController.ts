import {BaseWindowController} from "../base/BaseWindowController";
import {TabController, TabsControllers} from "./TabsControllers";
import * as Q from "q";
import * as privfs from "privfs-client";
import {app, mail, utils} from "../../Types";
import {Inject, Dependencies} from "../../utils/Decorators"
import {SinkIndexManager} from "../../mail/SinkIndexManager";
import {UserPreferences} from "../../mail/UserPreferences";
import {SinkService} from "../../mail/SinkService";
import {MailStats} from "../../mail/MailStats";
import {MailFilter} from "../../mail/MailFilter";
import {PersonService} from "../../mail/person/PersonService";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { ElectronPartitions } from "../../app";

export type PreferencesToSave = {[name: string]: any};

export interface Model {
    supportWhitelist: boolean;
    supportsSecureForms: boolean;
    isElectron: boolean;
    isMnemonicEnabled: boolean;
}

@Dependencies(["extlist"])
export class SettingsWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject authData: privfs.types.core.UserDataEx;
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    @Inject identityProvider: utils.IdentityProvider;
    @Inject sinkIndexManager: SinkIndexManager;
    @Inject messageManager: privfs.message.MessageManager;
    @Inject sinkEncryptor: privfs.crypto.utils.ObjectEncryptor;
    @Inject userPreferences: UserPreferences;
    @Inject notifications: utils.Option<mail.NotificationEntry[]>;
    @Inject sinkService: SinkService;
    @Inject mailStats: MailStats;
    @Inject localStorage: utils.IStorage;
    @Inject mailFilter: MailFilter;
    @Inject userConfig: privfs.types.core.UserConfig;
    @Inject personService: PersonService;
    active: string;
    tabs: {[tabName: string]: TabController};
    loadingTab: string;
    supportWhitelist: boolean;
    supportSecureForms: boolean;
    
    constructor(parent: app.WindowParent, section: string) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.addViewScript({path: "build/zxcvbn.js"});
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 950;
        this.openWindowOptions.height = 575;
        this.openWindowOptions.minWidth = 850;
        this.openWindowOptions.minHeight = 500;
        this.openWindowOptions.title = this.i18n("window.settings.title");
        this.openWindowOptions.icon = "icon ico-settings";
        this.openWindowOptions.electronPartition = ElectronPartitions.HTTPS_SECURE_CONTEXT;
        this.tabs = {};
        this.supportWhitelist = this.identityProvider.isAdmin();
        this.supportSecureForms = true; //this.app.supportsSecureForms() && this.authData.myData.raw.secureFormsEnabled;
        TabsControllers.forEach(tabClass => {
            if (tabClass.tabId == "secureForms" && !this.supportSecureForms) {
                return;
            }
            if (tabClass.tabId == "whitelist" && !this.supportWhitelist) {
                return;
            }
            if (tabClass.tabId == "hotkeys" && !this.app.isElectronApp()) {
                return;
            }
            if (tabClass.tabId == "alternativeLogin" && !this.app.isMnemonicEnabled) {
                return;
            }
            this.registerTab({id: tabClass.tabId, tab: new tabClass(this)});
        });
        this.active = section || "publicProfile";
    }
    
    init(): Q.IWhenable<void> {
        return this.app.mailClientApi.prepareSession()
    }
    
    getModel(): Model {
        return {
            supportWhitelist: this.supportWhitelist,
            supportsSecureForms: this.supportSecureForms,
            isElectron: this.app.isElectronApp(),
            isMnemonicEnabled: this.app.isMnemonicEnabled,
        };
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
    
    onViewExportUserData() {
        this.alert("User data exporting process in progress. Wait a minute for a result.");
        Q().then(() => {
            return this.app.mailClientApi.exportSections(this.app);
        })
        .then(result => {
            this.getLogger().debug("Saving data");
            let session = this.app.sessionManager.getLocalSession();
            this.app.directSaveContent(privfs.lazyBuffer.Content.createFromJson(result, null, "user-data.json"), session, this.getClosestNotDockedController());
        })
        .fail(e => {
            this.logError(e);
            this.alert("Error during exporting");
        });
    }
    
    // onViewImportUserData() {
    //     Q().then(() => {
    //         return this.app.mailClientApi.importSections(JSON.parse(require("fs").readFileSync("/home/wp/Desktop/user-data.json", "utf-8")));
    //     })
    //     .then(() => {
    //         this.alert("OK")
    //     })
    //     .catch((e) => {
    //         console.log(e)
    //         this.alert("ERROR")
    //     })
    // }
    
    onViewShowPlayerWindow() {
        let playerHelperWindow = this.app.windows.playerHelper;
        if (playerHelperWindow) {
            playerHelperWindow.nwin.show();
        }
    }

    onViewAutostartChecked(checked: boolean): void {
        if (this.app.isElectronApp()) {
            (<any>this.app).setAutostartEnabled(checked);
        }
    }

    onViewErrorsLoggingChecked(checked: boolean): void {
        if (this.app.isElectronApp()) {
            (<any>this.app).setErrorsLoggingEnabled(checked);
        }
    }

}
