import {app, mail, utils, window as wnd, Types, privfs, Q, component} from "pmc-mail";
import {MindmapHelpWindowController} from "../mindmaphelp/MindmapHelpWindowController";
import {EditorPlugin, NotesPreferences, PartialTasksPlugin} from "../../main/EditorPlugin";
import Dependencies = utils.decorators.Dependencies;
import { LocalFfWatcher } from "../../main/LocalFsWatcher";
import {i18n} from "./i18n/index";

export interface Options {
    docked: boolean;
    newFile: boolean;
    entry: app.common.shelltypes.OpenableElement;
    editMode: boolean;
    preview?: boolean;
    action: app.common.shelltypes.ShellOpenAction;
}

export interface EntryModel {
    extl: string;
    fileName: string;
    title: string;
    mimeType: string;
    canBeEditable: boolean;
    boundTasksStr: string;
    hostHash: string;
    sectionId: string;
}

export interface Model {
    currentViewId: number;
    previewMode: boolean;
    printMode: boolean;
    docked: boolean;
    initialStyleName: string;
}

@Dependencies(["notification", "editorbuttons"])
export class EditorWindowController extends wnd.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.editor.window.editor.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static DirtyWindowsModel = new utils.Model<EditorWindowController[]>([]);
    
    // @Inject client: privfs.core.Client;
    // @Inject identity: privfs.identity.Identity
    // @Inject contactService: mail.contact.ContactService;
    // @Inject sectionManager: mail.section.SectionManager;


    currentViewId: number;
    docked: boolean;
    newFile: boolean;
    openableElement: app.common.shelltypes.OpenableElement;
    openableEditableElement: app.common.shelltypes.OpenableElement;
    openableFileElement: app.common.shelltypes.OpenableFile;
    editMode: boolean;
    previewMode: boolean;
    handle: privfs.fs.descriptor.Handle;
    mimeType: string;
    openingStartEditModeQuestion: boolean;
    lockInterval: NodeJS.Timer;
    autoSaveInterval: NodeJS.Timer;
    releasingLock: boolean;
    editorPlugin: EditorPlugin;
    notesPreferences: NotesPreferences;
    personsComponent: component.persons.PersonsController;
    notifications: component.notification.NotificationController;
    editorButtons: component.editorbuttons.EditorButtonsController;
    taskTooltip: component.tasktooltip.TaskTooltipController;
    taskChooser: component.taskchooser.TaskChooserController;
    prepareToPrintDeferred: Q.Deferred<void> = null;
    viewLoadedDeferred: Q.Deferred<void> = Q.defer();
    printMode: boolean;
    isPrinting: boolean = false;
    isSavingAsPdf: boolean = false;
    watcher: LocalFfWatcher;
    tasksPlugin: PartialTasksPlugin;
    initialStyleName: string = component.mindmap.Mindmap.DEFAULT_STYLE_NAME;
    prepareBeforeShowingDeferred: Q.Deferred<void> = null;
    lastRecoveryFilePath: string;
    taskChangedHandlerBound: any;
    updatedFullFileName: string = null;
    isRenaming: boolean = false;
    afterViewLoadedDeferred: Q.Deferred<void> = Q.defer();
    
    constructor(parentWindow: Types.app.WindowParent, public session: mail.session.Session, public options: Options) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.taskChangedHandlerBound = this.taskChangedHandler.bind(this);
        this.tasksPlugin.watch(this.session, "task", "*", "*", this.taskChangedHandlerBound);
        if (options.action == app.common.shelltypes.ShellOpenAction.PRINT) {
            this.addViewScript({path: "build/pdf/html2pdf.js/dist/html2pdf.bundle.min.js"});
        }
        this.personsComponent = this.addComponent("persons", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.editorButtons = this.addComponent("editorbuttons", this.componentFactory.createComponent("editorbuttons", [this]));
        this.editorButtons.setSession(this.session);
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
        this.currentViewId = 1;
        this.docked = !!options.docked;
        this.newFile = options.newFile;
        this.openableElement = options.entry;
        this.openableEditableElement = this.openableElement && this.openableElement.isEditable() ?  this.openableElement : null;
        this.openableFileElement = this.openableElement instanceof app.common.shelltypes.OpenableFile ? this.openableElement : null;
        this.previewMode = !!options.preview || (this.openableEditableElement == null && this.openableElement != null);//this.openableEditableElement == null || !!options.preview;
        this.editMode = !this.previewMode && !!options.editMode && this.openableEditableElement != null;
        this.editorPlugin = this.app.getComponent("editor-plugin");
        this.setPluginViewAssets("editor");
        if (this.docked) {
            this.openWindowOptions.widget = false;
            this.openWindowOptions.decoration = false;
        }
        else {
            this.printMode = options.action == app.common.shelltypes.ShellOpenAction.PRINT;
            let availWidth = this.app.isElectronApp() ? this.app.getScreenResolution().width : window.innerWidth;
            let windowWidth = Math.min(1200, 0.8 * availWidth);
            let title = this.getTitle();
            this.openWindowOptions = {
                toolbar: false,
                maximized: false,
                show: false,
                hidden: this.printMode,
                position: "center",
                minWidth: 450,
                minHeight: 215,
                width: this.printMode ? (this.app.isElectronApp() ? 700 : 760) : windowWidth,
                height: "75%",
                resizable: true,
                title: title,
                icon: this.openableElement ? this.app.shellRegistry.resolveIcon(this.openableElement.getMimeType()) : "application/x-stt",
                preTitleIcon: this.getPreTitleIcon(),
                keepSpinnerUntilViewLoaded: true,
                manualSpinnerRemoval: true,
            };
            if (this.printMode) {
                this.openWindowOptions.widget = false;
            }
        }


        let client = this.session.sectionManager.client;
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        if (this.app.isElectronApp() && this.openableElement && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            this.watcher = new LocalFfWatcher();
            this.watcher.watch(this.openableElement.getElementId(), this.onChangeLocalContent.bind(this));
        }
        
        this.app.addEventListener<Types.event.FileLockChangedEvent>("file-lock-changed", event => {
            this.updateLockUnlockButtons();
        })

        this.enableTaskBadgeAutoUpdater();
        this.prepareBeforeShowing();
        this.app.addEventListener<Types.event.FileRenamedEvent>("fileRenamed", event => {
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
                if (this.openableElement instanceof mail.section.OpenableSectionFile && (this.openableElement.path == event.oldPath || (this.updatedFullFileName && event.oldPath == this.updatedFullFileName))) {
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

    getButtonsStateWithUpdatedLock(): Q.Promise<component.editorbuttons.ButtonsState> {
        return Q().then(() => {
            let state = this.getButtonsState();
            return Q.all([
                this.newFile ? Q.resolve(false) : this.isFileLocked(), // jezeli nowy plik, to nie sprawdzaj lockow, tylko zworc wartosci domyslne
                this.newFile ? Q.resolve(false) : this.canUnlockFile()
            ])
            .then(res => {
                let [locked, canUnlock] = res;
                state.lock = !locked;
                state.unlock = locked && canUnlock;
                return state;
            })
        })
    }
    
    getButtonsState(): component.editorbuttons.ButtonsState {
        let state = this.editorButtons.getDefaultButtonsState();
        state.enabled = this.previewMode;
        state.print = true;
        state.saveAsPdf = true;
        // state.unlock = false;
        // if (this.openableElement && this.app.isElectronApp()) {
        //     let entryName = this.openableElement.getName();
        //     let entryExtl = entryName.substr(entryName.lastIndexOf("."))
        //     if ((<any>this.openableElement.mimeType).startsWith("text/") || entryExtl == ".stx" || entryExtl == ".txt") {
        //         state.unlock = (<any>this.app).externalFilesService.isElementRegisteredAndLocked(this.openableElement.getElementId());
        //     }
        // }
        return state;
    }
    
    init() {
        return this.editorPlugin.getNotesPreferences().then(notesPreferences => {
            this.notesPreferences = notesPreferences;
        })
    }
    
    onStorageEvent(event: privfs.types.descriptor.DescriptorNewVersionEvent): void {
        if (event.type == "descriptor-new-version" && this.openableFileElement && event.descriptor.ref.id == this.openableFileElement.handle.ref.id) {
            this.onChangeContent();
        }
    }
    
    onChangeContent(): void {
        this.getEntryModel().then(model => {
            if (model) {
                this.callViewMethod("setBoundTasksStr", model.boundTasksStr);
            }
        });
        if (!this.previewMode || this.handle == null) {
            return;
        }
        let currentViewId = this.currentViewId;
        let handle = this.handle;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.reload.text"), true, () => {
            return Q().then(() => {
                return handle.isModifiedRemote();
            })
            .then(modified => {
                if (!modified) {
                    return;
                }
                return Q().then(() => {
                    handle.updateToLastVersion();
                    return handle.read().then(c => c.getText());
                })
                .then(text => {
                    this.updateCachedStyleName(text);
                    this.updateTaskStatuses(text);
                    this.callViewMethod("updateContentPreview", currentViewId, text);
                });
            });
        });
    }
    
    onChangeLocalContent(): void {
        if (!this.previewMode) {
            return;
        }
        let currentViewId = this.currentViewId;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.reload.text"), true, () => {
            return Q().then(() => {
                return Q().then(() => {
                    return this.openableElement.getContent()
                })
                .then(content => {
                    return content.buffer.toString("utf8");
                })
                .then(text => {
                    this.updateTaskStatuses(text);
                    this.callViewMethod("updateContentPreview", currentViewId, text);
                });
            })
            .fail((e) => {})
        });
    }
    
    getModel(): Model {
        return {
            currentViewId: this.currentViewId,
            previewMode: this.previewMode,
            printMode: this.printMode,
            docked: this.docked,
            initialStyleName: this.initialStyleName,
        };
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
            let el = this.options && this.options.entry && this.options.entry instanceof mail.section.OpenableSectionFile ? this.options.entry : null;
            if (el && el.section && el.handle && el.handle.ref) {
                return el.section.getFileTree().then(tree => {
                    let entry = tree.collection.find(x => x && x.ref && x.ref.did == el.handle.ref.did);
                    if (entry) {
                        return this.app.fileStyleResolver.getStyle(entry);
                    }
                })
                .then(style => {
                    if (style && style.styleName && style.styleName in component.mindmap.Mindmap.AVAILABLE_STYLES) {
                        this.initialStyleName = style.styleName;
                        this.openWindowOptions.backgroundColor = component.mindmap.Mindmap.STYLE_BACKGROUNDS[style.styleName];
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
        });
    }
    
    onViewLoad(): void {
        this.viewLoadedDeferred.resolve();
        this.stopLockInterval();
        this.addTask(this.i18n("plugin.editor.window.editor.task.load.text"), true, () => {
            let currentViewId = this.currentViewId;
            let openableElement = this.openableElement;
            let openableFileElement = this.openableFileElement;
            if (openableElement == null) {
                return;
            }
            return Q().then(() => {
                return this.getButtonsStateWithUpdatedLock()
                .then(buttonsState => {
                    this.editorButtons.callViewMethod("setButtonsState", buttonsState)
                })
            })
            .then(() => {
                if (openableFileElement == null && openableElement) {
                    return Q().then(() => {
                        return openableElement.getContent()
                    })
                    .then(content => {
                        return content.buffer.toString("utf8");
                    });
                }
                else {
                    return Q().then(() => {
                        return openableFileElement.fileSystem.openFile(openableFileElement.path, privfs.fs.file.Mode.READ_WRITE);
                    })
                    .then(handle => {
                        if (this.currentViewId != currentViewId) {
                            return;
                        }
                        this.handle = handle;
                        if (!this.editMode) {
                            return;
                        }
                    })
                    .then(() => {
                        // this.editorPlugin.setContainerEventsReadStatus(this.entry, true, false);
                        return this.handle && this.currentViewId == currentViewId ? this.handle.read().then(c => c.getText()) : null;
                    });
                }
            })
            .then(text => {
                this.updateCachedStyleName(text);
                if (this.currentViewId != currentViewId) {
                    return;
                }
                return this.getEntryModel().then(model => {
                    this.updateTaskStatuses(text || "");
                    this.callViewMethod("load", currentViewId, text, this.docked, this.editMode, model, this.newFile, this.notesPreferences);
                    this.startLockInterval();
                    this.startAutoSaveInterval();
                })
                .then(() => {
                    return this.updateLockUnlockButtons();
                })
            })
            .then(() => {
                this.afterViewLoadedDeferred.resolve();
            })
            .fail(e => {
                if (!(this.previewMode && e && e.errorObject && e.errorObject.code == 12289)) {
                    this.logError(e);
                    this.errorAlert(this.prepareErrorMessage(e), e)
                    .then(() => {
                        this.close(true);
                    });
                }
                this.startLockInterval();
                return Q.reject(e);
            })
            .fin(() => {
                this.nwin.removeSpinner();
            });
        });
        this.initSpellChecker(this.editorPlugin.userPreferences);
    }
    
    onViewReload(): void {
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.reload.text"), true, () => {
            if (this.editMode || this.openableFileElement == null) {
                return;
            }
            let currentViewId = this.currentViewId;
            return Q().then(() => {
                return this.handle.isModifiedRemote();
            })
            .then(modified => {
                if (!modified) {
                    this.callViewMethod("reset");
                    return;
                }
                return Q().then(() => {
                    this.handle.updateToLastVersion();
                    return this.handle.read().then(c => c.getText());
                })
                .then(text => {
                    this.updateTaskStatuses(text);
                    this.callViewMethod("setContent", currentViewId, text);
                });
            })
            .then(() => {
                // this.notesService.setContainerEventsReadStatus(this.entry, true, false);
            });
        });
    }
    
    onViewMimeTypeDetect(mimeType: string): void {
        this.mimeType = mimeType;
    }
    
    onViewNewFileFlagConsumed(): void {
        this.newFile = false;
    }
    
    onViewEnterEditModeByChange(data: string): void {
        if (this.previewMode) {
            return;
        }
        Q().then(() => {
            if (this.openingStartEditModeQuestion) {
                return;
            }
            this.openingStartEditModeQuestion = true;
            return Q().then(() => {
                return this.confirm(this.i18n("plugin.editor.window.editor.enteringEditMode.question"));
            })
            .then(result => {
                if (result.result != "yes") {
                    return;
                }
                return this.enterEditMode(data);
            })
            .fin(() => {
                this.openingStartEditModeQuestion = false;
            });
        });
    }
    
    onViewEnterEditMode(): void {
        this.enterEditMode();
    }
    
    onViewSave(): void {
        let text: string;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.save.text"), true, () => {
            return Q().then(() => {
                return this.hasChangesToSave();
            })
            .then(hasChangesToSave => {
                if (!hasChangesToSave) {
                    return;
                }
                this.callViewMethod("showSavingBanner");
                return Q().then(() => {
                    return this.retrieveFromView<string>("getState");
                })
                .then(t => {
                    text = t;
                    return this.save(text);
                })
                .then(() => {
                    this.callViewMethod("confirmSave", text);
                    this.callViewMethod("hideSavingBanner");
                })
                .fail(e => {
                    this.callViewMethod("hideSavingBanner");
                    return this.onError(e);
                });
            });
        });
    }
    
    onViewHistory(): void {
        if (this.openableFileElement) {
            this.app.dispatchEvent<Types.event.OpenHistoryViewEvent>({
                type: "open-history-view",
                parent: this,
                fileSystem: this.openableFileElement.fileSystem,
                path: this.openableFileElement.path,
                hostHash: this.session.hostHash
            });
        }
    }
    
    onViewExitEditMode(): void {
        this.exitEditMode();
    }
    
    onViewExitEditModeAndClose(): void {
        this.close();
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewOpenMindmapHelp(): void {
        this.app.openSingletonWindow("mindmapHelp", MindmapHelpWindowController);
    }
    
    onViewDistractionFreeModeToggle(): void {
        this.nwin.toggleDistractionFreeMode();
    }
    
    onViewDirtyChange(dirty: boolean): void {
        this.updateDirtyWindowsModel(dirty);
        this.nwin.setDirty(dirty);
    }
    
    onViewFocusedIn() {
        this.app.dispatchEvent({type: "focused-in-preview"});
    }
    
    onViewEnterFromPreviewToEditMode() {
        this.enterEditMode();
    }
    
    enterEditMode(data?: string): Q.Promise<void> {
        return this.addTaskEx(this.i18n("plugin.editor.window.editor.task.enterEditMode.text"), true, () => {
            if (this.editMode) {
                return;
            }
            return Q().then(() => {
                // return this.lock();
            })
            .then(() => {
                return this.handle ? this.handle.isModifiedRemote() : false;
            })
            .then(modified => {
                this.app.dispatchEvent<Types.event.FileOpenedEvent>({
                    type: "file-opened",
                    element: this.openableElement,
                    applicationId: "plugin.editor",
                    docked: this.docked,
                    action: app.common.shelltypes.ShellOpenAction.EXTERNAL,
                    hostHash: this.session.hostHash,
                });
                if (!modified) {
                    return Q().then(() => {
                        if (data) {
                            return data;
                        }
                        if (this.handle) {
                            return this.handle.read().then(c => c.getText());
                        }
                        else {
                            return Q().then(() => {
                                return this.openableElement.getContent()
                            })
                            .then(content => {
                                return content.buffer.toString("utf8");
                            });
                        }
                    })
                    .then(text => {
                        this.editMode = true;
                        this.callViewMethod("switchToEditModeAndChangeContent", text);
                    });
                }
                return Q().then(() => {
                    this.handle.updateToLastVersion();
                    return this.handle.read().then(c => c.getText());
                })
                .then(text => {
                    this.editMode = true;
                    this.callViewMethod("switchToEditModeAndChangeContent", text);
                });
            }).fail(e => {
                if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.message == "locked-in-another-session-by-me") {
                    this.editMode = false;
                    return this.onError(e);
                }
                return Q.reject<void>(e);
            });
        });
    }
    
    exitEditMode(repaintView?: boolean): Q.Promise<boolean> {
        this.manager.refreshState();
        let text: string;
        return Q().then(() => {
            return this.hasChangesToSave();
        })
        .then(hasChangesToSave => {
            if (!hasChangesToSave) {
                return Q().then(() => {
                    // return this.releaseLock();
                })
                .then(() => {
                    this.callViewMethod("afterExitedEditMode");
                    this.editMode = false;
                    if (repaintView !== false) {
                        this.callViewMethod("exitEditModeWithoutChange");
                    }
                    return true;
                });
            }
            return Q().then(() => {
                this.manager.stateChanged(app.BaseWindowManager.STATE_DIRTY);
                return this.confirmEx({
                    message: this.i18n("plugin.editor.window.editor.task.exitEditMode.unsavedWarning.text", [this.openableElement.getName()]),
                    yes: {label: this.i18n("plugin.editor.window.editor.save.confirm.yes.label")},
                    no: {label: this.i18n("plugin.editor.window.editor.save.confirm.no.label")},
                    cancel: {visible: true},
                });
            })
            .then(result => {
                if (result.result == "yes") {
                    return Q().then(() => {
                        return this.retrieveFromView<string>("getState");
                    })
                    .then(t => {
                        text = t;
                        return this.saveWithLockRelease(text);
                    })
                    .then(() => {
                        this.editMode = false;
                        if (repaintView !== false) {
                            this.callViewMethod("exitEditModeWithConfirm", text);
                        }
                        this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
                        return true;
                    });
                }
                else if (result.result == "no") {
                    return Q().then(() => {
                        return this.releaseLock();
                    })
                    .then(() => {
                        this.editMode = false;
                        if (repaintView !== false) {
                            this.callViewMethod("exitEditModeWithRevert");
                        }
                        this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
                        return true;
                    });
                }
                return false;
            })
            .then(exitedEditMode => {
                if (exitedEditMode) {
                    this.callViewMethod("afterExitedEditMode");
                }
                return exitedEditMode;
            });
        });
    }
    
    beforeClose(force?: boolean): Q.IWhenable<void> {
        this.manager.stateChanged(app.BaseWindowManager.STATE_CLOSING);

        if (force || this.handle == null) {
            this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
            clearInterval(this.lockInterval);
            return;
        }
        let controller = this;
        let defer = Q.defer<void>();
        Q().then(() => {
            return controller.exitEditMode(false);
        })
        .then(result => {
            // if close window
            if (result) {
                clearInterval(this.lockInterval);
                this.manager.stateChanged(app.BaseWindowManager.STATE_IDLE);
                this.tasksPlugin.unWatch(this.session, "task", "*", "*", this.taskChangedHandlerBound);
                defer.resolve();
            }
            else {
                this.app.manager.cancelClosing();
                // defer.reject(null);
                defer.reject();
            }
        });
        return defer.promise;
    }
    
    getEntryModel(): Q.Promise<EntryModel> {
        return Q().then(() => {
            if (this.openableElement && this.openableElement instanceof mail.section.OpenableSectionFile) {
                let osf = (<mail.section.OpenableSectionFile>this.openableElement);
                if (osf.section) {
                    return osf.section.getFileTree();
                }
            }
        })
        .then(tree => {
            let boundTasksStr: string = null;
            if (tree) {
                let id = this.openableElement.getElementId();
                let el = tree.collection.find(x => x.id == id);
                if (el) {
                    boundTasksStr = el.meta.bindedElementId;
                }
            }
            let entryName = this.openableElement ? this.openableElement.getName() : "";
            return {
                fileName: entryName,
                title: this.getTitle(),
                canBeEditable: this.openableElement && this.openableElement.isEditable(),
                extl: entryName.substr(entryName.lastIndexOf(".")),
                mimeType: this.openableElement ? this.openableElement.getMimeType() : "",
                boundTasksStr: JSON.stringify(this.tasksPlugin.getBindedTasksData(this.session, boundTasksStr)),
                hostHash: this.session.hostHash,
                sectionId: this.openableElement && this.openableElement instanceof mail.section.OpenableSectionFile && this.openableElement.section ? this.openableElement.section.getId() : null,
            };
        });
    }
    
    refreshName(): void {
        this.getEntryModel().then(model => {
            this.callViewMethod("updateEntry", model);
            this.setTitle(model.title);
        });
    }
    
    hasChangesToSave(): Q.Promise<boolean> {
        let isDirty: boolean;
        return Q().then(() => {
            return this.retrieveFromView<boolean>("isDirty");
        })
        .then(r => {
            isDirty = r;
            return this.retrieveFromView<boolean>("canGetState");
        })
        .then(canGetState => {
            return this.editMode && isDirty && canGetState;
        });
    }
    
    canBeQuietlyClosed(): Q.IWhenable<boolean> {
        return Q().then(() => {
            return this.hasChangesToSave();
        })
        .then(hasChangesToSave => {
            return !hasChangesToSave;
        });
    }
    
    hasOpenedEntry(entry: app.common.shelltypes.OpenableElement): boolean {
        return entry.equals(this.openableElement);
    }
    
    // save(text: string): Q.Promise<void> {
    //     return Q().then(() => {
    //         let content = privfs.lazyBuffer.Content.createFromText(text, this.mimeType);
    //         if (this.handle) {
    //             return this.handle.write(content).thenResolve(null);
    //         }
    //         if (this.openableEditableElement) {
    //             return this.openableEditableElement.save(content);
    //         }
    //     })
    // }

    save(text: string): Q.Promise<void> {
        let content: privfs.lazyBuffer.Content;
        let saved: boolean = false;
        return Q().then(() => {
            let obj: { content: string, metaDataStr?: string } = null;
            try {
                obj = JSON.parse(text);
            }
            catch (e) {}
            if (obj && obj.content) {
                return this.app.prepareHtmlMessageBeforeSending(obj.content, this.session).then(newText => {
                    let { metaData, html } = utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText);
                    obj.metaDataStr = JSON.stringify(metaData);
                    obj.content = html;
                    return JSON.stringify(obj);
                });
            }
            return text;
        })
        .then(newText => {
            text = newText;
            this.releasingLock = true;
            content = privfs.lazyBuffer.Content.createFromText(text, this.mimeType);
            if (this.handle) {
                return this.handle.write(content)
                .catch(e => {
                    if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                        let identity = this.session.sectionManager.client.identity;
                        if (e.data.error.data.lockerPub58 == identity.pub58) {
                            // update lock and save again
                            return this.handle.lock(true)
                            .then(() => {
                                return this.save(text);
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
                    saved = true;
                    if (this.openableElement instanceof mail.section.OpenableSectionFile && this.openableElement.getMimeType() == "application/x-stt") {
                        let openableElement = this.openableElement;
                        return this.openableElement.section.getFileTree().then(tree => {
                            let entry = tree.collection.find(x => x.id == openableElement.id);
                            let obj: any;
                            try {
                                obj = JSON.parse(text);
                            }
                            catch(e) {}
                            if (obj) {
                                let realStyle: app.common.FileStyle = {
                                    styleName: obj.style && obj.style.name && obj.style.name in component.mindmap.Mindmap.AVAILABLE_STYLES ? obj.style.name : component.mindmap.Mindmap.DEFAULT_STYLE_NAME,
                                    fontSize: obj.style && obj.style.fontSize && obj.style.fontSize in component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? obj.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE,
                                    margin: obj.style && obj.style.margin && obj.style.margin in component.mindmap.Mindmap.AVAILABLE_MARGINS ? obj.style.margin : component.mindmap.Mindmap.DEFAULT_MARGIN,
                                };
                                return this.app.fileStyleResolver.setStyle(entry, this.handle, realStyle);
                            }
                        });
                    }
                    return;
                })
                
            }
        })
        .then(() => {
            if (this.openableEditableElement) {
                let osf = (<mail.section.OpenableSectionFile>this.openableEditableElement);
                if (!saved) {
                    if (osf.section) {
                        return (<any>osf.section).saveFile(osf.path, content, this.handle, osf, true);
                    }
                }
                else {
                    // already saved
                    if (osf.section) {
                        return (<any>osf.section).getChatModule().sendSaveFileMessage(osf.section.getId(), osf.path);
                    }
                }
            }
            else if (this.openableElement && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
                return this.openableElement.save(content);
            }
        })
        .fin(() => {
            this.releasingLock = false;
        });
    }

    saveFileAsConflicted(content: privfs.lazyBuffer.Content): Q.Promise<void> {
        return Q().then(() => {
            let openableFile = (this.openableElement as mail.section.OpenableSectionFile);
            let currentSectionId: string = openableFile.section.getId();
            let fname = this.createConflictedFileName(openableFile)
            let newOpenableFile: mail.section.OpenableSectionFile;
            return openableFile.fileSystem.resolvePath(fname)
            .then(resolvedPath => {
                return openableFile.fileSystem.save(resolvedPath.path, content).thenResolve(resolvedPath.path);
            })
            .then(newPath => {
                newOpenableFile = new mail.section.OpenableSectionFile(this.session.sectionManager.getSection(currentSectionId), openableFile.fileSystem, newPath, true);
                return newOpenableFile.refresh()
                .then(() => {
                    return newOpenableFile.fileSystem.openFile(newPath, privfs.fs.file.Mode.READ_WRITE)
                })
            })
            .then(newHandle => {
                this.handle = newHandle;
                
                this.openableElement = newOpenableFile;
                return this.getEntryModel().then(model => {
                    let text = content.getText();
                    this.updateTaskStatuses(text);
                    let newFullFileName = newOpenableFile.path;
                    let newFileName: string = newFullFileName.substr(newFullFileName.lastIndexOf("/") + 1);
                    this.updateFileName(newFileName, newFullFileName, this.getTitle(newFullFileName));
                    if (this.app.isElectronApp()) {
                        this.app.filesLockingService.showWarning(newOpenableFile.path);
                    }
                });
            })
            .fail(e => {
                return Q.reject(e);
            })
        })
    }

    createConflictedFileName(openableFile: app.common.shelltypes.OpenableFile): string {
        try {
            // console.log("orig path:", openableFile.path);
            let parentPath = openableFile.path.split("/").slice(0, -1).join("/");
            // console.log("parent path: ", parentPath);
            let fileName = openableFile.getName();
            // console.log("filename:", fileName);
            let fileParts = fileName.split(".");
            let ext: string = "";
            if (fileParts.length > 1) {
                ext = fileParts[fileParts.length - 1];
                fileName = fileParts.slice(0, -1).join(".");
            }
            
            let formatter = new utils.Formatter();
            let conflictedCopyStr = this.app.localeService.i18n("plugin.editor.window.editor.saveAsConflicted.conflictedCopy");
            let dateString = formatter.standardDate(new Date()).replace(/:/g, "-").replace(/ /g, "-");
            return parentPath + "/" + fileName + " - " + conflictedCopyStr + " - " + dateString + (ext.length > 0 ? "." + ext : "");
        } catch (e) {
            console.log("error creating filename",e);
        }
    }

    saveWithLockRelease(text: string): Q.Promise<void> {
        return Q().then(() => {
            let content = privfs.lazyBuffer.Content.createFromText(text, this.mimeType);
            if (this.handle) {
                this.releasingLock = true;
                return this.handle.write(content, {releaseLock: true}).thenResolve(null);
            }
            if (this.openableEditableElement) {
                let osf = (<mail.section.OpenableSectionFile>this.openableEditableElement);
                if (osf.section) {
                    return (<any>osf.section).saveFile(content, this.handle, osf, true);
                }
            }
        })
        .fin(() => {
            this.releasingLock = false;
        });
    }

    
    releaseLock(): Q.Promise<void> {
        return Q().then(() => {
            this.releasingLock = true;
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
    
    lockChecker(): void {
        if (!this.editMode || this.handle == null || this.releasingLock || this.networkIsDown()) {
            return;
        }
        let controller = this;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.relock.text"), true, () => {
            return controller.lock(false);
        })
    }
    
    lock(withVersionUpdate: boolean = true): Q.Promise<void> {
        return Q();
        // return Q().then(() => {
        //     if (this.handle) {
        //         return this.handle.lock(false, withVersionUpdate) //robimy lock, ale bez update wersji..
        //         .fail(e => {
        //             return this.lockedByMeInOtherSession(e)
        //         })
        //     }
        // })
    }

    autoSave(): Q.Promise<void> {
        return Q().then(() => {
            if (!this.handle) {
                this.logError("invalid handle on autosave");
                return;
            }
            let text: string;
            this.addTaskEx(this.i18n("plugin.editor.window.editor.task.autosave.text"), true, () => {
                return Q().then(() => {
                    return this.hasChangesToSave();
                })
                .then(hasChangesToSave => {
                    if (! hasChangesToSave) {
                        return;
                    }
                    // return this.handle.lock(false, false)
                    return Q().then(() => {
                        return this.retrieveFromView<string>("getState");
                    })
                    .then(t => {
                        text = t;
                        return this.save(text)
                    })
                    .then(() => {
                        this.callViewMethod("confirmSave", text);
                    })
                })
            });
        })
    }

    saveFileAsRecovery(text: string): Q.Promise<void> {
        let section: mail.section.SectionService;
        let osf: mail.section.OpenableSectionFile;
        let filesService: mail.section.FileSystemModuleService;
        let recoveryHandle: privfs.fs.descriptor.Handle;

        return Q().then(() => {
            if (! this.openableEditableElement) {
                return;
            }

            osf = (<mail.section.OpenableSectionFile>this.openableEditableElement);
            section = osf.section;
            filesService = section.getFileModule();

            return filesService.getFileSystem();
        })
        .then(fs => {
            let content = privfs.lazyBuffer.Content.createFromText(text, this.mimeType);

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
                .fail(e => {
                    this.logError(e);
                })
            }
            else {
                let acl = filesService.getDescriptorAcl();
                let destPath = mail.filetree.nt.Helper.resolvePath("/", osf.getName());
                return fs.createEx(destPath, content, true, {acl: acl})
                .then(fInfo => {
                    this.lastRecoveryFilePath = fInfo.path;
                })
            }
        })
    }
    
    lockedByMeInOtherSession(e: any): Q.Promise<void> {
        let identity = this.session.sectionManager.identity;
        return Q().then(() => {
            if (!privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.data.error.data.lockerPub58 != identity.pub58) {
                return Q.reject<wnd.msgbox.MsgBoxResult>(e);
            }
            let msg = this.i18n("plugin.editor.window.editor.error.anotherSessionLock");
            return this.confirm(msg);
        })
        .then(result => {
            if (result.result != "yes") {
                throw new Error("locked-in-another-session-by-me");
            }
            // if (this.handle) {
            //     return this.handle.lock(true);
            // }
        });
    }
    
    onErrorRethrow(e: any): void {
        this.onError(e);
        throw e;
    }
    
    onError(e: any): Q.Promise<any> {
        return Q().then(() => {
            if (e.message == "locked-in-another-session-by-me") {
                return;
            }
            this.logError(e);
            if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                if (this.editMode && !this.releasingLock) {
                    this.lockedByMeInOtherSession(e);
                }
                else {
                    let pub58 = e.data.error.data.lockerPub58;
                    // let contact = this.contactService.getContactByPub58(pub58);
                    let contact = this.session.conv2Service.contactService.getContactByPub58(pub58);
                    let msg;
                    if (contact) {
                        msg = this.i18n("plugin.editor.window.editor.error.anotherUserLock.known", [contact.getDisplayName()]);
                    }
                    else {
                        msg = this.i18n("plugin.editor.window.editor.error.anotherUserLock.unknown", [pub58]);
                    }
                    this.alert(msg);
                }
            }
            else if (privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
                let controller = this;
                Q().then(() => {
                    return controller.handle.refresh();
                })
                .then(() => {
                    let msg = controller.i18n("plugin.editor.window.editor.error.modifiedAlready");
                    return controller.confirm(msg);
                })
                .then(result => {
                    let lastVersion = controller.handle.updateToLastVersion();
                    if (result.result != "yes") {
                        return;
                    }
                    let currentViewId = this.currentViewId;
                    return controller.addTaskEx(controller.i18n("plugin.editor.window.editor.task.load.text"), true, () => {
                        return Q().then(() => {
                            return controller.handle.read().then(c => c.getText());
                        })
                        .then(text => {
                            this.updateTaskStatuses(text);
                            controller.callViewMethod("setContent", currentViewId, text);
                        })
                        .fail(e => {
                            controller.handle.currentVersion = lastVersion;
                            return Q.reject(e);
                        });
                    });
                });
            }
            else {
                return this.errorAlert(this.prepareErrorMessage(e), e);
            }
        })
    }
    
    destroy(): void {
        this.stopAutoSaveInterval();
        super.destroy();
        this.stopLockInterval();
        this.updateDirtyWindowsModel(false);
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
                this.lockChecker()
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
    

    updateDirtyWindowsModel(dirty: boolean): void {
        dirty = dirty && this.editMode;
        let dwm = EditorWindowController.DirtyWindowsModel;
        let data = dwm.get();
        let idx = data.indexOf(this);
        if (dirty && idx == -1) {
            data.push(this);
        }
        else if (!dirty && idx != -1) {
            data.splice(idx, 1);
        }
        else {
            return;
        }
        dwm.set(data);
    }
    
    reopen(openableElement: app.common.shelltypes.OpenableElement, force: boolean = false) {
        if (!this.previewMode && !force) {
            throw new Error("Cannot reopen when not in preview mode");
        }
        let wasNoElement = this.openableElement === null;
        // if (this.app.isElectronApp()) {
        //     (<any>this.app).externalFilesService.registerPreview(openableElement.getElementId(), (isLockSet: boolean) => {
        //         this.editorButtons.refreshButtonsState();
        //     })
        // }
        this.currentViewId++;
        this.openableElement = openableElement;
        this.openableEditableElement = this.openableElement && this.openableElement.isEditable() ?  this.openableElement : null;
        this.openableFileElement = this.openableElement instanceof app.common.shelltypes.OpenableFile ? this.openableElement : null;
        let isText = openableElement.getMimeType() == "application/x-stt";
        this.afterViewLoadedDeferred = Q.defer<void>();
        return (isText ? this.prepareForDisplay(openableElement) : Q(null))
        .then((style: app.common.FileStyle) => {
            return this.viewLoadedDeferred.promise.thenResolve(style);
        })
        .then(style => {
            this.setWindowIcon(this.openableElement);
            this.refreshName();
            this.callViewMethod("reopen", this.currentViewId, wasNoElement);
            if (this.app.isElectronApp() && (<any>this.openableElement).openableElementType == "LocalOpenableElement") {
                this.watcher = new LocalFfWatcher();
                this.watcher.watch(this.openableElement.getElementId(), this.onChangeLocalContent.bind(this));
            }
            if (wasNoElement) {
                this.updatePreTitleIcon();
            }
        })
        .then(() => {
            return this.afterViewLoadedDeferred.promise;
        })
        .fin(() => {
            this.editorButtons.refreshButtonsState();
        });
    }
    
    updateCachedStyleName(text: string): void {
        if (!(this.openableElement instanceof mail.section.OpenableSectionFile)) {
            return;
        }
        let openableElement: mail.section.OpenableSectionFile = this.openableElement;
        let isText = this.openableElement.getMimeType() == "application/x-stt";
        if (isText && this.handle) {
            let obj: any;
            try {
                obj = JSON.parse(text);
            }
            catch(e) {}
            if (obj) {
                let realStyle: app.common.FileStyle = {
                    styleName: obj.style && obj.style.name && obj.style.name in component.mindmap.Mindmap.AVAILABLE_STYLES ? obj.style.name : component.mindmap.Mindmap.DEFAULT_STYLE_NAME,
                    fontSize: obj.style && obj.style.fontSize && obj.style.fontSize in component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? obj.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE,
                    margin: obj.style && obj.style.margin && obj.style.margin in component.mindmap.Mindmap.AVAILABLE_MARGINS ? obj.style.margin : component.mindmap.Mindmap.DEFAULT_MARGIN,
                };
                this.app.fileStyleResolver.cacheStyle(openableElement.id, realStyle);
            }
        }
    }
    
    prepareForDisplay(openableElement: app.common.shelltypes.OpenableElement): Q.Promise<app.common.FileStyle> {
        if (openableElement instanceof mail.section.OpenableSectionFile) {
            return openableElement.section.getFileTree().then(tree => {
                let entry = tree.collection.find(x => x.id == openableElement.id);
                return this.app.fileStyleResolver.getStyle(entry);
            })
            .then(style => {
                this.callViewMethod("setStyle", style.styleName, style.fontSize, style.margin, false);
                return style;
            });
        }
        return Q(null);
    }
    
    release() {
        if (!this.previewMode) {
            throw new Error("Cannot release when not in preview mode");
        }
        // if (this.app.isElectronApp() && this.openableElement) {
        //     (<any>this.app).externalFilesService.unregisterPreview(this.openableElement.getElementId());
        // }
        this.currentViewId++;
        this.openableElement = null;
        this.openableEditableElement = null
        this.openableFileElement = null;
        this.refreshName();
        this.callViewMethod("release", this.currentViewId);
    }
    
    afterIframeHide(): void {
        this.callViewMethod("toggleEditorHidden", true);
    }
    
    afterIframeShow(): void {
        this.callViewMethod("toggleEditorHidden", false);
    }
    
    onViewClipboardPaste(): void {
        let supportedFormats = ["text", "MindMapElement"];
        let data: app.common.clipboard.ClipboardData = {};
        supportedFormats.forEach(format => {
            if (this.app.clipboard.hasFormat(format)) {
                data[format] = this.app.clipboard.getFormat(format);
            }
        });
        this.callViewMethod("clipboardPaste", data);
    }
    
    onViewClipboardCopy(data: app.common.clipboard.ClipboardData): void {
        this.app.clipboard.set(data);
    }
    
    onViewDownload(): void {
        this.editorButtons.onViewExport();
    }
    
    onViewSend(): void {
        this.editorButtons.onViewSend();
    }
    
    saveBeforePrinting(): Q.Promise<void> {
        let text: string = "";
        return Q().then(() => {
            return this.hasChangesToSave();
        })
        .then(hasChangesToSave => {
            if (!hasChangesToSave) {
                return;
            }
            return Q().then(() => {
                return this.retrieveFromView<string>("getState");
            })
            .then(t => {
                text = t;
                return this.save(text);
            })
            .then(() => {
                this.callViewMethod("confirmSave", text);
            })
            .fail(e => {
                return Q.reject(e);
            });
        });
    }
    
    onViewPrint(): void {
        this.editorButtons.onViewPrint();
    }
    
    onViewSaveAsPdf(): void {
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        if (this.openableElement) {
            this.saveBeforePrinting().then(() => {
                let notificationId = this.notifications.showNotification(this.i18n("plugin.editor.window.editor.notifier.savingAsPdf"), {autoHide: false, progress: true});
                let parentController = this.getClosestNotDockedController();
                let parent = parentController ? parentController.nwin : null;
                this.app.saveAsPdf(this.session, this.openableElement, parent)
                .then(() => {
                    setTimeout(() => {
                        this.notifications.showNotification(this.i18n("plugin.editor.window.editor.notifier.savedAsPdf"));
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
    
    onViewPdfOutput(data: string) {
        let buffer = new Buffer(data, "binary");
        let fileName = mail.filetree.Path.splitFileName(this.openableElement ? this.openableElement.getName() : "document.stt").name + ".pdf";
        let content = privfs.lazyBuffer.Content.createFromBuffer(buffer, "application/pdf", fileName);
        this.app.directSaveContent(content, this.session);
        this.onViewSavedAsPdf();
    }
    
    onViewAttachToTask(): void {
        this.editorButtons.attachToTask(this.handle);
    }
    
    prepareToPrint(scale: boolean = false): Q.Promise<void> {
        if (this.prepareToPrintDeferred == null) {
            this.prepareToPrintDeferred = Q.defer();
            this.viewLoadedDeferred.promise.then(() => {
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
                    this.editorPlugin.openTask(this.session, resolved.section.getId(), result.taskId);
                }
            });
        }
        else {
            taskId = taskIdsStr;
            this.editorPlugin.openTask(this.session, resolved.section.getId(), taskId);
        }
    }
    
    getTitle(overridePath?: string): string {
        if (!this.openableElement) {
            return "";
        }
        if (this.openableElement instanceof mail.section.OpenableSectionFile) {
            let parsed = mail.filetree.nt.Entry.parseId(this.openableElement.id);
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
    
    getPreTitleIcon(): Types.app.PreTitleIcon {
        if (!this.openableElement) {
            return null;
        }
        if (this.openableElement instanceof mail.section.OpenableSectionFile) {
            let parsed = mail.filetree.nt.Entry.parseId(this.openableElement.id);
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
    
    updatePreTitleIcon(): void {
        let icon = this.getPreTitleIcon();
        this.nwin.updatePreTitleIcon(icon);
    }
    
    onViewGetTaskStatuses(channelId: number, taskIdsStr: string): void {
        let taskIds: string[] = JSON.parse(taskIdsStr);
        let statuses: { [taskId: string]: string } = {};
        this.tasksPlugin.addTaskStatusesFromTaskIds(this.session, statuses, taskIds);
        this.sendToViewChannel(channelId, JSON.stringify(statuses));
    }
    
    taskChangedHandler(): void {
        //@todo this.updateTaskStatuses(false);
    }
    
    updateTaskStatuses(text: string): void {
        let statuses: { [taskId: string]: string } = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, statuses, text);
        this.callViewMethod("setTaskStatuses", JSON.stringify(statuses));
    }
    
    updateFileName(newFileName: string, newFullFileName: string, newTitle: string): void {
        this.updatedFullFileName = newFullFileName;
        this.setTitle(newTitle);
        this.callViewMethod("updateFileName", newFileName, newFullFileName, newTitle);
    }


    private async getEntryFromOpenableFile(openableElement: app.common.shelltypes.OpenableElement): Promise<mail.filetree.nt.Entry> {
        if (openableElement instanceof mail.section.OpenableSectionFile) {
            let tree = await openableElement.section.getFileTree();
            let entry = tree.collection.list.find(x => x.name == openableElement.getName())
            return entry;    
        }
        else
        if (((<any>this.openableElement).openableElementType == "LocalOpenableElement")) {
            let entry = (<any>openableElement).entry;
            return entry;
        }
    }

    onViewRename(): void {
        if (this.isRenaming) {
            return;
        }
        this.isRenaming = true;
        Q().then(() => {
            return this.getEntryFromOpenableFile(this.openableElement)
            .then(entry => {
                return this.promptEx({
                    width: 400,
                    height: 140,
                    title: this.i18n("plugin.editor.window.editor.rename.message"),
                    input: {
                        multiline: false,
                        value: this.openableElement.name
                    },
                    selectionMode: entry.isDirectory() ? "all" : "filename",
                })    
            })
        })
        .then(result => {
            if (result.result == "ok" && result.value != this.openableElement.name) {
                let notificationId = this.notifications.showNotification(this.i18n("plugin.editor.window.editor.rename.notification.renaming"), { autoHide: false, progress: true });
                let notifKey: string = "renamed";
                return Q().then(() => {
                    if (this.openableElement instanceof mail.section.OpenableSectionFile) {
                        let osf: mail.section.OpenableSectionFile = this.openableElement;
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
                            this.notifications.showNotification(this.i18n(`plugin.editor.window.editor.rename.notification.${notifKey}`));
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
        return this.app.filesLockingService.isLocked(this.session, this.openableElement);
    }

    canUnlockFile(): Q.Promise<boolean> {
        return this.app.filesLockingService.canUnlockFile(this.session, this.openableElement);
    }

    lockFile(): Q.Promise<void> {
        return Q().then(() => {
            if (this.openableElement && !this.openableElement.isLocalFile()) {
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
        if (this.openableElement && !this.openableElement.isLocalFile()) {
            return this.app.filesLockingService.manualUnlockFile(this.session, this.openableElement);
        }
    }

    updateLockUnlockButtons(): Q.Promise<void> {
        // update toolbar buttons
        return Q().then(() => {
            return Q.all([
                this.newFile ? Q.resolve(false) : this.isFileLocked(), // jezeli nowy plik, to nie sprawdzaj lockow, tylko zworc wartosci domyslne
                this.newFile ? Q.resolve(false) : this.canUnlockFile()
            ])
        })
        .then(res => {
            let [canUnlock, locked] = res;
            this.updateLockInfoOnActionButtons(locked, canUnlock);
            if (this.editorButtons) {
                this.editorButtons.updateLockState(locked, canUnlock);
            }
        })
    }

    updateLockInfoOnActionButtons(locked: boolean, canUnlock: boolean) {
        this.callViewMethod("updateLockInfoOnActionButtons", locked, canUnlock);
    }

    onViewLockFile(): void {
        this.lockFile();
    }

    onViewUnlockFile(): void {
        this.unlockFile();
    }
    
}
