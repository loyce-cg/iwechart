import {TemplateManager} from "./template/Manager";
import {Helper} from "./template/Helper";
import {Initializer} from "../app/browser/Initializer";
import * as $ from "jquery";

export class IndexViewHelper extends Helper {
            
    app: Initializer;
    initialized: boolean;
    
    constructor(framework: TemplateManager, app: Initializer) {
        super(framework);
        this.app = app;
        this.app.localeService.changeEvent.add(this.onLangChange.bind(this));
    }
    
    i18n(key: string, ...args: any[]): string {
        return this.app.localeService.i18n.apply(this.app.localeService, arguments);
    }
    
    i18nEx(key: string, ...args: any[]): string {
        return '<span data-i18n="' + key + '">' + this.app.localeService.i18n.apply(this.app.localeService, arguments) + '</span>';
    }
    
    getTaskName(taskName: string): string {
        return this.app.localeService.getTaskName(taskName);
    }
    
    onLangChange() {
        if (this.initialized) {
            $("[data-i18n]").each((idx, elem) => {
                let $elem = $(elem);
                let key = $elem.data("i18n");
                $elem.text(this.app.localeService.i18n(key));
            });
        }
        else {
            this.initialized = true;
            $("body").append(this.app.mainTemplate.renderToJQ());
        }
    }
    
    version(): string {
        return this.app.version.str;
    }
    
    getAsset(url: string): string {
        return this.app.assetsManager.getAsset(url);
    }
    
    getAssetByName(name: string): string {
        return this.app.assetsManager.getAssetByName(name);
    }
    
    isDemo(): boolean {
        return this.app.isDemo();
    }
}
