import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {app} from "../../Types";
import {Inject} from "../../utils/Decorators"
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {}

export class ClearCacheWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.admin.clearCache.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.minimizable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 400;
        this.openWindowOptions.height = 210;
        this.openWindowOptions.title = this.i18n("window.admin.clearCache.title");
        this.openWindowOptions.icon = "icon fa fa-certificate";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
    }
    
    init(): Q.Promise<void> {
        return;
    }
    
    getModel(): Model {
        return null;
    }
        
    onViewClearCache(inputData: string): Q.Promise<void> {
        if (!inputData) {
            return;
        }
        this.callViewMethod("onClearCacheResults", "loading");
        
        return this.addTaskEx("Wait...", true, () => {
            return this.clearCache(inputData).then((result:boolean) => {
                this.callViewMethod("onClearCacheResults", result, inputData);
            })
            .catch(e => {
                this.logError(e);
            });
        });
    }
    
    
    clearCache(domain:string):Q.Promise<boolean> {
        return this.srpSecure.request("clearPkiCache", {domain});
    }
        
    onViewClose(): void {
        this.close();
    }
}
