import * as privfs from "privfs-client";
import * as Q from "q";
import { CommonApplication } from "..";
import { Session } from "../../../mail/session/SessionManager";
import { UploadServiceWindowController } from "../../../window/uploadservice/UploadServiceWindowController";
import { BaseWindowController } from "../../../window/base/BaseWindowController";

export interface UploadFileProgressEvent {
    type: "upload-file-progress-event";
    fileId: number;
    fileName: string;
    path: string;
    sectionName: string;
    mimeType: string;
    progress: Progress;
    status: FileToUploadStatus;
    allItemsTotalProgress: number;
    createdTime: number;
}

export interface UploadFileCancelEvent {
    type: "upload-file-cancel-event";
    fileId: number;
}
export interface UploadFileRetryEvent {
    type: "upload-file-retry-event";
    fileId: number;
}

export interface FileToUpload {
    content: privfs.lazyBuffer.IContent;
    session: Session;
    destination: string;
    path?: string;
}

export interface Progress {
    count: number;
    total: number;
    percent: number;
}

export type FileToUploadStatus = "wait" | "in-progress" | "done" | "aborted";

interface FileToUploadWithProgress extends FileToUpload {
    fileId: number;
    progress: Progress;
    status: FileToUploadStatus;
    uploadPromise: Q.Promise<any>;
    fileOptions: privfs.types.descriptor.DNVKOptions;
    createdTime: number;
    updateProgress(progress: Progress): void;
}

export class UploadService {
    readonly MAX_PARALLEL_UPLOADS: number = 2;
    readonly CHECK_INTERVAL: number = 200;

    static uploadFileId: number = 0;
    openWindowPromise: Q.Promise<void>;

    static getNextFileId(): number {
        return (++UploadService.uploadFileId);
    }

    filesToUpload: FileToUploadWithProgress[] = [];
    activeUploads: number;
    uploadsQueueCheckInterval: NodeJS.Timer;
    eventsListenersRegistered: boolean = false;

    constructor(public app: CommonApplication) {
        this.activeUploads = 0;
    }

    addFile(fileToUpload: FileToUpload) {   
        this.registerItemActionsEventsListeners();
            let f: FileToUploadWithProgress = {
                fileId: UploadService.getNextFileId(),
                content: fileToUpload.content,
                destination: fileToUpload.destination,
                path: fileToUpload.path ? fileToUpload.path : "/",
                session: fileToUpload.session,
                status: "wait",
                createdTime: Date.now(),
                fileOptions: {
                    streamOptions: {
                        cancel: false
                    }
                },
                progress: {count: 0, total: 0, percent: 0},
                uploadPromise: Q(),
                updateProgress: (progress: Progress) => {
                    f.progress = progress;
                }
            }
            this.filesToUpload.push(f);
            
            if (this.openWindowPromise && this.openWindowPromise.isFulfilled() == false) {
                return this.openWindowPromise.then(() => {
                    this.emitProgressEvent(f);
                })
            }
            else {
                this.openWindowPromise = this.bringUploadWindow().then(() => {
                    this.updateUploadQueueChecker();
                    this.openWindowPromise = null;
                    this.emitProgressEvent(f);
                })
            }
    }

    processUpload() {
        if (this.hasWaitingUploads()) {
            if (this.canStartUpload()) {
                this.activeUploads ++;
                let f = this.getNextToUpload();
                f.status = "in-progress";
                f.uploadPromise = f.session.sectionManager.uploadFile({
                    data: f.content, 
                    destination: f.destination,
                    path: f.path || "/",
                    fileOptions: f.fileOptions
                })
                .then(result => {
                    f.status = "done";
                    this.activeUploads --;
                })
                .progress(progress => {
                    f.updateProgress(progress);
                    // this.emitProgressEvent(f);
                })
                .catch(ex => {
                    this.cancelUpload(f.fileId);
                })
                .fin(() => {
                    this.updateUploadQueueChecker();
                    this.emitProgressEvent(f);
                })   
            }
        }
        if (this.hasUploadsInProgress()) {
            this.getUploadsInProgress().forEach(x => {
                this.emitProgressEvent(x);
            })
        }
    }

    canStartUpload(): boolean {
        return this.activeUploads < this.MAX_PARALLEL_UPLOADS;
    }

    getNextToUpload(): FileToUploadWithProgress {
        return this.filesToUpload.filter(x => x.status == "wait")[0];
    }

    hasWaitingUploads(): boolean {
        return this.filesToUpload.filter(x => x.status == "wait").length > 0;
    }

    hasUploadsInProgress(): boolean {
        return this.filesToUpload.filter(x => x.status == "in-progress").length > 0;
    }

    getUploadsInProgress(): FileToUploadWithProgress[] {
        return this.filesToUpload.filter(x => x.status == "in-progress");
    }

    getUploadById(fileId: number): FileToUploadWithProgress {
        return this.filesToUpload.find(x => x.fileId == fileId);
    }


    updateUploadQueueChecker(): void {
        if (! this.hasWaitingUploads() && ! this.hasUploadsInProgress()) {
            clearInterval(this.uploadsQueueCheckInterval);
            this.uploadsQueueCheckInterval = null;
            return;
        }

        if ( ! this.uploadsQueueCheckInterval) {
            this.uploadsQueueCheckInterval = setInterval(() => this.processUpload(), this.CHECK_INTERVAL);
        }
    }

    createProgressEventObject(f: FileToUploadWithProgress): UploadFileProgressEvent {
        let sectionName = f.session.sectionManager.resolveSection(f.destination).getName();
        return {
            type: "upload-file-progress-event",
            progress: f.progress,
            status: f.status,
            fileId: f.fileId,
            fileName: f.content.getName(),
            path: f.path,
            createdTime: f.createdTime,
            sectionName: sectionName,
            mimeType: f.content.getMimeType(),
            allItemsTotalProgress: this.getTotalProgress()
        }
    }

    emitProgressEvent(f: FileToUploadWithProgress): void {
        this.app.eventDispatcher.dispatchEvent<UploadFileProgressEvent>(this.createProgressEventObject(f));
    }

    getTotalProgress(): number {
        let totalPercent: number = 0;
        let activeUploads: number = 0;
        this.filesToUpload.forEach(item => {
            if (item.status != "aborted") {
                totalPercent += item.status == "done" ? 100 : item.progress.percent;
                activeUploads++;    
            }
        })
        return activeUploads > 0 ? totalPercent / activeUploads: 100;
    }

    bringUploadWindow(): Q.Promise<BaseWindowController> {
        return this.app.openSingletonWindow("uploadService", UploadServiceWindowController);
    }

    registerItemActionsEventsListeners(): void {
        if (this.areActionsEventsListenersRegistered()) {
            return;
        }
        this.setEventsListenersRegistered(true);
        this.app.eventDispatcher.addEventListener<UploadFileCancelEvent>("upload-file-cancel-event", event => {
            this.cancelUpload(event.fileId);
        })
        this.app.eventDispatcher.addEventListener<UploadFileRetryEvent>("upload-file-retry-event", event => {
            this.retryUpload(event.fileId);
        })
    }

    areActionsEventsListenersRegistered(): boolean {
        return this.eventsListenersRegistered;
    }

    setEventsListenersRegistered(value: boolean): void {
        this.eventsListenersRegistered = value;
    }

    cancelUpload(fileId: number): void {
        let toCancel = this.getUploadById(fileId);
        if (toCancel && (toCancel.status == "in-progress" || toCancel.status == "wait")) {
            toCancel.fileOptions.streamOptions.cancel = true;
            toCancel.status = "aborted";
            this.activeUploads --;
        }
    }

    retryUpload(fileId: number): void {
        let fileItem = this.getUploadById(fileId);
        if (fileItem) {
            this.resetFileItemProgress(fileId);
            this.updateUploadQueueChecker();
        }
    }

    resetFileItemProgress(fileId: number): void {
        let fileItem = this.getUploadById(fileId);
        fileItem.fileOptions = {
            streamOptions: {
                cancel: false
            }
        };
        fileItem.progress = {count: 0, total: 0, percent: 0};
        fileItem.status = "wait";
    }

    getAllQueuedFiles(): UploadFileProgressEvent[] {
        return this.filesToUpload.map(x => this.createProgressEventObject(x));
    }

}