import {BaseWindowController} from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app, event, section} from "../../Types";
import { OpenableElement, OpenableFile } from "../../app/common/shell/ShellTypes";
import { Formatter } from "../../utils/Formatter";
import { NotificationController } from "../../component/notification/NotificationController";
import { BaseWindowManager } from "../../app/BaseWindowManager";
import * as shelltypes from "../../app/common/shell/ShellTypes";
import { Dependencies } from "../../utils/Decorators";
import { TaskChooserWindowController } from "../taskchooser/TaskChooserWindowController";
import { TaskChooserController } from "../../component/taskchooser/TaskChooserController";
import { TaskTooltipController } from "../../component/tasktooltip/TaskTooltipController";
import { OpenableSectionFile } from "../../mail/section";
import { Tree, Entry } from "../../mail/filetree/NewTree";
import { PersonsController } from "../../component/persons/PersonsController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";
import { ThumbsManager } from "../../mail/thumbs/ThumbsManager";

export interface Options {
    docked?: boolean;
    name?: string;
    imageBuffers?: Buffer[];
    openableElement?: OpenableElement,
    editMode?: boolean;
}

export type ScreenshotResult = privfs.lazyBuffer.IContent;

export interface Model {
    docked: boolean;
    name: string;
    image: string;
    iconsPath: string;
    fileName: string;
    editMode: boolean;
    boundTasksStr: string;
}

export interface NotificationEntryOptions {
    autoHide?: boolean;
    progress?: boolean;
}

@Dependencies(["notification"])
export class ImageEditorWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.imageeditor.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    name: string;
    docked: boolean;
    imageBuffers: Buffer[];
    mimeType: string;
    openableElement: OpenableElement;
    deferred: Q.Deferred<ScreenshotResult>;
    notificationId: number;
    currentFileName: string;
    personsComponent: PersonsController;
    notifications: NotificationController;
    taskTooltip: TaskTooltipController;
    taskChooser: TaskChooserController;
    tasksPlugin: any;
    fileTree: Tree = null;
    handle: privfs.fs.descriptor.Handle = null;
    editMode: boolean = false;
    releasingLock: boolean = false;
    lockInterval: NodeJS.Timer = null;
    isPrinting: boolean = false;
    updatedFullFileName: string = null;
    attachToTaskLocked: boolean = false;
    isRenaming: boolean = false;
    documentSectionId: string;
    imageSizeDetected: boolean = false;
    
    constructor(parent: app.WindowParent, public session: Session, public options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.deferred = Q.defer();
        this.addViewScript({path: "build/tui/fabric-dist/dist/fabric.js"});
        this.addViewScript({path: "build/tui/tui-code-snippet/dist/tui-code-snippet.min.js"});
        
        this.addViewScript({path: "build/tui/tui-color-picker/dist/tui-color-picker.min.js"});
        this.addViewStyle({path: "build/tui/tui-color-picker/dist/tui-color-picker.min.css"});
        
        this.addViewScript({path: "build/tui/tui-image-editor/dist/tui-image-editor.js"});
        this.addViewStyle({path: "build/tui/tui-image-editor/dist/tui-image-editor.css"});
        this.addViewScript({path: "build/tui/tui-image-editor/examples/js/theme/black-theme.js"});
        this.addViewScript({path: "build/tui/tui-image-editor/examples/js/theme/white-theme.js"});
        this.openableElement = options.openableElement;
        const initialWindowSize = this.calculateAdaptiveWindowSize();
        this.openWindowOptions = {
            modal: false,
            maximized: this.options.editMode ? this.openWindowOptions.maximized : true,
            alwaysOnTop: !this.options.openableElement,
            showInactive: false,
            toolbar: false,
            maximizable: true,
            minimizable: true,
            show: false,
            position: "center-always",
            minWidth: 300,
            minHeight: 200,
            width: initialWindowSize.width,
            height: initialWindowSize.height,
            resizable: true,
            title: this.getTitle(),
            backgroundColor: "#1e1e1e",
            icon: this.app.shellRegistry.resolveIcon(options.openableElement ? options.openableElement.getMimeType() : "image/png"),
            preTitleIcon: this.getPreTitleIcon(),
        };
        this.imageBuffers = options.imageBuffers;
        
        let mimeType = options.openableElement ? options.openableElement.getMimeType() : "image/png";
        this.mimeType = mimeType == "image/png" || mimeType == "image/jpeg" ? mimeType : "image/png";
        
        if (this.openableElement) {
            this.currentFileName = this.openableElement.getName();
        }
        else {
            this.currentFileName = this.createNewFileName();
            this.setTitle(this.currentFileName);
        }
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            return this.tasksPlugin.getTaskTooltipContent(this.session, taskId);
        };
        this.taskChooser = this.addComponent("taskchooser", this.componentFactory.createComponent("taskchooser", <any>[this, this.app, {
            createTaskButton: false,
            includeTrashed: false,
            popup: true,
            session: this.session
        }]));
        let client = this.session.sectionManager.client;
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        
        this.enableTaskBadgeAutoUpdater();
        this.bindEvent<event.FileRenamedEvent>(this.app, "fileRenamed", event => {
            if (!this.openableElement) {
                return;
            }
            let newFullFileName: string = null;
            if (event.isLocal) {
                if (this.app.isElectronApp() && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
                    if (event.oldPath == this.openableElement.getElementId() || (this.updatedFullFileName && event.oldPath == this.updatedFullFileName)) {
                        newFullFileName = event.newPath;
                        (<any>this.openableElement).reopenRenamed(event.newPath.substr(event.newPath.lastIndexOf("/") + 1));
                    }
                }
            }
            else {
                if (this.openableElement instanceof OpenableSectionFile && (this.openableElement.path == event.oldPath || (this.updatedFullFileName && event.oldPath == this.updatedFullFileName))) {
                    
                    //TODO: edytor dostaje w parametrze session.. wiec czemu pobieramy na sztywno localSession?
                    let hostHash = event.hostHash || this.app.sessionManager.getLocalSession().hostHash;
                    if (hostHash == this.session.hostHash) {
                        newFullFileName = event.newPath;
                        let id = this.openableElement.id;
                        this.openableElement.name = event.newPath.substr(event.newPath.lastIndexOf("/") + 1);
                        this.openableElement.id = id.substr(0, id.indexOf("|/") + 2) + this.openableElement.name;
                        this.openableElement.path = newFullFileName;
                    }
                }
            }
            if (newFullFileName) {
                let newFileName: string = newFullFileName.substr(newFullFileName.lastIndexOf("/") + 1);
                this.updateFileName(newFileName, newFullFileName, this.getTitle(newFullFileName));
            }
        });
    }
    
    onViewDetectImageSize(width: number, height: number): void {
        if (this.imageSizeDetected) {
            return;
        }
        this.imageSizeDetected = true;
        if (!this.options.openableElement) {
            return;
        }
        if (this.nwin) {
            const windowSize = this.calculateAdaptiveWindowSize(width, height, undefined, undefined, true);
            this.nwin.setInnerSize(windowSize.width + 22, windowSize.height + 121);
            this.nwin.center();
        }
    }
    
    getModel(): Model {
        return {
            docked: this.docked,
            name: this.name,
            image: this.app.assetsManager.getAsset("icons/app-icon.png"),
            iconsPath: this.app.assetsManager.getAsset("icons/tui-editor"),
            fileName: this.currentFileName,
            editMode: this.options.editMode,
            boundTasksStr: this.getBoundTasksStr(),
        };
    }
    
    init(): Q.IWhenable<void> {
        return Q().then(() => {
            return super.init();
        })
        .then(() => {
            if (this.openableElement && this.openableElement instanceof OpenableSectionFile) {
                let osf = (<OpenableSectionFile>this.openableElement);
                this.documentSectionId = osf.section.getId();
                if (osf.section) {
                    return osf.section.getFileTree();
                }
            }
        }).then(tree => {
            this.fileTree = tree;
        });
    }
    
    onStorageEvent(event: privfs.types.descriptor.DescriptorNewVersionEvent): void {
        if (event.type == "descriptor-new-version" && this.openableElement && (<any>this.openableElement).handle && event.descriptor.ref.id == (<any>this.openableElement).handle.ref.id) {
            this.callViewMethod("setBoundTasksStr", this.getBoundTasksStr());
        }
    }
    
    createNewFileName(): string {
        let formatter = new Formatter();
        let dateString = formatter.standardDate(new Date());
        return "screenshot-"+dateString.replace(/:/g, "-").replace(/ /g, "-")+".png";
    }
    
    onViewLoad(): void {
        if (this.options.editMode && this.openableElement) {
            this.openFileForEditingOrPreview();
        }
        else if (this.options.imageBuffers) {
            setTimeout(() => {
                this.callViewMethod("updateImage", this.imageBuffers, this.mimeType);
            }, 1);
            this.showEditModeNotification();
        }
        else {
            throw new Error("Incorrect init options parameters.");
        }
    }
    
    openFileForEditingOrPreview(): Q.Promise<void> {
        if (this.options.editMode && this.openableElement) {
            let data: app.BlobData = null;
            return Q().then(() => {
                return this.openableElement.getBlobData();
            })
            .progress(progress => {
                this.callViewMethod("setProgress", progress);
            })
            .then(_data => {
                data = _data;
                return this.openForEditing();
            })
            .then(() => {
                this.callViewMethod("editImage", data, this.openableElement.getName(), this.mimeType);
                this.showEditModeNotification();
                return;
            })
            .fail(() => {
                return this.openableElement.getBuffer().then(buffer => {
                    this.callViewMethod("updateImage", [buffer], this.mimeType, true);
                });
            });
        }
        return Q.reject();
    }
    
    showEditModeNotification(): void {
        this.notifications.showNotification(this.i18n("window.imageeditor.actions.edit"), {autoHide: true, progress: false});
    }
    
    closeConfirm(): Q.IWhenable<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.confirmEx({
                message: this.i18n("window.imageeditor.confirm.close.dirty.text"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: this.i18n("window.imageeditor.confirm.close.dirty.confirm")
                },
                no: {
                    faIcon: "",
                    btnClass: "btn-default",
                    label: this.i18n("core.button.cancel.label")
                }
            })
            .then(result => {
                defer.resolve(result.result != "yes");
            });
        });
        return defer.promise;
    }
    
    beforeClose(_force: boolean): Q.IWhenable<void> {
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        let defer = Q.defer<void>();
        Q().then(() => {
            return this.retrieveFromView("isDirty")
            .then(dirty =>{
                if (dirty) {
                    this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
                    return this.closeConfirm();
                } else {
                    return false;
                }
            })
            .then(needSave => {
                if (!needSave) {
                    this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                    let client = this.session.sectionManager.client;
                    this.unregisterPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
            
                    defer.resolve();
                }
                else {
                    this.manager.cancelClosing();
                }
            })
        });
        return defer.promise;
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewOk() {
        this.close();
    }
    
    blobToDataURL(blob: Blob): Q.Promise<string> {
        let result = Q.defer<string>();
        let a = new FileReader();
        a.onload = (e) => {
            return result.resolve(e.target.result);
        }
        a.readAsDataURL(blob);
        return result.promise;
    }

    onViewSave(dataUrl: string) {
        this.save(dataUrl);
    }
    
    onViewSaveScreenshot(dataUrl: string): void {
        if (this.openableElement) {
            this.save(dataUrl);
            return;
        }
        else {
            new Promise<void>(async() => {
                await this.saveNew(dataUrl);
                this.openForEditing();
            })
        }

    }

    async saveNew(dataUrl: string): Promise<void> {
        let notificationId = this.notifications.showNotification(this.i18n("window.imageeditor.actions.save"), {autoHide: false, progress: false});
        try {
            let content = privfs.lazyBuffer.Content.createFromBase64(dataUrl.split(",")[1], "image/png", this.currentFileName);
            const uploadResult = await this.uploadToMy(content);
            this.openableElement = uploadResult.openableElement;
            this.callViewMethod("setDirty", false);    
        }        
        finally {
            this.notifications.hideNotification(notificationId);
        }


        // Q().then(() => {
        //     return this.uploadToMy(content)
        //     .then(result => {
        //         this.openableElement = result.openableElement;
        //     })
        //     .fin(() => {
        //         this.notifications.hideNotification(notificationId);
        //     });
        // })
        // .then(() => {
        //     return this.openForEditing();
        // });

    }
    
    onViewSendScreenshot(dataUrl: string): void {
        this.sendScreenshot(dataUrl);
    }

    onViewAttachToTask(dataUrl: string) {
        this.attachToTask(dataUrl);
    }    

    onViewPrint() {
        if (this.isPrinting || this.openableElement == null) {
            return;
        }
        this.isPrinting = true;
        let notificationId = this.notifications.showNotification(this.i18n("window.imageeditor.printing"), {autoHide: false, progress: true});
        Q().then(() => {
            return this.app.print(this.session, this.openableElement);
        })
        .then(printed => {
            if (printed) {
                setTimeout(() => {
                    this.notifications.showNotification(this.i18n("window.imageeditor.printed"));
                }, 500);
            }
        })
        .fin(() => {
            this.notifications.hideNotification(notificationId);
            this.isPrinting = false;
        });
    }
    
    onViewSetDirty(isDirty: boolean) {
        this.nwin.setDirty(isDirty);
    }
    
    onViewHistory(): void {
        if (this.openableElement instanceof shelltypes.OpenableFile) {
            this.app.dispatchEvent<event.OpenHistoryViewEvent>({
                type: "open-history-view",
                parent: this,
                fileSystem: this.openableElement.fileSystem,
                path: this.openableElement.path,
                hostHash: this.session.hostHash
            });
        }
    }
    
    onViewOpenTask(taskIdsStr: string): void {
        let entryId = this.openableElement.getElementId();
        taskIdsStr += "";
        let resolved = this.session.sectionManager.resolveFileId(entryId);
        
        let taskId: string = "";
        if (taskIdsStr.indexOf(",") >= 0) {
            this.taskChooser.options.onlyTaskIds = taskIdsStr.split(",");
            this.taskChooser.refreshTasks();
            this.taskChooser.showPopup().then(result => {
                if (result.taskId) {
                    this.tasksPlugin.openTask(resolved.section.getId(), result.taskId);
                }
            });
        }
        else {
            taskId = taskIdsStr;
            this.tasksPlugin.openTask(resolved.section.getId(), taskId);
        }
    }

    onViewEnterEditMode(): void {
        this.openableElement.getBlobData().then(data => {
            return this.openForEditing().thenResolve(data);
        })
        .then(data => {
            this.callViewMethod("editImage", data, this.openableElement.getName(), this.mimeType);
            this.showEditModeNotification();
        })
        .fail(e => {
            if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.message == "locked-in-another-session-by-me") {
                this.editMode = false;
                return Q(this.onError(e));
            }
        });
    }

    onViewRename(): void {
        if (this.isRenaming) {
            return;
        }
        this.isRenaming = true;
        Q().then(() => {
            return this.prompt(this.i18n("window.imageeditor.rename.message"), this.openableElement.name);
        })
        .then(result => {
            if (result.result == "ok" && result.value != this.openableElement.name) {
                let notificationId = this.notifications.showNotification(this.i18n("window.imageeditor.rename.notification.renaming"), { autoHide: false, progress: true });
                let notifKey: string = "renamed";
                return Q().then(() => {
                    if (this.openableElement instanceof OpenableSectionFile) {
                        let osf: OpenableSectionFile = this.openableElement;
                        let newFullFileName: string = "";
                        return osf.section.getFileTree().then(tree => {
                            return tree.refreshDeep(true).thenResolve(tree);
                        })
                        .then(tree => {
                            if (tree.collection.list.find(x => x.name == result.value)) {
                                notifKey = "alreadyExists";
                                return true;
                            }
                            else {
                                newFullFileName = osf.path.substr(0, osf.path.lastIndexOf("/")) + "/" + result.value;
                                return tree.fileSystem.rename(osf.path, result.value)
                                .then(() => {
                                    this.app.fileRenameObserver.dispatchFileRenamedEvent(osf.handle.ref.did, newFullFileName, osf.path, this.session.hostHash);
                                })
                                .thenResolve(true);
                            }
                        })
                        .then(res => {
                            notifKey = res ? "renamed" : "error";
                        })
                        .fail(() => {
                            notifKey = "error";
                        });
                    }
                    else if ((<any>this.openableElement).openableElementType == "LocalOpenableElement") {
                        let el = <any>this.openableElement;
                        let oldPath = el.entry.path;
                        el.rename(result.value)
                        .then(() => {
                            let newFullFileName = el.entry.path.substr(0, el.entry.path.lastIndexOf("/")) + "/" + result.value;
                            this.app.fileRenameObserver.dispatchLocalFileRenamedEvent(newFullFileName, oldPath);
                        });
                    }
                })
                .fin(() => {
                    this.notifications.hideNotification(notificationId);
                    if (notifKey) {
                        setTimeout(() => {
                            this.notifications.showNotification(this.i18n(`window.imageeditor.rename.notification.${notifKey}`));
                        }, 900);
                    }
                });
            }
        })
        .fin(() => {
            this.isRenaming = false;
        });
    }

    getResult(): Q.Promise<ScreenshotResult> {
        return this.deferred.promise;
    }

    sendScreenshot(dataUrl: string) {
        this.app.sendFile({
            getData: () => {
                return privfs.lazyBuffer.Content.createFromBase64(dataUrl.split(",")[1], "image/png", this.currentFileName);
            },
            notifications: this.notifications,
            parent: this.getClosestNotDockedController(),
        });
    }

    isNewFile(): boolean {
        return this.openableElement == null;
    }

    async attachToTask(dataUrl: string): Promise<void> {
        if (this.attachToTaskLocked) {
            return;
        }
        this.attachToTaskLocked = true;


        const hasChangesToSave = await this.hasChangesToSave();
        if (hasChangesToSave) {
            const saveConfirmed = await this.askToSaveBeforeAttachConfirm();
            if (! saveConfirmed) {
                this.attachToTaskLocked = false;
                return;
            }
            if(this.isNewFile()) {
                await this.saveNew(dataUrl);
            }
            else {
                await this.save(dataUrl);
            }
        }

        if ((<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            let tasksPlugin = this.app.getComponent("tasks-plugin");
            TaskChooserWindowController.attachLocalFileToTask(this.parent.getClosestNotDockedController(), this.session, tasksPlugin, this.openableElement, this.notifications);
        }
        else {
            this.session.sectionManager.getFileOpenableElement(this.openableElement.getElementId(), false).then(file => {
                let resolved = this.session.sectionManager.resolveFileId(file.getElementId());
                let section = resolved.section;
                let tasksModule = section.getKvdbModule();
                let tasksPlugin = this.app.getComponent("tasks-plugin");
                if (!tasksModule || !tasksPlugin) {
                    return null;
                }
                TaskChooserWindowController.attachFileToTask(this, this.session, tasksPlugin, section, file, this.handle);
            });
        }
        this.attachToTaskLocked = false;
    } 
    
    async askToSaveBeforeAttachConfirm(): Promise<boolean> {
        try {
            const hasChanges = await this.hasChangesToSave();
            if (hasChanges) {
                const confirmResult = await this.confirmEx({
                    message: this.i18n("window.imageeditor.unsavedWarning.text", [this.currentFileName]),
                    yes: {label: this.i18n("window.imageeditor.save.confirm.yes.label")},

                    cancel: {visible: false},
                });
                return confirmResult.result == "yes";
            }    
        }
        catch (e) {
            this.logError(e);
        }
    }

    async hasChangesToSave(): Promise<boolean> {
        return await this.retrieveFromView<boolean>("isDirty");
    }

    save(dataUrl: string): Q.Promise<void> {
        let notificationId: number;
        return Q().then(() => {
            this.releasingLock = true;
            if (this.handle) {
                notificationId = this.notifications.showNotification(this.i18n("window.imageeditor.actions.save"), {autoHide: false, progress: false});
                let content = privfs.lazyBuffer.Content.createFromBase64(dataUrl.split(",")[1], this.mimeType, this.currentFileName);
                return this.handle.write(content)
                .catch(e => {
                    if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                        let identity = this.session.sectionManager.client.identity;
                        if (e.data.error.data.lockerPub58 == identity.pub58) {
                            // update lock and save again
                            return this.handle.lock(true)
                            .then(() => {
                                return this.save(dataUrl);
                            })
                        }
                        return this.saveFileAsConflicted(content);
                    }
                    else
                    if (privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
                        return this.saveFileAsConflicted(content);
                    }
                })
                .then(() => {
                    return true;
                });
            }
            else {
                return false;
            }
        })
        .then(saved => {
            if (saved) {
                this.callViewMethod("setDirty", false);
                let entryId = this.openableElement.getElementId();
                let resolved = this.session.sectionManager.resolveFileId(entryId);
                if (resolved) {
                    return ThumbsManager.getInstance().createThumb(resolved.section, resolved.path).fail(() => null);
                }
            }
        })
        .fail(e => {
            return Q(this.onError(e));
        })
        .fin(() => {
            this.releasingLock = false;
            this.notifications.hideNotification(notificationId);
        });
    }
    
    saveFileAsConflicted(content: privfs.lazyBuffer.Content): Q.Promise<void> {
        return Q().then(() => {
            let openableFile = (this.openableElement as OpenableSectionFile);
            let currentSection = this.session.sectionManager.getSection(this.documentSectionId);
            
            let fname = this.createConflictedFileName(openableFile)
            let newOpenableFile: OpenableFile;
            return openableFile.fileSystem.resolvePath(fname)
            .then(resolvedPath => {
                return openableFile.fileSystem.save(resolvedPath.path, content).thenResolve(resolvedPath.path);
            })
            .then(newPath => {
                newOpenableFile = new OpenableSectionFile(currentSection, openableFile.fileSystem, newPath, true);
                return newOpenableFile.refresh()
                .then(() => {
                    return newOpenableFile.fileSystem.openFile(newPath, privfs.fs.file.Mode.READ_WRITE)
                })
            })
            .then(newHandle => {
                this.handle = newHandle;
                this.openableElement = newOpenableFile;
                this.app.filesLockingService.showWarning(newOpenableFile.path);
            })
            .fail(e => {
                return Q.reject(e);
            });
        });
    }
    
    createConflictedFileName(openableFile: OpenableFile): string {
        try {
            let parentPath = openableFile.path.split("/").slice(0, -1).join("/");
            let fileName = openableFile.getName();
            let fileParts = fileName.split(".");
            let ext: string = "";
            if (fileParts.length > 1) {
                ext = fileParts[fileParts.length - 1];
                fileName = fileParts.slice(0, -1).join(".");
            }
            
            let formatter = new Formatter();
            let conflictedCopyStr = this.app.localeService.i18n("plugin.editor.window.editor.saveAsConflicted.conflictedCopy");
            let dateString = formatter.standardDate(new Date()).replace(/:/g, "-").replace(/ /g, "-");
            return parentPath + "/" + fileName + " - " + conflictedCopyStr + " - " + dateString + (ext.length > 0 ? "." + ext : "");
        }
        catch (e) {
            console.log("error creating filename",e);
        }
    }
    
    uploadToMy(content: privfs.lazyBuffer.Content): Q.Promise<section.UploadFileResultEx> {
        return Q().then(() => {
            return this.session.sectionManager.uploadFile({
                data: content,
                destination: "my",
                path: "/"
            })
        })
    }
    
    getBoundTasksStr(): string {
        let tree = this.fileTree;
        if (!tree) {
            return JSON.stringify(null);
        }
        let boundTasksStr: string = null;
        if (tree) {
            let id = this.openableElement.getElementId();
            let el = tree.collection.find(x => x.id == id);
            if (el) {
                boundTasksStr = el.meta.bindedElementId;
            }
        }
        return JSON.stringify(this.tasksPlugin.getBindedTasksData(boundTasksStr));
    }
    
    getTitle(overridePath?: string): string {
        if (!this.openableElement) {
            return "";
        }
        if (this.openableElement instanceof OpenableSectionFile) {
            let parsed = Entry.parseId(this.openableElement.id);
            if (parsed) {
                let section = this.session.sectionManager.getSection(parsed.sectionId);
                if (section) {
                    let sectionName = section.getFullSectionName();
                    let path = parsed.path[0] == "/" ? parsed.path.substring(1) : parsed.path;
                    if (overridePath) {
                        path = overridePath.substr(1);
                    }
                    return sectionName + "/" + path;
                }
            }
        }
        else if ((<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            if (overridePath) {
                return overridePath;
            }
            return this.openableElement.getElementId();
        }
        return this.openableElement.getName();
    }
    
    getPreTitleIcon(): app.PreTitleIcon {
        if (!this.openableElement) {
            return null;
        }
        if (this.openableElement instanceof OpenableSectionFile) {
            let parsed = Entry.parseId(this.openableElement.id);
            if (parsed) {
                let section = this.session.sectionManager.getSection(parsed.sectionId);
                if (section) {
                    if (section.isPrivate() && section.getName() == "<my>") {
                        return "private";
                    }
                    else
                    if (section.isPrivateOrUserGroup()) {
                        return "person";
                    }
                    return section.getScope() == "public" ? "section-public" : "section-non-public";
                }
            }
        }
        else if ((<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            return "local";
        }
        return null;
    }
    
    openForEditing(): Q.Promise<void> {
        if (!this.openableElement || !(this.openableElement instanceof shelltypes.OpenableFile)) {
            this.editMode = false;
            return Q.reject();
        }
        let openableFile = <shelltypes.OpenableFile>this.openableElement;
        return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE).then(handle => {
            this.editMode = false;
            this.handle = handle;
            this.editMode = true;
        });
    }
        
    onError(e: any): void {
        if (e.message == "locked-in-another-session-by-me") {
            return;
        }
        this.logError(e);
        if (privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
            let controller = this;
            Q().then(() => {
                return controller.handle.refresh();
            })
            .then(() => {
                let msg = controller.i18n("window.imageeditor.error.modifiedAlready");
                return controller.confirm(msg);
            })
            .then(result => {
                if (result.result != "yes") {
                    return;
                }
                return controller.addTaskEx(controller.i18n("task.load.text"), true, () => {
                    return this.openFileForEditingOrPreview();
                });
            });
        }
        else {
            this.logError(e);
        }
    }
    
    destroy(): void {
        super.destroy();
    }
    
    updateFileName(newFileName: string, newFullFileName: string, newTitle: string): void {
        this.updatedFullFileName = newFullFileName;
        this.setTitle(newTitle);
        this.callViewMethod("updateFileName", newFileName, newFullFileName, newTitle);
    }
}
