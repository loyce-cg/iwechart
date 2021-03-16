import {LocaleService} from "../../mail/LocaleService";
import {BrowserDetection} from "../../web-utils/BrowserDetection";
import {Settings} from "../../web-utils/Settings";
import * as Q from "q";
import {Version} from "../../utils/Version";
import {IndexViewHelper} from "../../web-utils/IndexViewHelper";
import {ViewManager} from "../common/ViewManager";
import {UrlOpener} from "../../web-utils/UrlOpener";
import * as $ from "jquery";
import {window} from "../../web-utils/Window";
import {Template} from "../../web-utils/template/Template";
import {TemplateManager} from "../../web-utils/template/Manager";
import * as coreModule from "../../build/core"; //only type import
import {app, utils} from "../../Types";
import {Lang} from "../../utils/Lang";
import {func as windowRequirementsTemplate} from "./site/template/window-requirements.html";
import {func as mainTemplate} from "./site/template/main.html";
import {func as loginTemplate} from "./site/template/login.html";
import {PromiseUtils} from "simplito-promise";
import {AssetsManager} from "../common/AssetsManager";
import * as privfs from "privfs-client";
import {Require} from "./electron/Require";
import {ElectronModule} from "./electron/ElectronModule";
import {i18n} from "../../i18n";

export interface InitializerAssets {
    CUSTOM_LOGO_127X112: string;
    CUSTOM_LOGO_127X112_WH: string;
    CUSTOM_LOGO_87X22: string;
    CUSTOM_LOGO_87X22_WH: string;
    CUSTOM_LOGO_CUSTOM_FORM: string;
}

export enum Feature {
    DEMO = "demo",
    SECURE_FORMS = "secureForms",
    SEARCH = "search"
}

export interface InitializerOptions {
    MAIN_SCRIPT: string;
    PRIVMX_WORKER_PATH: string;
    PRIVFS_VERSION: string;
    
    privmxCoreRequire(name: string): any;
    app?: coreModule.WebApplication;
    init?: Initializer;
    options: AppOptions;
}

export interface AppOptions {
    assets: InitializerAssets;
    features: {[name in Feature]: boolean};
    customMenuItems: privfs.types.core.CustomMenuItem[];
    loginDomains: string[];
    maxFileSizeLimit: number;
    initApp: string;
    logoApp: string;
    apps: string[];
    plugins: app.PluginConfig[];
    defaultApplication: {applicationId: string; mimeType: string; action?: string}[];
    desktopDownloadUrl: string;
    termsUrl: string;
    privacyPolicyUrl: string;
    instanceName: string;
    webAccessEnabled: boolean;
    desktopAppUrls: {
      linux: string,
      win32: string,
      darwin: string
    }
}

export interface Recommendation {
    name: string;
    displayName: string;
    version: string;
    link: string;
}

export interface RequirementsModel {
    type: string;
    usedBrowser: string;
    version: string;
    recommendations: {
        upgrade: Recommendation;
        install: Recommendation[];
    }
}

export interface McaPlugin {
    register(privmx: typeof coreModule, app: coreModule.WebApplication): Q.IWhenable<void>;
}

export type McaPluginModule = {
    Plugin: {
        new(): McaPlugin
    }
}

export class Initializer {
    
    static REQUIREMENTS_POPUP_SETTINGS_KEY = "requirements-popup";
    static REQUIREMENTS_POPUP_DO_NOT_SHOW = "do-not-show";
    
    options: InitializerOptions
    version: utils.ProjectInfo;
    localeService: LocaleService;
    mainTemplate: Template<any, any, IndexViewHelper>;
    query: {[name: string]: any};
    browser: BrowserDetection;
    settings: Settings;
    handler: {jquery: JQueryStatic, window: Window};
    rootUrl: string;
    pluginRootUrl: string;
    testMode: boolean;
    assetsManager: AssetsManager;
    viewManager: ViewManager;
    templateManager: TemplateManager;
    require: Require;
    electronModule: ElectronModule;
    
    constructor(options: InitializerOptions) {
        this.options = options;
        this.rootUrl = Initializer.getRootUrl();
        this.pluginRootUrl = Initializer.getPluginRootUrl(this.rootUrl);
        this.version = Version.get(this.options.PRIVFS_VERSION);
        this.query = this.parseQueryString(window.location.search);
        this.testMode = !!this.query.testmode;
        this.browser = new BrowserDetection();
        this.settings = new Settings();
        this.assetsManager = new AssetsManager(this.rootUrl, this.pluginRootUrl, this);
        this.assetsManager.init(this.options.options.assets);
        
        this.localeService = LocaleService.create(i18n);
        this.localeService.changeEvent.add(this.onLangChange.bind(this));
        this.viewManager = new ViewManager(null);
        this.electronModule = new ElectronModule();
        this.require = this.electronModule.createRequire();
        this.viewManager.ipc = this.require.electron.ipcRenderer;
        this.templateManager = this.viewManager.getTemplateManager();
        this.templateManager.registerHelper(new IndexViewHelper(this.templateManager, this));
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.handler = {
            jquery: $,
            window: window
        };
        if (!this.browser.isDesktop()) {
            $("html").addClass("mobile");
        }
    }
    
    static getRootUrl(): string {
        let scripts = document.getElementsByTagName("script");
        let path = scripts[scripts.length - 1].src.split("?")[0];
        return path.split("/").slice(0, -2).join("/") + "/";
    }
    
    static getPluginRootUrl(rootUrl: string): string {
        return rootUrl.split("/").slice(0, -3).join("/") + "/";
    }
    
    isFeatureEnabled(feature: Feature) {
        return !!this.options.options.features[feature];
    }
    
    supportsSecureForms(): boolean {
        return this.isFeatureEnabled(Feature.SECURE_FORMS);
    }
    
    isDemo(): boolean {
        return this.isFeatureEnabled(Feature.DEMO);
    }
    
    isSearchEnabled(): boolean {
        return this.isFeatureEnabled(Feature.SEARCH);
    }
    
    onLangChange(): void {
        this.saveLang(this.localeService.currentLang);
    }
    
    isDevMode(): boolean {
        return !!this.query.devmode;
    }
    
    getCustomMenuItems(): privfs.types.core.CustomMenuItem[] {
        return this.options.options.customMenuItems;
    }
    
    saveLang(lang: string): void {
        this.settings.setItem("lang", lang);
    }
    
    start(): Q.Promise<void> {
        return Q().then(() => {
            return this.settings.getItem("lang");
        })
        .then(lang => {
            this.localeService.setLangEx(lang);
            if (!this.isDevMode()) {
                setTimeout(() => {
                    this.showWarningBannerOnConsole();
                }, 1000);
            }
            if (this.browser.meetsMinimalRequirements()) {
                this.initApp();
            }
            else {
                this.openRequirementsWindow();
            }
        })
        .fail(e => {
            console.log(e);
        });
    }
    
    openRequirementsWindow(): void {
        if (this.settings.getItem(Initializer.REQUIREMENTS_POPUP_SETTINGS_KEY) == Initializer.REQUIREMENTS_POPUP_DO_NOT_SHOW) {
            this.initApp();
            return;
        }
        $("#windows-container > .window-loading-screen.init").remove();
        let result = this.buildRequirementsModel();
        let $ele = this.templateManager.createTemplate(windowRequirementsTemplate).renderToJQ({result: result});
        if (result && result.type == "ok") {
            let c = 5, iid: NodeJS.Timer;
            $(".window-requirements-main .seconds-left").text(c);
            iid = setInterval(() => {
                if (c > 1) {
                    c--;
                    $(".window-requirements-main .seconds-left").text(c);
                }
                else {
                    clearInterval(iid);
                    window.top.location.reload();
                }
            }, 1000);
        }
        $ele.on("click", "[data-url]", this.onLinkClick.bind(this));
        $("body").append($ele);
        $ele.on("click", ".action-continue", () => {
            if ((<HTMLInputElement>$ele.find(".do-not-show-again-checkbox")[0]).checked) {
                this.settings.setItem(Initializer.REQUIREMENTS_POPUP_SETTINGS_KEY, Initializer.REQUIREMENTS_POPUP_DO_NOT_SHOW);
            }
            $ele.remove();
            this.initApp();
        });
    }
    
    onLinkClick(e: MouseEvent): void {
        let url = $(e.currentTarget).data("url");
        UrlOpener.open(url);
    }
    
    initApp() {
        let attrs = $(this.options.MAIN_SCRIPT)[0].attributes;
        let script = document.createElement('script');
        for (let i = 0; i < attrs.length; i++) {
            script.setAttribute(attrs[i].name, attrs[i].value);
        }
        script.async = true;
        script.addEventListener("load", this.onAppScriptLoad.bind(this), false);
        script.addEventListener("error", (e) => {
            console.log("Error during loading main application script", e);
            alert(this.localeService.i18n("window.init.mainScriptLoadError"));
        });
        document.getElementsByTagName("body")[0].appendChild(script);
    }
    
    onAppScriptLoad() {
        try {
            this.onAppScriptLoadCore();
        }
        catch (e) {
            console.log("Error during initializing an application", e);
            alert(this.localeService.i18n("window.init.mainScriptInitError"));
        }
    }
    
    loadScript(src: string) {
        // console.log("loadScript - initializer", src);
        let defer = Q.defer<void>();
        let script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("src", src);
        script.async = true;
        script.addEventListener("load", () => {
            defer.resolve();
        }, false);
        script.addEventListener("error", e => {
            defer.reject(e);
        });
        document.getElementsByTagName("body")[0].appendChild(script);
        return defer.promise;
    }

    
    loadPlugin(plugin: app.PluginConfig, privmxCore: typeof coreModule, app: coreModule.WebApplication) {
        let src = this.assetsManager.getPluginAsset(plugin.name, "build/main.js");
        return this.loadScript(src).then(() => {
            let pluginRequire = plugin.name + "PluginMainRequire";
            let pluginRegiser = plugin.name + "PluginRegister";
            if (pluginRequire in window) {
                let pluginModule = <McaPluginModule>(<any>window)[pluginRequire]("main");
                let pluginInstance = new (<McaPluginModule>pluginModule).Plugin();
                pluginInstance.register(privmxCore, app);
            }
            else if (pluginRegiser in window) {
                (<any>window)[pluginRegiser](privmxCore, app);
            }
        });
    }
    
    getPluginConfig(name: string): app.PluginConfig {
        return Lang.find(this.options.options.plugins, x => x.name == name);
    }
    
    generateDeviceId() {
        let array = new Uint8Array(10);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(array);
        }
        else {
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
        }
        let str = "";
        for (let i = 0; i < array.length; i++) {
            str += array[i].toString(16);
        }
        return str;
    }
    
    onAppScriptLoadCore() {
        $("#windows-container > .window-loading-screen.init").remove();
        let validateLogLevel = (level: string): boolean => {
            return level == "DEBUG" || level == "ERROR" || level == "INFO" || level == "OFF" || level == "WARN";
        };
        let privmxCore = <typeof coreModule>this.options.privmxCoreRequire("privmx-core");
        let WebApplication = privmxCore.WebApplication;
        let Logger = privmxCore.Logger;
        let Q = privmxCore.Q;
        (<any>Q).delegateToNextTick.enabled = false;
        let privfs = privmxCore.privfs;
        let devMode = this.isDevMode();
        let logLevel = devMode ? "DEBUG" : "ERROR";
        if (validateLogLevel(this.query.loglevel)) {
            logLevel = this.query.loglevel;
        }
        Q.longStackSupport = true;
        let deviceId = window.localStorage.getItem("privmx-device-id");
        if (!deviceId) {
            deviceId = this.generateDeviceId();
            window.localStorage.setItem("privmx-device-id", deviceId);
        }
        privmxCore.privfs.core.PrivFsRpcManager.setAgent("webmail-client-js;" + this.version.str);
        privmxCore.privfs.core.PrivFsRpcManager.setGatewayProperties({
            appVersion: "privfs-mail-client@" + this.version.str,
            sysVersion: navigator.userAgent,
            deviceId: deviceId
        });
        privmxCore.privfs.core.PrivFsRpcManager.setMaxMessagesNumber(10);
        Logger.setLevel((<any>Logger)[logLevel]);
        let subLogLevel = Logger.WARN.value >= Logger.getLevel().value ? Logger.WARN : Logger.getLevel();
        Logger.get("privfs-mail-client.utils.Event").setLevel(subLogLevel);
        Logger.get("privfs-mail-client.utils.EncryptedPromiseMap").setLevel(subLogLevel);
        Logger.get("privfs-mail-client.utils.WebStorage").setLevel(subLogLevel);
        Logger.get("privmx-rpc").setLevel(subLogLevel);
        if (validateLogLevel(this.query.gatewayLevel)) {
            Logger.get("privfs-client.gateway.RpcGateway").setLevel((<any>Logger)[this.query.gatewayLevel]);
        }
        if (devMode) {
            Logger.get("privfs-mail-client.window.admin.AdminWindowController").setLevel(subLogLevel.value < Logger.INFO.value ? subLogLevel : Logger.INFO);
        }
        Logger.get("privfs-mail-client.migration").setLevel(Logger.DEBUG);
        window.onbeforeunload = () => {
            if (!(devMode || this.testMode || (app && app.windows.login) || (app && app.preventLeavePageAlert))) {
                return app.localeService.i18n("index.leavePageAlert.text");
            }
        };
        privfs.core.PrivFsRpcManager.setServiceDiscoveryJsonMode(window.location.protocol === "https:" ?
            privfs.serviceDiscovery.JsonMode.HTTPS_ONLY : privfs.serviceDiscovery.JsonMode.HTTP_ONLY);
        
        privfs.crypto.service.init(this.options.PRIVMX_WORKER_PATH);
        
        let app = new WebApplication(this);
        app.deviceId = deviceId;
        if (devMode) {
            app.viewLogLevel = "WARN";
        }
        if (this.options.options.maxFileSizeLimit) {
            app.options.maxFileSize.value = this.options.options.maxFileSizeLimit;
        }
        if (this.options.options.loginDomains) {
            app.supportedHosts = this.options.options.loginDomains;
        }
        app.customMenuItems = this.options.options.customMenuItems.concat(app.customMenuItems);
        PromiseUtils.oneByOne(this.options.options.plugins, (_, plugin) => {
            return this.loadPlugin(plugin, privmxCore, app);
        })
        .then(() => {
            if (devMode || this.testMode) {
                this.options.app = app;
            }
            else {
                delete this.options.privmxCoreRequire;
            }
            app.start();
        })
        .fail(e => {
            console.log("Error during initializing an application", e);
            alert(this.localeService.i18n("window.init.mainScriptInitError"));
        });
    }
    
    parseQueryString(query: string): {[name: string]: any} {
        if (!query) {
            return {};
        }
        query = query.indexOf("?") == 0 ? query.substring(1) : query;
        let paramsList = query.split("&");
        let paramMap: {[name: string]: any} = {};
        for (var i in paramsList) {
            if (paramsList[i].indexOf("=") == -1) {
                paramMap[paramsList[i]] = true;
            }
            else {
                let p = paramsList[i].split("=");
                paramMap[p[0]] = (<any>window).decodeURIComponent(p[1]);
            }
        }
        return paramMap;
    }
    
    buildRequirementsModel(): RequirementsModel {
        let result: RequirementsModel = {type: null, usedBrowser: null, version: null, recommendations: {upgrade : null, install: []}};
        if (this.browser) {
            let requirements = BrowserDetection.Requirements;
            let getFirefoxRecommendation = () => {
                return {
                    name: "firefox",
                    displayName: "Mozilla Firefox",
                    version: ">= " + requirements.firefox,
                    link: "https://www.mozilla.org/firefox/new/"
                };
            };
            let getChromeRecommendation = () => {
                return {
                    name: "chrome",
                    displayName: "Google Chrome",
                    version: ">= " + requirements.chrome,
                    link: "https://www.google.com/chrome/browser/"
                };
            };
            let getSafariRecommendation = () => {
                return {
                    name: "safari",
                    displayName: "Apple Safari",
                    version: ">= " + requirements.safari,
                    link: "http://www.apple.com/safari/"
                };
            };
            result.type = "ok";
            result.usedBrowser = this.browser.nameWithVersion();
            if (!this.browser.isDesktop()) {
                result.type = "not-desktop";
            }
            else if (this.browser.isChrome() && !this.browser.isValidChrome()) {
                result.type = "old-version";
                result.version = this.browser.version();
                result.recommendations = {
                    upgrade: getChromeRecommendation(),
                    install: [getFirefoxRecommendation()]
                };
                if (this.browser.isMac()) {
                    result.recommendations.install.push(getSafariRecommendation());
                }
            }
            else if (this.browser.isFirefox() && !this.browser.isValidFirefox()) {
                result.type = "old-version";
                result.version = this.browser.version();
                result.recommendations = {
                    upgrade: getFirefoxRecommendation(),
                    install: [getChromeRecommendation()]
                };
                if (this.browser.isMac()) {
                    result.recommendations.install.push(getSafariRecommendation());
                }
            }
            else if (this.browser.isSafari() && !this.browser.isValidSafari()) {
                result.type = "old-version";
                result.version = this.browser.version();
                result.recommendations = {
                    upgrade: getSafariRecommendation(),
                    install: [getFirefoxRecommendation(), getChromeRecommendation()]
                };
            }
            else {
                result.type = "unsupported-browser";
                result.recommendations.install = [getFirefoxRecommendation(), getChromeRecommendation()];
                if (this.browser.isMac()) {
                    result.recommendations.install.push(getSafariRecommendation());
                }
            }
        }
        return result;
    }
    
    showWarningBannerOnConsole(): void {
        let bannerPL = [
            '',
            '    .d8888b.  888                       888    ',
            '   d88P  Y88b 888                       888    Ta funkcja przeglądarki jest przeznaczona',
            '   Y88b.      888                       888    dla twórców aplikacji. Jeżeli ktoś polecił',
            '    "Y888b.   888888  .d88b.  88888b.   888    Ci skopiować i wkleić tu coś, aby włączyć',
            '       "Y88b. 888    d88""88b 888 "88b  888    funkcję PrivMX lub włamać się na czyjeś',
            '         "888 888    888  888 888  888  Y8P    konto, jest to oszustwo mające na celu',
            '   Y88b  d88P Y88b.  Y88..88P 888 d88P         uzyskanie dostępu do Twojego konta PrivMX.',
            '    "Y8888P"   "Y888  "Y88P"  88888P"   888    ',
            '                              888              ',
            '                              888              ',
            '                              888              ',
            ''
        ].join("\n");
        let bannerEN = [
            '',
            '    .d8888b.  888                       888    ',
            '   d88P  Y88b 888                       888    This is a browser feature intended',
            '   Y88b.      888                       888    for developers. If someone told you',
            '    "Y888b.   888888  .d88b.  88888b.   888    to copy-paste something here to enable',
            '       "Y88b. 888    d88""88b 888 "88b  888    a PrivMX feature or "hack" someone\'s',
            '         "888 888    888  888 888  888  Y8P    account, it is a scam and will give',
            '   Y88b  d88P Y88b.  Y88..88P 888 d88P         them access to your PrivMX account.',
            '    "Y8888P"   "Y888  "Y88P"  88888P"   888    ',
            '                              888              ',
            '                              888              ',
            '                              888              ',
            ''
        ].join("\n");
        let banner = this.localeService.currentLang == "pl" ? bannerPL : bannerEN;
        console.log("%c" + banner, "color: red; font-weight: bold;");
    }
    
    showLoginDialog(username: string, password: string, callback: (result: app.InteractiveModal) => void): JQuery {
        let $main = $("#main");
        if ($main.has(".login-modal.inner-page-window").length > 0) {
            return;
        }
        let loginDialogTmpl = this.templateManager.createTemplate(loginTemplate);
        let $dialog = loginDialogTmpl.renderToJQ({username: username, password: password});
        let $error = $dialog.find(".error");
        let $login = $dialog.find(".login");
        let $cancel = $dialog.find(".cancel");
        let $password = $dialog.find(".password");
        let $close = $dialog.find(".window-header-button-close");
        let controller = {
            close: () => {
                $dialog.remove();
            },
            showInputError: (error: string) => {
                $error.removeClass("hide").html(error);
            },
            hideInputError: () => {
                $error.addClass("hide").html("");
            },
            startProcessing: () => {
                $login.find(".icon-holder").html('<i class="fa fa-spin fa-circle-o-notch"></i>');
            },
            updateProcessing: () => {
                $login.find(".icon-holder").html('<i class="fa fa-spin fa-circle-o-notch"></i>');
            },
            stopProcessing: () => {
                $login.find(".icon-holder").html('');
            }
        };
        let getResult = (result: string): app.InteractiveModal => {
            return {
                result: result,
                value: <string>$password.val(),
                checked: false,
                close: controller.close,
                showInputError: controller.showInputError,
                hideInputError: controller.hideInputError,
                startProcessing: controller.startProcessing,
                updateProcessing: controller.updateProcessing,
                stopProcessing: controller.stopProcessing
            };
        };
        $login.on("click", () => {
            callback(getResult("ok"));
        });
        $cancel.on("click", () => {
            callback(getResult("close"));
        });
        $password.on("keydown", event => {
            if (event.keyCode == 13) {
                event.preventDefault();
                callback(getResult("ok"));
            }
        });
        $close.on("click", () => {
            callback(getResult("close"));
        });
        $main.append($dialog);
        $password.focus();
        return $dialog;
    }
}
$(() => {
    let init = new Initializer(<InitializerOptions><any>window);
    if (init.isDevMode() || init.testMode) {
        init.options.init = init;
    }
    init.start();
});
