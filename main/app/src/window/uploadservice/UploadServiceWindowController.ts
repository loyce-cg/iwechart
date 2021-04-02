import {BaseWindowController} from "../base/BaseWindowController";
import * as Utils from "simplito-utils";
import * as Q from "q";
import {app, webUtils} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Window } from "../../app/common/window";
import { UploadFileProgressEvent, UploadFileCancelEvent, UploadFileRetryEvent, UploadFileCancelAllEvent } from "../../app/common/uploadservice/UploadService";
import { ExtListController } from "../../component/extlist/main";
import { MutableCollection } from "../../utils/collection/MutableCollection";
import { SortedCollection } from "../../utils/collection";

export interface MsgBoxActionOptions {
    type?: string;
    result?: string;
    timeout?: number;
}


export interface UploadServiceOptions {
    showInactive?: boolean;
    alwaysOnTop?: boolean;
    width?: number;
    height?: number;
    title?: string;
    focusOn?: string;
    autoHeight?: boolean;
}

export interface ActionResult {
    ok?: boolean;
    cancel?: boolean;
}

export interface UploadFileItem extends UploadFileProgressEvent {
    icon: string;
}

export class UploadServiceWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.uploadservice.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    createElementFromEvent(event: UploadFileProgressEvent): UploadFileItem {
        if (! this.app) {
            return;
        }
        if (! event) {
            return;
        }
        let el: any = {};
        for (let key in event) {
            el[key] = (<any>event)[key]
        }
        el.icon = this.app.shellRegistry.resolveIcon(event.mimeType);
        return (el as UploadFileItem);
    }

    options: UploadServiceOptions;
    deferred: Q.Deferred<ActionResult>;
    result: string;
    preventClose: boolean;
    collection: MutableCollection<UploadFileItem>;
    sortedCollection:  SortedCollection<UploadFileItem>;
    filesList: ExtListController<UploadFileItem>;

    constructor(parent: app.WindowParent, options: UploadServiceOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.setViewBasicFonts();
        this.options = Utils.fillByDefaults(options, {
            width: 420,
            minWidth: 350,
            height: 400,
            title: this.app.localeService.i18n("window.uploadservice.completed"),
            focusOn: "",
        });
        this.ipcMode = true;

        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = this.options.width;
        this.openWindowOptions.height = this.options.height;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = true;
        this.openWindowOptions.resizable = true;

        this.collection = this.addComponent("mutableCollection", new MutableCollection([]));
        this.sortedCollection = this.addComponent("sortedCollection", new SortedCollection<UploadFileItem>(this.collection, (a, b) => {
            // if (a.status != b.status && (a.status == "in-progress")) {
            //     return -1;
            // }
            // if (a.status != b.status && (b.status == "in-progress")) {
            //     return 1;
            // }
            // return b.createdTime - a.createdTime;
            return 0;
        }));
        
        this.filesList = this.addComponent("filesList", this.componentFactory.createComponent("extlist", [this, this.sortedCollection]));
        this.filesList.ipcMode = true;
        this.renderFilesListFromService();
        this.deferred = Q.defer<ActionResult>();
    }
    
    bindToEvents(): void {
        this.bindEvent<UploadFileProgressEvent>(this.app, "upload-file-progress-event", event => {
            this.onNewProgressEvent(event);
        })
    }

    onNewProgressEvent(event: UploadFileProgressEvent): void {
        let idx: number = -1;
        let element = this.collection.find((x, i) => {
            if (x.fileId == event.fileId) {
                idx = i;
                return true;
            }
            else {
                return false;
            }
        })
        let newElement = this.createElementFromEvent(event);
        if (element && idx > -1) {
            if (element.progress.percent != newElement.progress.percent || element.status != newElement.status) {
                this.collection.setAt(idx, newElement);
                this.collection.triggerUpdateElement(newElement);
                this.updateTotalProgress(event.allItemsTotalProgress);        
            }
        }
        else {
            this.collection.add(newElement);
            this.updateTotalProgress(event.allItemsTotalProgress);    

        }
    }

    renderFilesListFromService(): void {
        let files = this.app.uploadService.getAllQueuedFiles();
        for (let file of files) {
            this.onNewProgressEvent(file);
        }    
    }

    onViewLoad(): void {
        this.renderFilesListFromService();
        this.bindToEvents();
    }

    updateTotalProgress(progress: number): void {
        this.callViewMethod("updateTotalProgress", progress);
    }

    getModel(): UploadServiceOptions {
        let options: any = {};
        for (let key in options) {
            let value = (<any>options)[key];
            if (typeof(value) != "function") {
                options[key] = value;
            }
        }
        return this.options;
    }
    
    
    getPromise(): Q.Promise<ActionResult> {
        return this.deferred.promise;
    }

    onViewCancelFileUpload(fileId: number): void {
        this.app.eventDispatcher.dispatchEvent<UploadFileCancelEvent>({type: "upload-file-cancel-event", fileId: fileId});
    }

    onViewCancelAllUploads(): void {
        this.app.eventDispatcher.dispatchEvent<UploadFileCancelAllEvent>({type: "upload-file-cancel-all-event"});
    }


    onViewRetryFileUpload(fileId: number): void {
        this.app.eventDispatcher.dispatchEvent<UploadFileRetryEvent>({type: "upload-file-retry-event", fileId: fileId});
    }

    onViewOpenFile(fileId: number): void {

    }

    beforeClose(): void {
        this.app.uploadService.clearAllFinishedUploads();
    }

    onViewClose(): void {
        this.close();
    }
}
