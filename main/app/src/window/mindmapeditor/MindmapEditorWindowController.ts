import {BaseWindowController} from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app,event} from "../../Types";
import { OpenableElement, ShellOpenAction } from "../../app/common/shell/ShellTypes";
import { NotificationController } from "../../component/notification/NotificationController";
import { BaseWindowManager } from "../../app/BaseWindowManager";
import * as shelltypes from "../../app/common/shell/ShellTypes";
import { Dependencies } from "../../utils/Decorators";
import { TaskChooserController } from "../../component/taskchooser/TaskChooserController";
import { TaskTooltipController } from "../../component/tasktooltip/TaskTooltipController";
import { OpenableSectionFile } from "../../mail/section";
import { Entry } from "../../mail/filetree/NewTree";
import { PersonsController } from "../../component/persons/PersonsController";
import { LocaleService, filetree } from "../../mail";
import { i18n } from "./i18n";
import { MindmapEditorController, MindmapIsDirtyChangedEvent, EntryModel } from "../../component/mindmapeditor/main";
import { EditorButtonsController, EditorButtonsParent, ButtonsState } from "../../component/editorbuttons/EditorButtonsController";
import { LocalFfWatcher } from "./LocalFsWatcher";
import { Mindmap } from "../../component/mindmapeditor/Mindmap";
import { Session } from "../../mail/session/SessionManager";
import { FileStyle } from "../../app/common/FileStyleResolver";

export interface Options {
    docked?: boolean;
    openableElement: OpenableElement,
    editMode?: boolean;
    preview?: boolean;
    action?: ShellOpenAction;
    newFile?: boolean;
}

export interface Model {
    docked: boolean;
    name: string;
    image: string;
    fileName: string;
    editMode: boolean;
    previewMode: boolean;
    entry: EntryModel;
    canPrint: boolean;
    canSaveAsPdf: boolean;
    boundTasksStr: string;
    printMode: boolean;
    initialStyleName: string;
}

@Dependencies(["mindmapeditor", "editorbuttons", "notification", "tasktooltip", "taskchooser"])
export class MindmapEditorWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.mindmapeditor.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    name: string;
    docked: boolean;
    afterViewLoaded: Q.Deferred<void>;
    tasksPlugin: any;
    personsComponent: PersonsController;
    notifications: NotificationController;
    editorButtons: EditorButtonsController;
    taskTooltip: TaskTooltipController;
    taskChooser: TaskChooserController;
    mindmapEditor: MindmapEditorController;
    isDirty: boolean = false;
    printMode: boolean = false;
    editMode: boolean = false;
    previewMode: boolean = false;
    openableElement: OpenableElement;
    isPrinting: boolean = false;
    isSavingAsPdf: boolean = false;
    prepareToPrintDeferred: Q.Deferred<void> = null;
    currentViewId: number = 1;
    watcher: LocalFfWatcher;
    stateClearedDeferred: Q.Deferred<void> = Q.defer<void>();
    reloadOnNotes2Open: boolean = false;
    lockRerender: boolean = false;
    initialStyleName: string = Mindmap.DEFAULT_STYLE_NAME;
    prepareBeforeShowingDeferred: Q.Deferred<void> = null;
    updatedFullFileName: string = null;
    isRenaming: boolean = false;
    
    constructor(parent: app.WindowParent, public session: Session, public options: Options) {
        super(parent, __filename, __dirname);
        if (options.docked || options.preview) {
            options.editMode = false;
        }
        this.docked = !!options.docked;
        this.editMode = options.editMode;
        this.ipcMode = true;
        this.previewMode = !!options.preview;
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.afterViewLoaded = Q.defer();
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.editorButtons = this.addComponent("editorbuttons", this.componentFactory.createComponent("editorbuttons", [<EditorButtonsParent>this]));
        this.editorButtons.setSession(session);
        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            return this.tasksPlugin.getTaskTooltipContent(session, taskId);
        };
        this.taskChooser = this.addComponent("taskchooser", this.componentFactory.createComponent("taskchooser", <any>[this, this.app, {
            createTaskButton: false,
            includeTrashed: false,
            popup: true,
            session: session
        }]));
        this.mindmapEditor = this.addComponent("mindmapeditor", this.componentFactory.createComponent("mindmapeditor", <any>[this, this.app, {
            openableElement: options.openableElement,
            editMode: options.editMode,
            session: this.session,
        }]));
        this.printMode = options.action == ShellOpenAction.PRINT;
        let availWidth = this.app.isElectronApp() ? this.app.getScreenResolution().width : window.innerWidth;
        let windowWidth = Math.min(1200, 0.8 * availWidth);
        if (this.printMode) {
            this.addViewScript({path: "build/pdf/html2pdf.js/dist/html2pdf.bundle.min.js"});
        }
        this.openWindowOptions = {
            modal: false,
            maximized: false,
            alwaysOnTop: false,
            showInactive: false,
            toolbar: false,
            hidden: this.printMode,
            maximizable: true,
            minimizable: true,
            show: false,
            position: "center",
            minWidth: 450,
            minHeight: 215,
            width: this.printMode ? (this.app.isElectronApp() ? 700 : 760) : windowWidth,
            height: 600,
            resizable: true,
            backgroundColor: "#fff",
            title: this.getTitle(),
            icon: options.openableElement ? this.app.shellRegistry.resolveIcon(options.openableElement.getMimeType()) : null,
            preTitleIcon: this.getPreTitleIcon(),
        };
        this.mindmapEditor.addEventListener<MindmapIsDirtyChangedEvent>("mindmap-is-dirty-changed", e => {
            this.isDirty = e.isDirty;
            this.callViewMethod("setIsDirty", this.isDirty);
            this.nwin.setDirty(this.isDirty);
        });
        this.openableElement = this.mindmapEditor.openableElement;
        
        let client = this.session.sectionManager.client;
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        if (this.app.isElectronApp() && this.openableElement && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            this.watcher = new LocalFfWatcher();
            this.watcher.watch(this.openableElement.getElementId(), this.onChangeContent.bind(this));
        }
        this.bindEvent<event.ActiveAppWindowChangedEvent>(this.app, "active-app-window-changed", e => {
            if (e.appWindowId == "notes2") {
                if (this.reloadOnNotes2Open) {
                    this.reloadOnNotes2Open = false;
                    this.onViewReload(false);
                }
            }
        });
        this.bindEvent<event.FileOpenedEvent>(this.app, "file-opened", e => {
            if (e.element == this.openableElement && e.action == ShellOpenAction.OPEN && !this.mindmapEditor.editMode && e.hostHash == this.session.hostHash) {
                this.onViewEnterEditMode();
            }
        });
        
        this.bindEvent<event.FileLockChangedEvent>(this.app, "file-lock-changed", () => {
            this.updateLockUnlockButtons();
        });

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
                this.updateFileNameFromFullFileName(newFullFileName);
            }
        });
        this.enableTaskBadgeAutoUpdater();
        let viewId = this.currentViewId;
        Q.all([this.afterViewLoaded.promise, this.mindmapEditor.afterMindmapRendered.promise, this.mindmapEditor.ready()]).then(() => {
            this.callViewMethod("clearState", false, this.mindmapEditor.editMode);
            if (this.mindmapEditor && this.mindmapEditor.mindmap && this.mindmapEditor.mindmap.style && this.currentViewId == viewId) {
                this.callViewMethod("setStyle", JSON.stringify(this.convertSavedStyle(this.mindmapEditor.mindmap.style)), false);
            }
            if (this.mindmapEditor.editMode) {
                this.notifications.showNotification(this.i18n("window.mindmapeditor.editModeBanner.text"));
            }
            return this.updateLockUnlockButtons();
        });
        this.prepareBeforeShowing();
    }
    
    convertSavedStyle(style?: { name: string, fontSize: string }): { styleName: string, fontSize: string } {
        return {
            styleName: style && style.name && style.name in Mindmap.AVAILABLE_STYLES ? style.name : Mindmap.DEFAULT_STYLE_NAME,
            fontSize: style && style.fontSize && style.fontSize in Mindmap.AVAILABLE_FONT_SIZES ? style.fontSize : Mindmap.DEFAULT_FONT_SIZE,
        }
    }
    
    reopen(openableElement: OpenableElement) {
        if (this.mindmapEditor) {
            this.mindmapEditor.clearPreHideState();
        }
        let wasNoElement = this.openableElement === null;
        this.lockRerender = true;
        this.callViewMethod("clearState", true, this.mindmapEditor.editMode);
        this.openableElement = openableElement;
        let styleName: string = "";
        let fontSize: string = "";
        return this.prepareForDisplay(openableElement).then(_style => {
            styleName = _style ? _style.styleName : Mindmap.DEFAULT_STYLE_NAME;
            fontSize = _style ? _style.fontSize : Mindmap.DEFAULT_FONT_SIZE;
            this.mindmapEditor.reopen(openableElement);
            return Q.all([this.afterViewLoaded.promise, this.mindmapEditor.afterMindmapRendered.promise, this.mindmapEditor.ready()]);
        })
        .then(() => {
            const fullFileName = this.getFullFileName();
            this.updateFileNameFromFullFileName(fullFileName);
            if (openableElement instanceof OpenableSectionFile) {
                if (this.mindmapEditor.mindmap && (styleName != this.mindmapEditor.mindmap.getStyleName() || fontSize != this.mindmapEditor.mindmap.getFontSize())) {
                    this.app.fileStyleResolver.cacheStyle(openableElement.id, {
                        styleName: this.mindmapEditor.mindmap.getStyleName(),
                        fontSize: this.mindmapEditor.mindmap.getFontSize(),
                        margin: Mindmap.DEFAULT_MARGIN,
                    });
                }
            }
            this.callViewMethod("clearState", false, this.mindmapEditor.editMode);
            if (this.app.isElectronApp() && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
                this.watcher = new LocalFfWatcher();
                this.watcher.watch(this.openableElement.getElementId(), this.onChangeContent.bind(this));
            }
            this.setTitle(this.getTitle());
            if (wasNoElement) {
                this.updatePreTitleIcon();
            }
            this.updateLockUnlockButtons();
        })
        .fin(() => {
            this.lockRerender = false;
        });
    }
    
    prepareForDisplay(openableElement: OpenableElement): Q.Promise<FileStyle> {
        if (openableElement instanceof OpenableSectionFile) {
            return openableElement.section.getFileTree().then(tree => {
                let entry = tree.collection.find(x => x.id == openableElement.id);
                return this.app.fileStyleResolver.getStyle(entry);
            })
            .then(style => {
                this.callViewMethod("setStyle", JSON.stringify(style), false);
                return style;
            });
        }
        return Q(null);
    }
    
    afterIframeHide(): void {
        if (this.mindmapEditor) {
            this.mindmapEditor.savePreHideState();
        }
        this.callViewMethod("toggleEditorHidden", true);
    }
    
    afterIframeShow(): void {
        this.retrieveFromView("toggleEditorHidden", false).then(() => {
            if (this.mindmapEditor) {
                this.mindmapEditor.restorePreHideState();
            }
        });
    }
    
    release(): void {
        if (this.mindmapEditor) {
            this.mindmapEditor.clearPreHideState();
        }
        if (this.watcher) {
            this.watcher.unwatch();
            this.watcher = null;
        }
        this.reloadOnNotes2Open = false;
        this.currentViewId++;
        this.openableElement = null;
        this.callViewMethod("release", this.currentViewId);
        this.mindmapEditor.release();
    }
    
    hasOpenedEntry(openableElement: OpenableElement): boolean {
        return openableElement.equals(this.openableElement);
    }
    
    getModel(): Model {
        let entry = this.openableElement;
        let entryName = this.openableElement ? this.openableElement.getName() : "";
        let entryMimeType = entry ? entry.mimeType : "application/x-smm";
        return {
            docked: this.docked,
            name: this.name,
            image: this.app.assetsManager.getAsset("icons/app-icon.png"),
            fileName: entryName,
            editMode: this.editMode,
            entry: {
                fileName: entryName,
                extl: entryName.substr(entryName.lastIndexOf(".")),
                boundTasksStr: this.getBoundTasksStr(),
                canBeEditable: true,
                mimeType: entry ? entry.getMimeType() : "application/x-smm",
                title: entryName,
            },
            previewMode: this.openableElement == null || !!this.previewMode,
            boundTasksStr: this.getBoundTasksStr(),
            canPrint: entryMimeType == "application/x-smm" || entryMimeType == "application/x-stt",
            canSaveAsPdf: entryMimeType == "application/x-smm" || entryMimeType == "application/x-stt",
            printMode: this.printMode,
            initialStyleName: this.initialStyleName,
        };
    }
    
    init(): Q.IWhenable<void> {
        return Q().then(() => {
            return super.init();
        });
    }
    
    prepareBeforeShowing(): Q.Promise<void> {
        if (this.prepareBeforeShowingDeferred) {
            return this.prepareBeforeShowingDeferred.promise.isFulfilled() ? null : this.prepareBeforeShowingDeferred.promise;
        }
        this.prepareBeforeShowingDeferred = Q.defer();
        return Q()
        .then(() => {
            return super.prepareBeforeShowing();
        })
        .then(() => {
            let el = this.options && this.options.openableElement && this.options.openableElement instanceof OpenableSectionFile ? this.options.openableElement : null;
            if (el && el.section && el.handle && el.handle.ref) {
                return el.section.getFileTree().then(tree => {
                    let entry = tree.collection.find(x => x && x.ref && x.ref.did == el.handle.ref.did);
                    if (entry) {
                        return this.app.fileStyleResolver.getStyle(entry);
                    }
                })
                .then(style => {
                    if (style.styleName && style.styleName in Mindmap.AVAILABLE_STYLES) {
                        this.initialStyleName = style.styleName;
                        this.openWindowOptions.backgroundColor = Mindmap.STYLE_BACKGROUNDS[style.styleName];
                        let opts = (<any>this.loadWindowOptions);
                        if (!opts.extraBodyAttributes) {
                            opts.extraBodyAttributes = {};
                        }
                        opts.extraBodyAttributes["data-style-name"] = style.styleName;
                    }
                    this.prepareBeforeShowingDeferred.resolve();
                });
            }
            else {
                this.prepareBeforeShowingDeferred.resolve();
            }
        })
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    getButtonsState(): ButtonsState {
        let state = this.editorButtons.getDefaultButtonsState();
        state.close = this.docked && !this.previewMode;
        state.print = true;
        state.saveAsPdf = true;
        return state;
    }
    
    closeConfirm(): Q.IWhenable<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.confirmEx({
                message: this.i18n("window.mindmapeditor.confirm.close.dirty.text"),
                yes: {
                    faIcon: "trash",
                    btnClass: "btn-warning",
                    label: this.i18n("window.mindmapeditor.confirm.close.dirty.confirm")
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
            return Q(this.mindmapEditor.isDirty())
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
                    this.freePmxEvents();
                    if (this.mindmapEditor) {
                        this.mindmapEditor.beforeClose();
                    }
                    defer.resolve();
                }
                else {
                    this.manager.cancelClosing();
                }
                
            })
        });
        return defer.promise;
    }

    freePmxEvents(): void {
        let client = this.session.sectionManager.client;
        this.unregisterPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
    }
    
    onStorageEvent(event: privfs.types.descriptor.DescriptorNewVersionEvent): void {
        if (event.type == "descriptor-new-version" && this.mindmapEditor.openableElement && (<any>this.mindmapEditor.openableElement).handle && event.descriptor.ref.id == (<any>this.mindmapEditor.openableElement).handle.ref.id) {
            this.callViewMethod("setBoundTasksStr", this.getBoundTasksStr());
        }
        if (event.type == "descriptor-new-version" && this.openableElement && this.openableElement instanceof shelltypes.OpenableFile && event.descriptor.ref.id == this.openableElement.handle.ref.id) {
            this.onChangeContent();
        }
    }
    
    onChangeContent(): void {
        if (this.previewMode) {
            this.callViewMethod("isVisible");
            this.retrieveFromView("isVisible").then((isVisible: boolean) => {
                if (isVisible) {
                    this.onViewReload(false);
                }
                else {
                    this.reloadOnNotes2Open = true;
                    if (this.mindmapEditor) {
                        this.mindmapEditor.invalidatePreHideState();
                    }
                }
            });
        }
    }
    
    getBoundTasksStr(): string {
        let tree = this.mindmapEditor.fileTree;
        if (!tree) {
            return JSON.stringify([]);
        }
        let boundTasksStr: string = null;
        if (tree) {
            let id = this.mindmapEditor.openableElement.getElementId();
            let el = tree.collection.find(x => x.id == id);
            if (el) {
                boundTasksStr = el.meta.bindedElementId;
            }
        }
        return JSON.stringify(this.tasksPlugin.getBindedTasksData(boundTasksStr));
    }
    
    getFullFileName(): string {
        if (!this.mindmapEditor || !this.mindmapEditor.openableElement) {
            return "";
        }
        if (this.mindmapEditor.openableElement instanceof OpenableSectionFile) {
            const parsed = Entry.parseId(this.mindmapEditor.openableElement.id);
            if (parsed) {
                return parsed.path;
            }
        }
        else if ((<any>this.mindmapEditor.openableElement).openableElementType == "LocalOpenableElement") {
            return this.mindmapEditor.openableElement.getElementId();
        }
        return "";
    }
    
    getTitle(overridePath?: string): string {
        if (!this.mindmapEditor.openableElement) {
            return "";
        }
        if (this.mindmapEditor.openableElement instanceof OpenableSectionFile) {
            let parsed = Entry.parseId(this.mindmapEditor.openableElement.id);
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
        else if ((<any>this.mindmapEditor.openableElement).openableElementType == "LocalOpenableElement") {
            if (overridePath) {
                return overridePath;
            }
            return this.mindmapEditor.openableElement.getElementId();
        }
        return this.mindmapEditor.openableElement.getName();
    }
    
    getPreTitleIcon(): app.PreTitleIcon {
        if (!this.mindmapEditor.openableElement) {
            return null;
        }
        if (this.mindmapEditor.openableElement instanceof OpenableSectionFile) {
            let parsed = Entry.parseId(this.mindmapEditor.openableElement.id);
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
        else if ((<any>this.mindmapEditor.openableElement).openableElementType == "LocalOpenableElement") {
            return "local";
        }
        return null;
    }
    
    updatePreTitleIcon(): void {
        let icon = this.getPreTitleIcon();
        this.nwin.updatePreTitleIcon(icon);
    }
    
    onViewStateCleared(): void {
        this.stateClearedDeferred.resolve();
    }
    
    onViewSave(): void {
        this.mindmapEditor.save();
    }
    
    onViewPrint(): void {
        this.editorButtons.onViewPrint();
    }
    
    onViewHistory(): void {
        if  (this.openableElement instanceof shelltypes.OpenableFile) {
            this.app.dispatchEvent<event.OpenHistoryViewEvent>({
                type: "open-history-view",
                parent: this,
                fileSystem: this.openableElement.fileSystem,
                path: this.openableElement.path,
                hostHash: this.session.hostHash
            });
        }
    }

    async confirmSaveBeforeSend(): Promise<void> {
        try {
            const hasChanges = this.isDirty;
            if (hasChanges) {
                const confirmResult = await this.confirmEx({
                    message: this.i18n("window.mindmapeditor.confirm.save.beforeSend.text", [this.openableElement.getName()]),
                    yes: {label: this.i18n("core.button.yes.label")},
                    no: {label: this.i18n("core.button.no.label")},
                    cancel: {visible: true},
                });
                if (confirmResult.result == "yes") {
                    await this.mindmapEditor.save();  
                }
            }    
        }
        catch (e) {
            this.logError(e);
        }
    }

    
    onViewSend(): void {
        new Promise(async() => {
            await this.confirmSaveBeforeSend();
            this.editorButtons.onViewSend();
        })
    }
    
    onViewDownload(): void {
        this.editorButtons.onViewExport();
    }
    
    onViewSaveAsPdf(): void {
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        if (this.openableElement) {
            this.saveBeforePrinting().then(() => {
                let notificationId = this.notifications.showNotification(this.i18n("window.mindmapeditor.notifier.savingAsPdf"), {autoHide: false, progress: true});
                let parentController = this.getClosestNotDockedController();
                let parent = parentController ? parentController.nwin : null;
                this.app.saveAsPdf(this.session, this.openableElement, parent)
                .then(() => {
                    setTimeout(() => {
                        this.notifications.showNotification(this.i18n("window.mindmapeditor.notifier.savedAsPdf"));
                    }, 500);
                })
                .fin(() => {
                    this.notifications.hideNotification(notificationId);
                    this.isPrinting = false;
                })
                .fail(() => {
                    // Cancelled by user
                });
            });
        }
    }
    
    onViewEnterEditMode(): void {
        this.enterEditMode();
    }
    
    enterEditMode(): void {
        if (this.options && this.options.docked && this.options.preview) {
            return;
        }
        let viewId = this.currentViewId;
        let notificationId = this.notifications.showNotification(this.i18n("window.mindmapeditor.task.enterEditMode.text"), {autoHide:false,progress:true});
        this.addTaskEx(this.i18n("window.mindmapeditor.task.enterEditMode.text"), true, () => {
            if (this.currentViewId != viewId) {
                return;
            }
            return Q().then(() => {
                return this.mindmapEditor.handle ? this.mindmapEditor.handle.isModifiedRemote() : false;
            })
            .then(modified => {
                let prevEditMode: boolean = false;
                return Q().then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    prevEditMode = this.mindmapEditor.editMode;
                    if (modified) {
                        this.mindmapEditor.handle.updateToLastVersion();
                    }
                    return this.mindmapEditor.reopenFileForEditingOrPreview(true);
                })
                .then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    if (this.mindmapEditor.editMode != prevEditMode) {
                        this.callViewMethod("clearState", false, this.mindmapEditor.editMode);
                        if (this.mindmapEditor.editMode) {
                            this.editMode = true;
                            this.previewMode = false;
                            setTimeout(() => {
                                if (this.currentViewId != viewId) {
                                    return;
                                }
                                this.notifications.showNotification(this.i18n("window.mindmapeditor.editModeBanner.text"));
                            }, 900);
                        }
                    }
                });
            });
        })
        .fin(() => {
            this.notifications.hideNotification(notificationId);
        });
    }
    
    afterShowIframe(): void {
        if (this.lockRerender) {
            return;
        }
        this.mindmapEditor.rerender();
    }
    
    onViewReload(notify: boolean = true): void {
        let viewId = this.currentViewId;
        let notificationId = !notify ? null : this.notifications.showNotification(this.i18n("window.mindmapeditor.task.reload.text"), {autoHide:false,progress:true});
        this.addTaskEx(this.i18n("window.mindmapeditor.task.reload.text"), true, () => {
            if (this.currentViewId != viewId) {
                return;
            }
            return Q().then(() => {
                return this.mindmapEditor.handle ? this.mindmapEditor.handle.isModifiedRemote() : false;
            })
            .then(modified => {
                let prevEditMode: boolean = false;
                return Q().then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    prevEditMode = this.mindmapEditor.editMode;
                    if (modified) {
                        this.mindmapEditor.handle.updateToLastVersion();
                    }
                    return this.mindmapEditor.reopenFileForEditingOrPreview(false);
                })
                .then(() => {
                    if (this.currentViewId != viewId) {
                        return;
                    }
                    if (this.mindmapEditor.editMode != prevEditMode) {
                        this.callViewMethod("clearState", false, this.mindmapEditor.editMode);
                        if (this.mindmapEditor.editMode) {
                            this.notifications.showNotification(this.i18n("window.mindmapeditor.editModeBanner.text"));
                        }
                    }
                });
            });
        })
        .fin(() => {
            if (notify) {
                this.notifications.hideNotification(notificationId);
            }
        });
    }
    
    onViewAttachToTask(): void {
        this.editorButtons.attachToTask(this.mindmapEditor.handle);
    }
    
    onViewOpenMindmapHelp(): void {
        this.app.dispatchEvent<event.OpenMindmapHelpEvent>({
            type: "open-mindmap-help",
        });
    }
    
    onViewOpenTask(taskIdsStr: string): void {
        let entryId = this.mindmapEditor.openableElement.getElementId();
        taskIdsStr += "";
        let resolved = this.session.sectionManager.resolveFileId(entryId);
        
        let taskId: string = "";
        if (taskIdsStr.indexOf(",") >= 0) {
            this.taskChooser.options.onlyTaskIds = taskIdsStr.split(",");
            this.taskChooser.refreshTasks();
            this.taskChooser.showPopup().then(result => {
                if (result.taskId) {
                    this.openTask(resolved.section.getId(), result.taskId);
                }
            });
        }
        else {
            taskId = taskIdsStr;
            this.openTask(resolved.section.getId(), taskId);
        }
    }
    
    onViewClose(): void {
        this.close();
    }
    
    openTask(_sectionId: string, id: string): void {
        let tasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        (<any>tasksPlugin).openEditTaskWindow(id, true);
    }
    
    onViewPdfOutput(data: string) {
        let buffer = new Buffer(data, "binary");
        let fileName = filetree.Path.splitFileName(this.openableElement ? this.openableElement.getName() : "document.stt").name + ".pdf";
        let content = privfs.lazyBuffer.Content.createFromBuffer(buffer, "application/pdf", fileName);
        this.app.directSaveContent(content, this.session);
        this.onViewSavedAsPdf();
    }
    
    saveBeforePrinting(): Q.Promise<void> {
        if (this.isDirty) {
            return this.mindmapEditor.save().thenResolve(null);
        }
        return Q();
    }
    
    prepareToPrint(scale: boolean = false): Q.Promise<void> {
        if (this.prepareToPrintDeferred == null) {
            this.prepareToPrintDeferred = Q.defer();
            this.afterViewLoaded.promise.then(() => {
                return this.mindmapEditor.ready();
            })
            .then(() => {
                return this.mindmapEditor.afterMindmapRendered.promise;
            })
            .then(() => {
                return this.stateClearedDeferred.promise;
            })
            .then(() => {
                return super.prepareToPrint();
            })
            .then(() => {
                this.callViewMethod("prepareToPrint", scale);
            });
        }
        return this.prepareToPrintDeferred.promise;
    }
    
    onViewPreparedToPrint(): void {
        if (this.prepareToPrintDeferred) {
            this.prepareToPrintDeferred.resolve();
        }
    }
    
    updateFileNameFromFullFileName(fullFileName: string): void {
        let newFileName: string = fullFileName.substr(fullFileName.lastIndexOf("/") + 1);
        this.updateFileName(newFileName, fullFileName, this.getTitle(fullFileName));
    }
    
    updateFileName(newFileName: string, newFullFileName: string, newTitle: string): void {
        this.updatedFullFileName = newFullFileName;
        this.setTitle(newTitle);
        this.callViewMethod("updateFileName", newFileName, newFullFileName, newTitle);
    }
    
    onViewRename(): void {
        if (this.isRenaming) {
            return;
        }
        this.isRenaming = true;
        Q().then(() => {
            return this.prompt(this.i18n("window.mindmapeditor.rename.message"), this.openableElement.name);
        })
        .then(result => {
            if (result.result == "ok" && result.value != this.openableElement.name) {
                let notificationId = this.notifications.showNotification(this.i18n("window.mindmapeditor.rename.notification.renaming"), { autoHide: false, progress: true });
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
                            this.notifications.showNotification(this.i18n(`window.mindmapeditor.rename.notification.${notifKey}`));
                        }, 900);
                    }
                });
            }
        })
        .fin(() => {
            this.isRenaming = false;
        });
    }
    
    isFileLocked(): Q.Promise<boolean> {
        if (this.openableElement) {
            return this.app.filesLockingService.isLocked(this.session, this.openableElement);
        }
    }
    
    canUnlockFile(): Q.Promise<boolean> {
        if (this.openableElement) {
            return this.app.filesLockingService.canUnlockFile(this.session, this.openableElement);
        }
    }
    
    lockFile(): Q.Promise<void> {
        return Q().then(() => {
            if (this.openableElement) {
                return this.isFileLocked().then(locked => {
                    if (locked) {
                        return;
                    }
                    return this.app.filesLockingService.manualLockFile(this.session, this.openableElement);
                })
            }
        })
    }
    
    unlockFile(): Q.Promise<void> {
        if (this.openableElement) {
            return this.app.filesLockingService.manualUnlockFile(this.session, this.openableElement);
        }
    }
    
    updateLockUnlockButtons(): Q.Promise<void> {
        // update toolbar buttons
        return Q().then(() => {
            return Q.all([
                this.canUnlockFile(),
                this.isFileLocked()
            ])
        })
        .then(res => {
            let [canUnlock, locked] = res;
            this.updateLockInfoOnActionButtons(locked, canUnlock);
            if (this.editorButtons) {
                this.editorButtons.updateLockState(locked, canUnlock);
            }
        });
    }
    
    updateLockInfoOnActionButtons(locked: boolean, canUnlock: boolean) {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("updateLockInfoOnActionButtons", locked, canUnlock);
        });
    }
    
    onViewLockFile(): void {
        this.lockFile();
    }
    
    onViewUnlockFile(): void {
        this.unlockFile();
    }
}
