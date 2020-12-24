import * as privfs from "privfs-client";
import { ComponentController } from "../base/ComponentController";
import { app } from "../../Types";
import { Dependencies, Inject } from "../../utils/Decorators";
import { ComponentFactory } from "../main";
import { LocaleService, section } from "../../mail";
import { i18n } from "./i18n";
import Q = require("q");
import { Mindmap } from "./Mindmap";
import { OpenableElement, OpenableFile } from "../../app/common/shell/ShellTypes";
import { MindmapOperation, ChangeNodePropertyOperation, ComplexNodeOperation } from "./MindmapOperation";
import * as Types from "../../Types";
import { NotificationController } from "../notification/main";
import { Tree, Helper as TreeHelper } from "../../mail/filetree/NewTree";
import { MsgBoxResult } from "../../window/msgbox/main";
import { OpenableSectionFile, SectionService, FileSystemModuleService } from "../../mail/section";
import { CommonApplication } from "../../app/common";
import { Clipboard as PrivMxClipboard } from "../../app/common/clipboard/Clipboard";
import { BaseWindowController } from "../../window/base/main";
import { ContentEditableEditorMetaData, Formatter } from "../../utils";
import { Session } from "../../mail/session/SessionManager";

export interface MindmapIsDirtyChangedEvent extends Types.event.Event {
    type: "mindmap-is-dirty-changed";
    isDirty: boolean;
}

export interface Options {
    openableElement: OpenableElement,
    session: Session,
    editMode?: boolean;
}

export class Model {
    editable: boolean;
}

export interface Style {
    name?: string;
    fontSize?: string;
}

export interface StyleSwitcherTemplateModel {
    style: Style;
    availableNotesStyles: { [name: string]: string };
}

export interface EntryModel {
    extl: string;
    fileName: string;
    title: string;
    mimeType: string;
    canBeEditable: boolean;
    boundTasksStr: string;
}

export interface State {
    docked: boolean;
    fileName: string;
    editMode: boolean;
    previewMode: boolean;
    entry: EntryModel;
    dirty: boolean;
    customHtml: string;
    rightSideHtml: string;
    editModeFromPreview: boolean;
    canPrint: boolean;
    canSaveAsPdf: boolean;
    boundTasksStr: string;
}

interface PreHideState {
    needsRender: boolean;
}

interface PartialTasksPlugin {
    addTaskStatusesFromMessage(session: Session, statuses: { [taskId: string]: string }, text: string): void;
    addTaskStatusesFromTaskIds(session: Session, statuses: { [taskId: string]: string }, taskIds: string[]): void ;
    getTaskIdsFromMessage(text: string): string[];
    openEditTaskWindow(session: Session, taskId: string, editMode?: boolean, scrollToComments?: boolean): void;
    watch(session: Session, type: "task", id: "*", action: "*", handler: (type: "task", id: string, action: string) => void): void;
    unWatch(session: Session, type: "task", id: "*", action: "*", handler: (type: "task", id: string, action: string) => void): void;
}

@Dependencies(["notification"])
export class MindmapEditorController extends ComponentController {
    
    static textsPrefix: string = "component.mindmapEditor.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    
    afterViewLoaded: Q.Deferred<void>;
    afterMindmapRendered: Q.Deferred<void>;
    mindmap: Mindmap;
    openableElement: OpenableElement;
    openableEditableElement: OpenableElement;
    fileTree: Tree = null;
    notifications: NotificationController;
    handle: privfs.fs.descriptor.Handle;
    releasingLock: boolean = false;
    lockInterval: NodeJS.Timer = null;
    autoSaveInterval: NodeJS.Timer = null;
    editMode: boolean;
    parent: any;
    protected _isDirty: boolean = false;
    readyDeferred: Q.Deferred<void> = Q.defer();
    currentViewId: number = 1;
    lastRecoveryFilePath: string;
    preHideState: PreHideState = null;
    protected _uniqueId: string = Math.random().toString(36).substr(2);
    taskStatuses: { [taskId: string]: string } = {};
    tasksPlugin: PartialTasksPlugin = null;
    taskIdToNodePathsList: { [taskId: string]: string[] } = {};
    taskChangedHandlerBound: any;
    session: Session;

    constructor(parent: app.WindowParent, public app: CommonApplication, public options: Options) {
        super(parent);
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.taskChangedHandlerBound = this.taskChangedHandler.bind(this);
        this.tasksPlugin.watch(options.session, "task", "*", "*", this.taskChangedHandlerBound);
        this.afterViewLoaded = Q.defer();
        this.afterMindmapRendered = Q.defer();
        this.ipcMode = true;
        this.openableElement = options.openableElement;
        this.session = options.session;
        this.openableEditableElement = this.openableElement && !!options.editMode && this.openableElement.isEditable() ? this.openableElement : null;
        this.editMode = false;
        if (this.openableElement) {
            this.openFileForEditingOrPreview();
        }
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.app.addEventListener(PrivMxClipboard.CHANGE_EVENT, () => {
            let data = this.app.clipboard.get(undefined, "privmx");
            if (data && data.mm2nodes) {
                if (data.mm2nodes.id != this._uniqueId) {
                    this.callViewMethod("setClipboardNodes", data.mm2nodes.str);
                }
            }
        });
    }
    
    ready(): Q.Promise<void> {
        return this.readyDeferred.promise;
    }
    
    getModel(): Model {
        return {
            editable: false,
        };
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    setMindmap(mindmap: Mindmap): void {
        this.mindmap = mindmap;
        this.updateTaskStatuses();
        let relatedSectionId = this.openableElement && this.openableElement instanceof section.OpenableSectionFile && this.openableElement.section ? this.openableElement.section.getId() : null;
        let relatedHostHash = this.session.hostHash;
        this.callViewMethod("setMindmap", JSON.stringify(mindmap), relatedHostHash, relatedSectionId);
        this.afterViewLoaded.promise.then(() => {
            let data = this.app.clipboard.get();
            if (data && data.mm2nodes) {
                if (data.mm2nodes.id != this._uniqueId) {
                    this.callViewMethod("setClipboardNodes", data.mm2nodes.str);
                }
            }
        });
    }
    
    reopen(openableElement: OpenableElement): void {
        this.afterMindmapRendered = Q.defer();
        this.readyDeferred = Q.defer();
        this.openableElement = openableElement;
        this.openableEditableElement = this.openableElement && this.openableElement.isEditable() ? this.openableElement : null;
        this.openFileForEditingOrPreview();
    }
    
    rerender(): void {
        this.callViewMethod("rerender");
    }
    
    release(): void {
        this.currentViewId++;
        this.releaseLock();
    }
    
    performOperation(operation: MindmapOperation): void {
        let labelOperation: ChangeNodePropertyOperation = null;
        let metaDataOperation: ChangeNodePropertyOperation = null;
        if (operation instanceof ComplexNodeOperation && operation.operations.length == 2) {
            if (operation.operations[0] instanceof ChangeNodePropertyOperation && operation.operations[1] instanceof ChangeNodePropertyOperation) {
                let op1 = (operation.operations[0] as ChangeNodePropertyOperation);
                let op2 = (operation.operations[1] as ChangeNodePropertyOperation);
                if (op1.nodePath == op2.nodePath) {
                    if (op1.propertyName == "label" && op2.propertyName == "metaDataStr") {
                        labelOperation = op1;
                        metaDataOperation = op2;
                    }
                    else if (op2.propertyName == "label" && op1.propertyName == "metaDataStr") {
                        labelOperation = op2;
                        metaDataOperation = op1;
                    }
                }
            }
        }
        if (labelOperation && metaDataOperation) {
            this.app.prepareHtmlMessageBeforeSending(labelOperation.propertyNewValue, this.session).then(newText => {
                let { metaData, html } = ContentEditableEditorMetaData.extractMetaFromHtml(newText);
                labelOperation.propertyNewValue = html;
                metaDataOperation.propertyNewValue = JSON.stringify(metaData);
                let newTexts: { [nodePath: string]: string } = {};
                let newMetaData: { [nodePath: string]: string } = {};
                newTexts[labelOperation.nodePath] = html;
                newMetaData[metaDataOperation.nodePath] = JSON.stringify(metaData);
                this.callViewMethod("setNewLabelTexts", JSON.stringify(newTexts), JSON.stringify(newMetaData));
                this.performOperations([operation]);
            });
        }
        else {
            this.performOperations([operation]);
        }
    }
    
    performOperations(operations: MindmapOperation[]): void {
        for (let operation of operations) {
            operation.perform();
        }
        
        this.updateTaskStatuses();
    }
    
    onViewMindmapRendered(): void {
        this.afterMindmapRendered.resolve();
    }
    
    onViewPerformOperation(operationStr: string): void {
        let operation: MindmapOperation = MindmapOperation.fromJson(operationStr, this.mindmap);
        this.performOperation(operation);
    }
    
    onViewPerformOperations(operationStrs: string[]): void {
        let operations: MindmapOperation[] = operationStrs.map(x => MindmapOperation.fromJson(x, this.mindmap));
        this.performOperations(operations);
    }
    
    isDirty(): boolean {
        return this._isDirty;
    }
    
    setDirty(isDirty: boolean): void {
        if (isDirty != this._isDirty) {
            this.dispatchEvent<MindmapIsDirtyChangedEvent>({
                type: "mindmap-is-dirty-changed",
                isDirty: isDirty,
            });
            this._isDirty = isDirty;
        }
    }
    
    onViewSetIsDirty(isDirty: boolean): void {
        this.setDirty(isDirty);
    }
    
    save(): Q.Promise<boolean> {
        if (!this.isDirty()) {
            return Q(false);
        }
        
        let notificationId = this.notifications.showNotification(this.i18n("component.mindmapEditor.notifications.saving"), {autoHide: false, progress: false});
        let content: privfs.lazyBuffer.Content;
        let saved: boolean = false;
        let osf: OpenableSectionFile = null;
        let newTexts: { [nodePath: string]: string } = {};
        let newMetaData: { [nodePath: string]: string } = {};
        return Q().then(() => {
            let allNodes = this.mindmap.getAllNodes();
            let proms: Q.Promise<void>[] = [];
            for (let node of allNodes) {
                proms.push(this.app.prepareHtmlMessageBeforeSending(node.label, this.session).then(newText => {
                    let { metaData, html } = ContentEditableEditorMetaData.extractMetaFromHtml(newText);
                    let oldLabel = node.label;
                    let newLabel = html;
                    let oldMetaDataStr = node.metaDataStr || "{}";
                    let newMetaDataStr = JSON.stringify(metaData) || "{}";
                    node.label = newLabel;
                    node.metaDataStr = newMetaDataStr;
                    if (oldLabel != newLabel || oldMetaDataStr != newMetaDataStr) {
                        newTexts[node.getPath()] = node.label;
                        newMetaData[node.getPath()] = node.metaDataStr;
                    }
                    node.label = newText;
                }));
            }
            return Q.all(proms);
        })
        .then(() => {
            if (Object.keys(newTexts).length > 0) {
                this.callViewMethod("setNewLabelTexts", JSON.stringify(newTexts), JSON.stringify(newMetaData));
            }
            content = privfs.lazyBuffer.Content.createFromText(JSON.stringify(this.mindmap), this.openableElement.getMimeType(), this.openableElement.getName());
        })
        .then(() => {
            if (this.openableElement && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
                return this.openableElement.save(content).thenResolve(null);
            }
            else {
                let openableElement: OpenableSectionFile;
                return this.handle.write(content)
                .catch(e => {
                    if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                        let identity = this.session.sectionManager.client.identity;
                        if (e.data.error.data.lockerPub58 == identity.pub58) {
                            // update lock and save again
                            return this.handle.lock(true)
                            .then(() => {
                                return this.save().thenResolve<void>(null);
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
                    if (this.openableElement instanceof OpenableSectionFile) {
                        osf = this.openableElement;
                        openableElement = this.openableElement;
                        return this.openableElement.section.getFileTree();
                    }
                })
                .then(tree => {
                    if (tree) {
                        let entry = tree.collection.find(x => x.id == openableElement.id);
                        return this.app.fileStyleResolver.setStyle(entry, this.handle, {
                            styleName: this.mindmap.getStyleName(),
                            fontSize: this.mindmap.getFontSize(),
                            margin: Mindmap.DEFAULT_MARGIN,
                        });
                    }
                });
            }
        })
        .then(() => {
            saved = true;
            this.callViewMethod("afterSaved");
            this.setDirty(false);
        })
        .then(() => {
            if (osf && osf.section) {
                return (<any>osf.section).getChatModule().sendSaveFileMessage(osf.section.getId(), osf.path);
            }
        })
        .fail(e => {
            return this.onError(e);
        })
        .fin(() => {
            this.notifications.hideNotification(notificationId);
        }).thenResolve(saved);
    }
    
    onViewSave(): void {
        this.save();
    }
    
    i18n(key: string): string {
        let parent: any = this.parent;
        if ("i18n" in parent) {
            return parent.i18n(key);
        }
        return key;
    }
    
    lock(_withVersionUpdate: boolean = true): Q.Promise<void> {
        return Q();
    }
    
    releaseLock(): Q.Promise<void> {
        let viewId = this.currentViewId;
        return Q().then(() => {
            if (this.currentViewId != viewId) {
                return;
            }
            this.releasingLock = true;
            this.stopLockInterval();
            this.stopAutoSaveInterval();
            if (this.handle) {
                return this.handle.release();
            }
        })
        .fail(e => {
            if (!privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                return Q.reject<void>(e);
            }
        })
        .fin(() => {
            this.releasingLock = false;
        });
    }
    
    autoSave(): Q.Promise<void> {
        return Q().then(() => {
            if (!this.handle) {
                this.logError("invalid handle on autosave");
                return;
            }
            this.addTaskEx(this.i18n("plugin.editor.window.editor.task.autosave.text"), true, () => {
                return Q().then(() => {
                    return this.isDirty();
                })
                .then(hasChangesToSave => {
                    if (! hasChangesToSave) {
                        return;
                    }
                    return this.save()
                    .then(() => {
                        this.callViewMethod("confirmSave");
                    })
                })
            });
        })
    }
    
    saveFileAsConflicted(content: privfs.lazyBuffer.Content): Q.Promise<void> {
        return Q().then(() => {
            let openableFile = (this.openableElement as OpenableSectionFile);
            let currentSectionId: string = openableFile.section.getId();
            let fname = this.createConflictedFileName(openableFile)
            let newOpenableFile: OpenableSectionFile;
            return openableFile.fileSystem.resolvePath(fname)
            .then(resolvedPath => {
                return openableFile.fileSystem.save(resolvedPath.path, content).thenResolve(resolvedPath.path);
            })
            .then(newPath => {
                newOpenableFile = new OpenableSectionFile(this.session.sectionManager.getSection(currentSectionId), openableFile.fileSystem, newPath, true);
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
            })
        })
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
    
    saveFileAsRecovery(text: string): Q.Promise<void> {
        let section: SectionService;
        let osf: OpenableSectionFile;
        let filesService: FileSystemModuleService;
        let recoveryHandle: privfs.fs.descriptor.Handle;
        
        return Q().then(() => {
            if (!this.openableEditableElement) {
                return;
            }
            
            osf = (<OpenableSectionFile>this.openableEditableElement);
            section = osf.section;
            filesService = section.getFileModule();
            
            return filesService.getFileSystem();
        })
        .then(fs => {
            let content = privfs.lazyBuffer.Content.createFromText(text, osf.getMimeType());
            
            if (this.lastRecoveryFilePath) {
                return Q().then(() => {
                    return fs.openFile(this.lastRecoveryFilePath, privfs.fs.file.Mode.READ_WRITE, true);
                })
                .then(rHandle => {
                    recoveryHandle = rHandle;
                    return recoveryHandle.read(false);
                })
                .then(readContent => {
                    let savedText = readContent.getText();
                    if (savedText != text) {
                        return recoveryHandle.write(content, {releaseLock: true}).thenResolve(null);
                    }
                    else {
                        return;
                    }
                })
                .then(() => {
                })
                .fail(e => {
                    this.logError(e);
                });
            }
            else {
                let acl = filesService.getDescriptorAcl();
                let content = privfs.lazyBuffer.Content.createFromText(text, osf.getMimeType());
                let destPath = TreeHelper.resolvePath("/", osf.getName());
                return fs.createEx(destPath, content, true, {acl: acl})
                .then(fInfo => {
                    this.lastRecoveryFilePath = fInfo.path;
                });
            }
        })
    }
    
    lockedByMeInOtherSession(e: any): Q.Promise<void> {
        let viewId = this.currentViewId;
        return Q().then(() => {
            if (this.currentViewId != viewId) {
                return;
            }
            if (!privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.data.error.data.lockerPub58 != this.session.sectionManager.identity.pub58) {
                return Q.reject<MsgBoxResult>(e);
            }
            let msg = this.i18n("component.mindmapEditor.error.anotherSessionLock");
            return this.parent.confirm(msg);
        })
        .then(result => {
            if (this.currentViewId != viewId) {
                return;
            }
            if (result.result != "yes") {
                throw new Error("locked-in-another-session-by-me");
            }
        });
    }
    
    lockChecker(): void {
        let viewId = this.currentViewId;
        if (!this.editMode || this.handle == null || this.releasingLock || this.parent.networkIsDown()) {
            return;
        }
        let controller = this;
        this.parent.addTaskEx(this.i18n("component.mindmapEditor.task.relock.text"), true, () => {
            if (this.currentViewId != viewId) {
                return;
            }
            return controller.lock(false);
        });
    }
    
    stopLockInterval(): void {
        if (this.lockInterval) {
            clearInterval(this.lockInterval);
            this.lockInterval = null;
        }
    }
    
    startLockInterval(): void {
        if (!this.lockInterval) {
            this.lockInterval = setInterval(() => {
                this.lockChecker();
            }, 60 * 1000);
        }
    }
    
    stopAutoSaveInterval(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    startAutoSaveInterval(): void {
        if (!this.autoSaveInterval) {
            this.autoSaveInterval = setInterval(() => {
                this.autoSave()
            }, 60 * 1000 * 5);
        }
    }
    
    onError(e: any): Q.Promise<any> {
        let viewId = this.currentViewId;
        return Q().then(() => {
            if (e.message == "locked-in-another-session-by-me") {
                return;
            }
            this.parent.logError(e);
            if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                if (this.editMode && !this.releasingLock) {
                    this.lockedByMeInOtherSession(e);
                }
                else {
                    let pub58 = e.data.error.data.lockerPub58;
                    let contact = this.session.conv2Service.contactService.getContactByPub58(pub58);
                    let msg;
                    if (contact) {
                        msg = this.parent.i18n("component.mindmapEditor.error.anotherUserLock.known", [contact.getDisplayName()]);
                    }
                    else {
                        msg = this.parent.i18n("component.mindmapEditor.error.anotherUserLock.unknown", [pub58]);
                    }
                    this.parent.alert(msg);
                }
            }
            else if (privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
                let controller = this;
                Q().then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    return controller.handle.refresh();
                })
                .then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    let msg = controller.i18n("component.mindmapEditor.error.modifiedAlready");
                    return controller.parent.confirm(msg);
                })
                .then(result => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    if (result.result != "yes") {
                        return;
                    }
                    return controller.parent.addTaskEx(controller.i18n("task.load.text"), true, () => {
                        if (this.currentViewId != viewId) {
                            return;
                        }
                        return this.openFileForEditingOrPreview();
                    });
                });
            }
            else {
                this.parent.logError(e);
            }
        });
    }
    
    reopenFileForEditingOrPreview(enterEditMode: boolean = null): Q.Promise<void> {
        this.readyDeferred = Q.defer();
        this.openFileForEditingOrPreview(enterEditMode);
        return this.ready();
    }
    
    openFileForEditingOrPreview(enterEditMode: boolean = null): Q.Promise<void> {
        let viewId = this.currentViewId;
        let defs: Q.Deferred<void>[] = [];
        let dOpen = Q.defer<void>();
        defs.push(dOpen);
        let editMode = enterEditMode === null ? this.options.editMode : enterEditMode;
        let mode = editMode ? privfs.fs.file.Mode.READ_WRITE : privfs.fs.file.Mode.READ_ONLY;
        if (this.openableElement instanceof OpenableFile) {
            this.openableElement.fileSystem.openFile(this.openableElement.path, mode).then(handle => {
                if (this.currentViewId != viewId) {
                    return Q();
                }
                this.handle = handle;
                if (editMode) {
                    return Q().then(() => {
                        if (this.currentViewId != viewId) {
                            return;
                        }
                        this.editMode = true;
                        this.afterViewLoaded.promise.then(() => {
                            if (this.currentViewId != viewId) {
                                return;
                            }
                            this.callViewMethod("enterMindmapEditMode");
                        });
                        dOpen.resolve();
                    })
                    .fail(() => {
                        if (this.currentViewId != viewId) {
                            return;
                        }
                        this.editMode = false;
                        this.openableEditableElement = null;
                        this.afterViewLoaded.promise.then(() => {
                            if (this.currentViewId != viewId) {
                                return;
                            }
                            this.callViewMethod("exitMindmapEditMode");
                        });
                        dOpen.resolve();
                    });
                }
                else {
                    dOpen.resolve();
                }
            });
        }
        else {
            Q().then(() => {
                if (this.currentViewId != viewId) {
                    return;
                }
                return this.openableElement.getContent()
            })
            .then(content => {
                if (this.currentViewId != viewId) {
                    return;
                }
                dOpen.resolve();
                return content.buffer.toString("utf8");
            })
            .then(content => {
                this.editMode = editMode;
                this.afterViewLoaded.promise.then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    if (editMode) {
                        this.callViewMethod("enterMindmapEditMode");
                    }
                    else {
                        this.callViewMethod("exitMindmapEditMode");
                    }
                });
                return content;
            });
        }
            
        if (this.openableElement instanceof OpenableSectionFile) {
            let dTree = Q.defer<void>();
            defs.push(dTree);
            this.openableElement.section.getFileTree().then(tree => {
                if (this.currentViewId != viewId) {
                    return Q();
                }
                this.fileTree = tree;
                dTree.resolve();
            });
        }
        
        let dText = Q.defer<void>();
        defs.push(dText);
        this.openableElement.getText().then(json => {
            if (this.currentViewId != viewId) {
                return Q();
            }
            return this.afterViewLoaded.promise.then(() => {
                if (this.currentViewId != viewId) {
                    return;
                }
                let mindmap = Mindmap.fromJson(json);
                this.setMindmap(mindmap);
                dText.resolve();
            });
        });
        return Q.all(defs.map(x => x.promise))
        .then(() => {
            if (this.currentViewId != viewId) {
                return;
            }
            this.readyDeferred.resolve();
        })
        .catch(e => {
            if (this.currentViewId != viewId) {
                return;
            }
            console.error(e);
            this.readyDeferred.reject();
        });
    }
    
    copyToSystemClipboard(str: string): void {
        if (this.app) {
            this.app.setSystemCliboardData({
                text: str,
            })
            .then(copied => {
                if (!copied) {
                    this.app.clipboard.set({
                        text: str,
                    });
                }
            });
        }
    }
    
    onViewSetClipboardNodes(str: string, text: string): void {
        this.app.clipboard.set({
            mm2nodes: {
                id: this._uniqueId,
                str: str,
            },
            text: text,
        });
    }
    
    logError(e: any): void {
        return this.getParentBWC().logError(e);
    }
    
    addTaskEx(text: string, blockUI: boolean, taskFunction: () => Q.IWhenable<any>): Q.Promise<void> {
        return this.getParentBWC().addTask(text, blockUI, taskFunction);
    }
    
    getParentBWC(): BaseWindowController {
        let parent = this.parent;
        while (parent && !(parent instanceof BaseWindowController)) {
            parent = parent.parent;
        }
        return parent;
    }
    
    savePreHideState(): void {
        this.preHideState = {
            needsRender: false,
        };
    }
    
    clearPreHideState(): void {
        this.preHideState = null;
    }
    
    restorePreHideState(): void {
        if (this.preHideState && this.preHideState.needsRender && this.parent.onViewReload) {
            this.parent.onViewReload();
        }
    }
    
    invalidatePreHideState(): void {
        if (this.preHideState) {
            this.preHideState.needsRender = true;
        }
    }
    
    beforeClose(): void {
        this.tasksPlugin.unWatch(this.session, "task", "*", "*", this.taskChangedHandlerBound);
    }
    
    /**************************************************
    **************** Task/file pickers ****************
    ***************************************************/
    
    updateTaskStatuses(collectFromStrings: boolean = true): void {
        // Collect new statuses
        let newTaskStatuses: { [taskId: string]: string } = {};
        if (collectFromStrings) {
            let strings: { [nodePath: string]: string } = this.mindmap.collectStrings();
            this.taskIdToNodePathsList = {};
            for (let nodePath in strings) {
                let str = strings[nodePath];
                let taskIds = this.tasksPlugin.getTaskIdsFromMessage(str);
                for (let taskId of taskIds) {
                    if (!(taskId in this.taskIdToNodePathsList)) {
                        this.taskIdToNodePathsList[taskId] = [];
                    }
                    if (this.taskIdToNodePathsList[taskId].indexOf(nodePath) < 0) {
                        this.taskIdToNodePathsList[taskId].push(nodePath);
                    }
                }
                this.tasksPlugin.addTaskStatusesFromTaskIds(this.session, newTaskStatuses, taskIds);
            }
        }
        else {
            this.tasksPlugin.addTaskStatusesFromTaskIds(this.session, newTaskStatuses, Object.keys(this.taskStatuses));
        }
        
        // Update this.taskStatuses and check whether something was changed
        let nodePathsToReRender: string[] = [];
        let different: boolean = false;
        for (let taskId in newTaskStatuses) {
            if (newTaskStatuses[taskId] != this.taskStatuses[taskId]) {
                different = true;
                this.taskStatuses[taskId] = newTaskStatuses[taskId];
                if (taskId in this.taskIdToNodePathsList) {
                    for (let nodePath of this.taskIdToNodePathsList[taskId]) {
                        if (nodePathsToReRender.indexOf(nodePath) < 0) {
                            nodePathsToReRender.push(nodePath);
                        }
                    }
                }
            }
        }
        for (let taskId in this.taskStatuses) {
            if (newTaskStatuses[taskId] != this.taskStatuses[taskId]) {
                different = true;
                delete this.taskStatuses[taskId];
                if (taskId in this.taskIdToNodePathsList) {
                    for (let nodePath of this.taskIdToNodePathsList[taskId]) {
                        if (nodePathsToReRender.indexOf(nodePath) < 0) {
                            nodePathsToReRender.push(nodePath);
                        }
                    }
                }
            }
        }
        
        // Update if different
        if (different) {
            this.callViewMethod("setTaskStatuses", JSON.stringify(this.taskStatuses), JSON.stringify(nodePathsToReRender));
        }
    }
    
    onViewOpenTask(taskId: string): void {
        this.tasksPlugin.openEditTaskWindow(this.session, taskId, true, true);
    }
    
    taskChangedHandler(): void {
        this.updateTaskStatuses(false);
    }
}
