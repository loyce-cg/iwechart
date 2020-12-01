import {mail, window, Q, Types, privfs, app} from "pmc-mail";
import {Notes2Plugin} from "../../main/Notes2Plugin";
import {ConflictType, OperationType} from "../../main/Common";
import {Helper} from "../../main/Helper";
import { i18n } from "./i18n";

export interface Model {
    conflictType: ConflictType;
    operationType: OperationType;
    source: {
        name: string;
        path: string;
        icon: string;
    };
    destination: {
        name: string;
        path: string;
        icon: string;
    };
}

export interface FCRResult {
    abort: boolean;
    behaviour: boolean;
    forAll: boolean;
}

export class FileConflictResolverWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.fileconflictresolver.";
    
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
            width: 500,
            height: 400,
            widget: false,
            draggable: false,
            resizable: false,
            title: this.i18n("plugin.notes2.window.fileconflictresolver.title")
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
            behaviour: null,
            forAll: false
        });
    }
    
    onViewAbort() {
        this.close();
    }
    
    onViewOmit(forAll: boolean) {
        this.defer.resolve({
            abort: false,
            behaviour: false,
            forAll: forAll
        });
        this.close();
    }
    
    onViewOverwrite(forAll: boolean) {
        this.defer.resolve({
            abort: false,
            behaviour: true,
            forAll: forAll
        });
        this.close();
    }
    
    static convertModel(result: privfs.fs.file.multi.OperationResult, app: app.common.CommonApplication): Model {
        let conflictType = Helper.convertConflictType(result.status);
        let dstIsFolder = conflictType == ConflictType.DIRECTORIES_MERGE || conflictType == ConflictType.DIRECTORY_OVERWRITE_BY_FILE;
        let srcIsFolder = conflictType == ConflictType.DIRECTORIES_MERGE || conflictType == ConflictType.FILE_OVERWRITE_BY_DIRECTORY;
        let model: Model = {
            conflictType: conflictType,
            operationType: Helper.convertOperationType(result.operation.type),
            source: {
                name: mail.filetree.Path.parsePath(result.operation.source.path).name.original,
                path: result.operation.source.path,
                icon: srcIsFolder ? "fa fa-folder" : app.shellRegistry.resolveIcon(mail.filetree.MimeType.resolve(result.operation.source.path)),
            },
            destination: {
                name: mail.filetree.Path.parsePath(result.operation.destination.path).name.original,
                path: result.operation.destination.path,
                icon: dstIsFolder ? "fa fa-folder" : app.shellRegistry.resolveIcon(mail.filetree.MimeType.resolve(result.operation.destination.path)),
            }
        };
        return model;
    }
}
