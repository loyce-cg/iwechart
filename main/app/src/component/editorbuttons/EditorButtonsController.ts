import * as privfs from "privfs-client";
import {BaseWindowController} from "../../window/base/BaseWindowController";
import {OpenableElement, ShellOpenAction} from "../../app/common/shell/ShellTypes";
import {NotificationController} from "../../component/notification/NotificationController";
import {WindowComponentController} from "../../window/base/WindowComponentController";
import * as Q from "q";
import * as shelltypes from "../../app/common/shell/ShellTypes";
import {SectionManager} from "../../mail/section/SectionManager";
import {Inject} from "../../utils/Decorators"
import { TaskChooserWindowController } from "../../window/taskchooser/main";
import { LocaleService, filetree } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";
import { OpenableSectionFile } from "../../mail/section";

export type EditorButtonsParent = BaseWindowController & {
    openableElement: OpenableElement;
    notifications: NotificationController;
    getButtonsState(): ButtonsState;
    lockFile(): Q.Promise<void>;
    unlockFile(): Q.Promise<void>;
    isFileLocked(): Q.Promise<boolean>;
    canUnlockFile(): Q.Promise<boolean>;
    saveBeforePrinting?(): Q.Promise<void>;
}

export interface ButtonsState {
    enabled: boolean;
    edit: boolean;
    export: boolean;
    send: boolean;
    attachToTask: boolean;
    openExternal: boolean;
    close: boolean;
    print: boolean;
    saveAsPdf: boolean;
    lock: boolean;
    unlock: boolean;
    systemLabel?: string;
}

export class EditorButtonsController extends WindowComponentController<EditorButtonsParent> {
    
    static textsPrefix: string = "component.editorButtons.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    // @Inject sectionManager: SectionManager;
    
    isPrinting: boolean;
    isSavingAsPdf: boolean;
    isExporting: boolean;
    session: Session;

    constructor(parent: EditorButtonsParent) {
        super(parent);
        this.ipcMode = true;
    }

    setSession(session: Session): void {
        this.session = session;
    }
    
    getModel(): ButtonsState {
        let bstate = this.parent.getButtonsState();
        if (this.app.isElectronApp()) {
            bstate.systemLabel = (<any>this.app).getSystemLabel();
        }
        return bstate;
    }
    
    getDefaultButtonsState(): ButtonsState {
        
        return {
            enabled: true,
            edit: this.parent.openableElement ? this.parent.openableElement.isEditable() : false,
            export: this.parent.openableElement && this.parent.openableElement.isLocalFile() ? false : true,
            send: true,
            attachToTask: true,
            openExternal: this.canOpenExternal(),
            close: false,
            print: false,
            saveAsPdf: false,
            lock: true,
            unlock: false,
        };
    }
    
    canOpenExternal(): boolean {
        let isLocalFile = this.parent.openableElement ? this.parent.openableElement.isLocalFile() : false;
        let mime = this.parent.openableElement ? this.parent.openableElement.getMimeType() : null;
        if (!this.app.isElectronApp() || isLocalFile) {
            return false;
        }
        if (mime == "application/x-stt" || mime == "application/x-smm" || mime == "application/x-svv" || mime == "application/x-saa") {
            return false;
        }
        return true;
    }
    
    onViewClose(): void {
        this.parent.close();
    }
    
    onViewExport() {
        if (this.isExporting || this.parent.openableElement == null) {
            return;
        }
        this.isExporting = true;
        let notificationId = this.parent.notifications.showNotification(this.i18n("component.editorButtons.exporintg"), {autoHide: false, progress: true});
        Q().then(() => {
            return this.app.directSaveContent(this.parent.openableElement, this.session, this.parent.getClosestNotDockedController());
        })
        .progress(progress => {
            this.parent.notifications.progressNotification(notificationId, progress);
        })
        .catch(e => {
            if (e !== "no-choose") {
               this.parent.getLogger().warn("Error during downloading", e); 
            }
        })
        .fin(() => {
            this.parent.notifications.hideNotification(notificationId);
            this.isExporting = false;
        });
    }
    
    onViewOpenExternal(): void {
        if (this.parent.openableElement == null) {
            return;
        }
        this.app.shellRegistry.shellOpen({
            action: ShellOpenAction.EXTERNAL,
            element: this.parent.openableElement,
            parent: this.parent.getClosestNotDockedController(),
            session: this.session
        });
    }
    
    onViewPrint() {
        if (this.isPrinting || this.parent.openableElement == null) {
            return;
        }
        this.isPrinting = true;
        let notificationId = this.parent.notifications.showNotification(this.i18n("component.editorButtons.printing"), {autoHide: false, progress: true});
        Q().then(() => {
            return this.app.print(this.session, this.parent.openableElement);
        })
        .then(printed => {
            if (printed) {
                setTimeout(() => {
                    this.parent.notifications.showNotification(this.i18n("component.editorButtons.printed"));
                }, 500);
            }
        })
        .fin(() => {
            this.parent.notifications.hideNotification(notificationId);
            this.isPrinting = false;
        });
    }
    
    onViewSaveAsPdf(): void {
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        if (this.parent.openableElement) {
            this.isSavingAsPdf = true;
            this.parent.saveBeforePrinting().then(() => {
                let notificationId = this.parent.notifications.showNotification(this.i18n("window.mindmapeditor.notifier.savingAsPdf"), {autoHide: false, progress: true});
                let parentController = this.parent.getClosestNotDockedController();
                let parent = parentController ? parentController.nwin : null;
                this.app.saveAsPdf(this.session, this.parent.openableElement, parent)
                .then(() => {
                    setTimeout(() => {
                        this.parent.notifications.showNotification(this.i18n("window.mindmapeditor.notifier.savedAsPdf"));
                    }, 500);
                })
                .fin(() => {
                    this.parent.notifications.hideNotification(notificationId);
                    this.isPrinting = false;
                })
                .fail(() => {
                    // Cancelled by user
                });
            })
            .fin(() => {
                this.isSavingAsPdf = false;
            });
        }
    }
    
    onViewPdfOutput(data: string) {
        let buffer = new Buffer(data, "binary");
        let fileName = filetree.Path.splitFileName(this.parent.openableElement ? this.parent.openableElement.getName() : "document.stt").name + ".pdf";
        let content = privfs.lazyBuffer.Content.createFromBuffer(buffer, "application/pdf", fileName);
        this.app.directSaveContent(content, this.session);
        this.parent.onViewSavedAsPdf();
    }
    
    onViewEdit(): void {
        if (this.parent.openableElement) {
            this.parent.app.shellRegistry.shellOpen({
                action: shelltypes.ShellOpenAction.OPEN,
                element: this.parent.openableElement,
                parent: this.parent.getClosestNotDockedController(),
                session: this.session
            });
        }
    }
    
    onViewSend(): void {
        if (this.parent.openableElement) {
            let sourceSectionId: string = null;
            let sourcePath: string = null;
            let sourceDid: string = null;
            if ((this.parent.openableElement instanceof OpenableSectionFile) && this.parent.openableElement.section) {
                sourceSectionId = this.parent.openableElement.section.getId();
                sourcePath = this.parent.openableElement.path;
                sourceDid = this.parent.openableElement.handle.ref.did;
            }
            this.app.sendFile({
                getData: () => this.parent.openableElement.getSliceableContent(),
                notifications: this.parent.notifications,
                parent: this.parent.getClosestNotDockedController(),
                sourceSectionId: sourceSectionId,
                sourcePath: sourcePath,
                sourceDid: sourceDid,
            });
        }
    }
    
    onViewAttachToTask(): void {
        this.attachToTask();
    }
    
    attachToTask(handle: privfs.fs.descriptor.Handle = null): void {
        if (this.parent.openableElement) {
            if ((<any>this.parent.openableElement).openableElementType == "LocalOpenableElement") {
                let tasksPlugin = this.app.getComponent("tasks-plugin");
                TaskChooserWindowController.attachLocalFileToTask(this.parent.getClosestNotDockedController(), this.session, tasksPlugin, this.parent.openableElement, this.parent.notifications);
            }
            else {
                this.session.sectionManager.getFileOpenableElement(this.parent.openableElement.getElementId(), false).then(file => {
                    let resolved = this.session.sectionManager.resolveFileId(file.getElementId());
                    let section = resolved.section;
                    let tasksModule = section.getKvdbModule();
                    let tasksPlugin = this.app.getComponent("tasks-plugin");
                    if (!tasksModule || !tasksPlugin) {
                        return null;
                    }
                    TaskChooserWindowController.attachFileToTask(this.parent.getClosestNotDockedController(), this.session, tasksPlugin, section, file, handle);
                });
            }
        }
    }
    
    onViewUnlock(): void {
        this.parent.unlockFile()
    }

    onViewLock(): void {
        this.parent.lockFile()
    }
    

    refreshButtonsState(): void {
        this.callViewMethod("setModel", JSON.stringify(this.getModel()));
    }

    updateLockState(locked: boolean, canUnlock: boolean = false): void {
        this.callViewMethod("updateLockState", locked, canUnlock);
    }
    
}