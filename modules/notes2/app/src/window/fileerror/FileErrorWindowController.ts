import {mail, window, Q, Types, privfs} from "pmc-mail";
import {Notes2Plugin} from "../../main/Notes2Plugin";
import {OperationType} from "../../main/Common";
import {Helper} from "../../main/Helper";
import { i18n } from "./i18n";

export interface Model {
    operationType: OperationType;
    error: number;
    dirNotEmptyError: boolean;
    source: {
        name: string;
        path: string;
    };
    destination: {
        name: string;
        path: string;
    };
}

export interface FCRResult {
    abort: boolean;
    retry: boolean;
}

export class FileErrorWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.fileerror.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    notes2Plugin: Notes2Plugin;
    defer: Q.Deferred<FCRResult>;
    
    constructor(parentWindow: Types.app.WindowParent, public model: Model) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("notes2");
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.openWindowOptions = {
            modal: true,
            toolbar: false,
            show: false,
            position: "center",
            width: 440,
            height: 350,
            widget: false,
            draggable: false,
            resizable: false,
            title: this.i18n("plugin.notes2.window.fileerror.title")
        };
        this.defer = Q.defer<FCRResult>();
    }
    
    getPromise() {
        return this.defer.promise;
    }
    
    getModel(): Model {
        return this.model;
    }
    
    beforeClose(): Q.IWhenable<void> {
        this.defer.resolve({
            abort: true,
            retry: false
        });
    }
    
    onViewAbort() {
        this.close();
    }
    
    onViewOmit() {
        this.defer.resolve({
            abort: false,
            retry: false
        });
        this.close();
    }
    
    onViewRetry() {
        this.defer.resolve({
            abort: false,
            retry: true
        });
        this.close();
    }
    
    static convertModel(result: privfs.fs.file.multi.OperationResult): Model {
        let model: Model = {
            operationType: Helper.convertOperationType(result.operation.type),
            error: result.status,
            dirNotEmptyError: result.status == privfs.fs.file.multi.OperationStatus.DIRECTORY_NOT_EMPTY,
            source: {
                name: mail.filetree.Path.parsePath(result.operation.source.path).name.original,
                path: result.operation.source.path
            },
            destination: result.operation.destination ? {
                name: mail.filetree.Path.parsePath(result.operation.destination.path).name.original,
                path: result.operation.destination.path
            } : null
        };
        return model;
    }
}
