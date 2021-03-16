import {app} from "../../Types";
import {InitializerAssets} from "../browser/Initializer";
import {Lang} from "../../utils/Lang";

export interface UrlAssetSpec {
    url: string
}

export type PathAssetSpec = {
    path: string;
    plugin?: string;
}

export type AssetSpec = UrlAssetSpec|PathAssetSpec;
export type AssetSpecEx = AssetSpec&{type: "script" | "style"};

export class SimplePluginConfigProvider implements app.PluginConfigProvider {
    
    constructor(public data: app.PluginConfig[]) {
    }
    
    getPluginConfig(pluginName: string): app.PluginConfig {
        return Lang.find(this.data, x => x.name == pluginName);
    }
}

export class AssetsManager {
    
    assets: {[name: string]: {default: boolean, url: string}};
    
    constructor(
        public rootUrl: string,
        public pluginRootUrl: string,
        public pluginConfigProvider: app.PluginConfigProvider
    ) {
        this.assets = {};
    }
    
    init(assetsSource: InitializerAssets) {
        // defaults
        this.setDefaultAssetByName("CUSTOM_LOGO_127X112_ORIG", "themes/default/images/logotype.svg", true);
        this.setDefaultAssetByName("CUSTOM_LOGO_127X112_WH_ORIG", "", false);
        this.setDefaultAssetByName("CUSTOM_LOGO_87X22_ORIG", "themes/default/images/logo.svg", true);
        this.setDefaultAssetByName("CUSTOM_LOGO_87X22_WH_ORIG", "themes/default/images/logo-wh.svg", true);
        this.setDefaultAssetByName("CUSTOM_LOGO_127X112", "themes/default/images/logotype.svg", true);
        this.setDefaultAssetByName("CUSTOM_LOGO_127X112_WH", "", false);
        this.setDefaultAssetByName("CUSTOM_LOGO_87X22", "themes/default/images/logo.svg", true);
        this.setDefaultAssetByName("CUSTOM_LOGO_87X22_WH", "themes/default/images/logo-wh.svg", true);
        this.setDefaultAssetByName("CUSTOM_LOGO_CUSTOM_FORM", "themes/default/images/logo-bl.png", true);
        
        this.setDefaultAssetByName("DEFAULT_USER_AVATAR", "icons/user-default.png", true);
        this.setDefaultAssetByName("DEFAULT_EMAIL_AVATAR", "icons/email-default.png", true);
        this.setDefaultAssetByName("DEFAULT_EMAIL_AVATAR_INVERSE", "icons/email-default-inverse.png", true);
        this.setDefaultAssetByName("DEFAULT_PRIVMX_ICON", "icons/app-icon-wh.svg", true);
        this.setDefaultAssetByName("DEFAULT_TEAMSERVER_ICON", "themes/default/images/teamserver.svg", true);
        
        this.setDefaultAssetByName("ADMIN_MENU_LOGO", "themes/default/images/logo-wh.svg", true);
        this.setDefaultAssetByName("SYSINFO_LOGO", "themes/default/images/logotype-wh.svg", true);
        this.setDefaultAssetByName("ABOUT_LOGO", "themes/default/images/logotype.svg", true);
        
        this.setDefaultAssetByName("LICENCE", "assets/licence.pdf", true);
        
        // custom
        if (assetsSource.CUSTOM_LOGO_127X112) {
            this.setAssetByName("CUSTOM_LOGO_127X112", assetsSource.CUSTOM_LOGO_127X112, false);
            this.setAssetByName("CUSTOM_LOGO_127X112_WH", assetsSource.CUSTOM_LOGO_127X112, false);
        }
        if (assetsSource.CUSTOM_LOGO_87X22) {
            this.setAssetByName("CUSTOM_LOGO_87X22", assetsSource.CUSTOM_LOGO_87X22, false);
        }
        if (assetsSource.CUSTOM_LOGO_87X22_WH) {
            this.setAssetByName("CUSTOM_LOGO_87X22_WH", assetsSource.CUSTOM_LOGO_87X22_WH, false);
        }
        if (assetsSource.CUSTOM_LOGO_CUSTOM_FORM) {
            this.setAssetByName("CUSTOM_LOGO_CUSTOM_FORM", assetsSource.CUSTOM_LOGO_CUSTOM_FORM, false);
        }
    }
    
    
    setDefaultAssetByName(name: string, url: string, relative: boolean): void {
        if (this.assets[name] == null || this.assets[name].default) {
            this.assets[name] = {default: true, url: (relative ? this.rootUrl : "") + url};
        }
    }
    
    setAssetByName(name: string, url: string, relative: boolean): void {
        this.assets[name] = {default: false, url: (relative ? this.rootUrl : "") + url};
    }

    setAssetDataUriByName(name: string, dataUri: string): void {
        this.assets[name] = {default: false, url: dataUri};
    }

    
    getAssetByName(name: string): string {
        let asset = this.assets[name] ? this.assets[name].url : "";
        if (name == "MY_AVATAR" && asset.length == 0) {
            asset = this.getAssetByName("DEFAULT_USER_AVATAR");
        }
        return asset;
    }
    
    getAsset(path: string, excludeFilePrefix?: boolean): string {
        const filePrefix = "file://";
        if (excludeFilePrefix && this.rootUrl.indexOf(filePrefix) > -1) {
            return this.rootUrl.substring(filePrefix.length, this.rootUrl.length) + path;
        }
        return this.rootUrl + path;
    }
    
    getPluginAsset(pluginName: string, path: string): string {
        let plugin = this.pluginConfigProvider.getPluginConfig(pluginName);
        if (plugin == null) {
            throw new Error("Error during resolving asset '" + path + "' from plugin '" + pluginName + "' - plugin is not registered");
        }
        return this.pluginRootUrl + "plugins/" + plugin.name + "/client/" + plugin.buildId + "/" + path;
    }
    
    getAssetEx(spec: AssetSpec) {
        if ("url" in spec) {
            return (<UrlAssetSpec>spec).url;
        }
        let pathSpec = (<PathAssetSpec>spec);
        return pathSpec.plugin ? this.getPluginAsset(pathSpec.plugin, pathSpec.path) : this.getAsset(pathSpec.path);
    }
}