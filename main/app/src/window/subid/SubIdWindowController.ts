import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import * as Q from "q";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    mnemonic: string;
    host: string;
}

export class SubIdWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.subid.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    model: Model;
    deferred: Q.Deferred<void>;
    
    constructor(parent: app.WindowParent, model: Model) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.model = model;
        this.deferred = Q.defer();
        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = 450;
        this.openWindowOptions.height = 312;
        this.openWindowOptions.modal = true;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = false;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.title = this.i18n("window.subid.title");
    }
    
    getModel(): Model {
        return this.model;
    }
    
    onViewClose() {
        this.deferred.resolve();
        this.close();
    }
    
    getPromise(): Q.Promise<void> {
        return this.deferred.promise;
    }
}
