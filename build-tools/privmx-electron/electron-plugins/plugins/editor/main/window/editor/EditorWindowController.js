"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var MindmapHelpWindowController_1 = require("../mindmaphelp/MindmapHelpWindowController");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var LocalFsWatcher_1 = require("../../main/LocalFsWatcher");
var index_1 = require("./i18n/index");
var Logger = pmc_mail_1.Logger.get("EditorWindowController");
var EditorWindowController = (function (_super) {
    __extends(EditorWindowController, _super);
    function EditorWindowController(parentWindow, session, options) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.session = session;
        _this.options = options;
        _this.prepareToPrintDeferred = null;
        _this.viewLoadedDeferred = pmc_mail_1.Q.defer();
        _this.isPrinting = false;
        _this.isSavingAsPdf = false;
        _this.initialStyleName = pmc_mail_1.component.mindmap.Mindmap.DEFAULT_STYLE_NAME;
        _this.prepareBeforeShowingDeferred = null;
        _this.updatedFullFileName = null;
        _this.isRenaming = false;
        _this.afterViewLoadedDeferred = pmc_mail_1.Q.defer();
        _this.ipcMode = true;
        _this.tasksPlugin = _this.app.getComponent("tasks-plugin");
        _this.taskChangedHandlerBound = _this.taskChangedHandler.bind(_this);
        _this.tasksPlugin.watch(_this.session, "task", "*", "*", _this.taskChangedHandlerBound);
        if (options.action == pmc_mail_1.app.common.shelltypes.ShellOpenAction.PRINT) {
            _this.addViewScript({ path: "build/pdf/html2pdf.js/dist/html2pdf.bundle.min.js" });
        }
        _this.personsComponent = _this.addComponent("persons", _this.componentFactory.createComponent("persons", [_this]));
        _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        _this.editorButtons = _this.addComponent("editorbuttons", _this.componentFactory.createComponent("editorbuttons", [_this]));
        _this.editorButtons.setSession(_this.session);
        _this.taskTooltip = _this.addComponent("tasktooltip", _this.componentFactory.createComponent("tasktooltip", [_this]));
        _this.taskTooltip.getContent = function (taskId) {
            return _this.tasksPlugin.getTaskTooltipContent(_this.session, taskId);
        };
        _this.taskChooser = _this.addComponent("taskchooser", _this.componentFactory.createComponent("taskchooser", [_this, _this.app, {
                createTaskButton: false,
                includeTrashed: false,
                popup: true,
                session: _this.session
            }]));
        _this.currentViewId = 1;
        _this.docked = !!options.docked;
        _this.newFile = options.newFile;
        _this.openableElement = options.entry;
        _this.openableEditableElement = _this.openableElement && _this.openableElement.isEditable() ? _this.openableElement : null;
        _this.openableFileElement = _this.openableElement instanceof pmc_mail_1.app.common.shelltypes.OpenableFile ? _this.openableElement : null;
        _this.previewMode = !!options.preview || (_this.openableEditableElement == null && _this.openableElement != null);
        _this.editMode = !_this.previewMode && !!options.editMode && _this.openableEditableElement != null;
        _this.editorPlugin = _this.app.getComponent("editor-plugin");
        _this.setPluginViewAssets("editor");
        if (_this.docked) {
            _this.openWindowOptions.widget = false;
            _this.openWindowOptions.decoration = false;
        }
        else {
            _this.printMode = options.action == pmc_mail_1.app.common.shelltypes.ShellOpenAction.PRINT;
            var availWidth = _this.app.isElectronApp() ? _this.app.getScreenResolution().width : window.innerWidth;
            var windowWidth = Math.min(1200, 0.8 * availWidth);
            var title = _this.getTitle();
            _this.openWindowOptions = {
                toolbar: false,
                maximized: false,
                show: false,
                hidden: _this.printMode,
                position: "center",
                minWidth: 450,
                minHeight: 215,
                width: _this.printMode ? (_this.app.isElectronApp() ? 700 : 760) : windowWidth,
                height: "75%",
                resizable: true,
                title: title,
                icon: _this.openableElement ? _this.app.shellRegistry.resolveIcon(_this.openableElement.getMimeType()) : "application/x-stt",
                preTitleIcon: _this.getPreTitleIcon(),
                keepSpinnerUntilViewLoaded: true,
                manualSpinnerRemoval: true,
            };
            if (_this.printMode) {
                _this.openWindowOptions.widget = false;
            }
        }
        var client = _this.session.sectionManager.client;
        _this.registerPmxEvent(client.storageProviderManager.event, _this.onStorageEvent);
        if (_this.app.isElectronApp() && _this.openableElement && _this.openableElement.openableElementType == "LocalOpenableElement") {
            _this.watcher = new LocalFsWatcher_1.LocalFfWatcher();
            _this.watcher.watch(_this.openableElement.getElementId(), _this.onChangeLocalContent.bind(_this));
        }
        _this.editorOpenDate = Date.now();
        _this.bindEvent(_this.app, "file-lock-changed", function (event) {
            if (_this.openableFileElement) {
                var did = _this.openableFileElement.handle.descriptor.ref.did;
                if (did == event.did) {
                    _this.updateLockUnlockButtons();
                }
            }
        });
        _this.enableTaskBadgeAutoUpdater();
        _this.prepareBeforeShowing();
        _this.bindEvent(_this.app, "fileRenamed", function (event) {
            if (!_this.openableElement) {
                return;
            }
            var newFullFileName = null;
            if (event.isLocal) {
                if (_this.app.isElectronApp() && _this.openableElement.openableElementType == "LocalOpenableElement") {
                    if (event.oldPath == _this.openableElement.getElementId() || (_this.updatedFullFileName && event.oldPath == _this.updatedFullFileName)) {
                        newFullFileName = event.newPath;
                        _this.openableElement.reopenRenamed(event.newPath.substr(event.newPath.lastIndexOf("/") + 1));
                    }
                }
            }
            else {
                if (_this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile && (_this.openableElement.path == event.oldPath || (_this.updatedFullFileName && event.oldPath == _this.updatedFullFileName))) {
                    var hostHash = event.hostHash || _this.app.sessionManager.getLocalSession().hostHash;
                    if (hostHash == _this.session.hostHash) {
                        newFullFileName = event.newPath;
                        var id = _this.openableElement.id;
                        _this.openableElement.name = event.newPath.substr(event.newPath.lastIndexOf("/") + 1);
                        _this.openableElement.id = id.substr(0, id.indexOf("|/") + 2) + _this.openableElement.name;
                        _this.openableElement.path = newFullFileName;
                    }
                }
            }
            if (newFullFileName) {
                var newFileName = newFullFileName.substr(newFullFileName.lastIndexOf("/") + 1);
                _this.updateFileName(newFileName, newFullFileName, _this.getTitle(newFullFileName));
            }
        });
        return _this;
    }
    EditorWindowController_1 = EditorWindowController;
    EditorWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    EditorWindowController.prototype.getButtonsStateWithUpdatedLock = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var state = _this.getButtonsState();
            return pmc_mail_1.Q.all([
                _this.newFile ? pmc_mail_1.Q.resolve(false) : _this.isFileLocked(),
                _this.newFile ? pmc_mail_1.Q.resolve(false) : _this.canUnlockFile()
            ])
                .then(function (res) {
                var locked = res[0], canUnlock = res[1];
                state.lock = !locked;
                state.unlock = locked && canUnlock;
                return state;
            });
        });
    };
    EditorWindowController.prototype.getButtonsState = function () {
        var state = this.editorButtons.getDefaultButtonsState();
        state.enabled = this.previewMode;
        state.print = true;
        state.saveAsPdf = true;
        return state;
    };
    EditorWindowController.prototype.init = function () {
        var _this = this;
        return this.editorPlugin.getNotesPreferences().then(function (notesPreferences) {
            _this.notesPreferences = notesPreferences;
        });
    };
    EditorWindowController.prototype.onStorageEvent = function (event) {
        if (event.type == "descriptor-new-version" && this.openableFileElement && event.descriptor.ref.id == this.openableFileElement.handle.ref.id) {
            this.onChangeContent();
        }
    };
    EditorWindowController.prototype.onChangeContent = function () {
        var _this = this;
        this.getEntryModel().then(function (model) {
            if (model) {
                _this.callViewMethod("setBoundTasksStr", model.boundTasksStr);
            }
        });
        if (!this.previewMode || this.handle == null) {
            return;
        }
        var currentViewId = this.currentViewId;
        var handle = this.handle;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.reload.text"), true, function () {
            return pmc_mail_1.Q().then(function () {
                return handle.isModifiedRemote();
            })
                .then(function (modified) {
                if (!modified) {
                    return;
                }
                return pmc_mail_1.Q().then(function () {
                    handle.updateToLastVersion();
                    return handle.read().then(function (c) { return c.getText(); });
                })
                    .then(function (text) {
                    _this.updateCachedStyleName(text);
                    _this.updateTaskStatuses(text);
                    _this.callViewMethod("updateContentPreview", currentViewId, text);
                });
            });
        });
    };
    EditorWindowController.prototype.onChangeLocalContent = function () {
        var _this = this;
        if (!this.previewMode) {
            return;
        }
        var currentViewId = this.currentViewId;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.reload.text"), true, function () {
            return pmc_mail_1.Q().then(function () {
                return pmc_mail_1.Q().then(function () {
                    return _this.openableElement.getContent();
                })
                    .then(function (content) {
                    return content.buffer.toString("utf8");
                })
                    .then(function (text) {
                    _this.updateTaskStatuses(text);
                    _this.callViewMethod("updateContentPreview", currentViewId, text);
                });
            })
                .fail(function (e) { });
        });
    };
    EditorWindowController.prototype.getModel = function () {
        return {
            currentViewId: this.currentViewId,
            previewMode: this.previewMode,
            printMode: this.printMode,
            docked: this.docked,
            initialStyleName: this.initialStyleName,
        };
    };
    EditorWindowController.prototype.prepareBeforeShowing = function () {
        var _this = this;
        if (this.prepareBeforeShowingDeferred) {
            return this.prepareBeforeShowingDeferred.promise.isFulfilled() ? null : this.prepareBeforeShowingDeferred.promise;
        }
        this.prepareBeforeShowingDeferred = pmc_mail_1.Q.defer();
        return pmc_mail_1.Q()
            .then(function () {
            return _super.prototype.prepareBeforeShowing.call(_this);
        })
            .then(function () {
            var el = _this.options && _this.options.entry && _this.options.entry instanceof pmc_mail_1.mail.section.OpenableSectionFile ? _this.options.entry : null;
            if (el && el.section && el.handle && el.handle.ref) {
                return el.section.getFileTree().then(function (tree) {
                    var entry = tree.collection.find(function (x) { return x && x.ref && x.ref.did == el.handle.ref.did; });
                    if (entry) {
                        return _this.app.fileStyleResolver.getStyle(entry);
                    }
                })
                    .then(function (style) {
                    if (style && style.styleName && style.styleName in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_STYLES) {
                        _this.initialStyleName = style.styleName;
                        _this.openWindowOptions.backgroundColor = pmc_mail_1.component.mindmap.Mindmap.STYLE_BACKGROUNDS[style.styleName];
                        var opts = _this.loadWindowOptions;
                        if (!opts.extraBodyAttributes) {
                            opts.extraBodyAttributes = {};
                        }
                        opts.extraBodyAttributes["data-style-name"] = style.styleName;
                    }
                    _this.prepareBeforeShowingDeferred.resolve();
                });
            }
            else {
                _this.prepareBeforeShowingDeferred.resolve();
            }
        });
    };
    EditorWindowController.prototype.onViewLoad = function () {
        var _this = this;
        this.viewLoadedDeferred.resolve();
        this.stopLockInterval();
        this.addTask(this.i18n("plugin.editor.window.editor.task.load.text"), true, function () {
            var currentViewId = _this.currentViewId;
            var openableElement = _this.openableElement;
            var openableFileElement = _this.openableFileElement;
            if (openableElement == null) {
                return;
            }
            return pmc_mail_1.Q().then(function () {
                return _this.getButtonsStateWithUpdatedLock()
                    .then(function (buttonsState) {
                    _this.editorButtons.callViewMethod("setButtonsState", buttonsState);
                });
            })
                .then(function () {
                if (openableFileElement == null && openableElement) {
                    return pmc_mail_1.Q().then(function () {
                        return openableElement.getContent();
                    })
                        .then(function (content) {
                        return content.buffer.toString("utf8");
                    });
                }
                else {
                    return pmc_mail_1.Q().then(function () {
                        return openableFileElement.fileSystem.openFile(openableFileElement.path, pmc_mail_1.privfs.fs.file.Mode.READ_WRITE);
                    })
                        .then(function (handle) {
                        if (_this.currentViewId != currentViewId) {
                            return;
                        }
                        _this.handle = handle;
                        if (!_this.editMode) {
                            return;
                        }
                    })
                        .then(function () {
                        return _this.handle && _this.currentViewId == currentViewId ? _this.handle.read().then(function (c) { return c.getText(); }) : null;
                    });
                }
            })
                .then(function (text) {
                _this.updateCachedStyleName(text);
                if (_this.currentViewId != currentViewId) {
                    return;
                }
                return _this.getEntryModel().then(function (model) {
                    _this.updateTaskStatuses(text || "");
                    _this.callViewMethod("load", currentViewId, text, _this.docked, _this.editMode, model, _this.newFile, _this.notesPreferences);
                    _this.startLockInterval();
                    _this.startAutoSaveInterval();
                })
                    .then(function () {
                    return _this.updateLockUnlockButtons();
                });
            })
                .then(function () {
                var descriptor = _this.handle.descriptor;
                _this.lastDescriptorInfo = { did: descriptor.ref.did, version: descriptor.lastVersion.raw.signature, serverDate: descriptor.lastVersion.raw.serverDate, modifier: descriptor.lastVersion.raw.modifier };
                _this.afterViewLoadedDeferred.resolve();
            })
                .fail(function (e) {
                if (!(_this.previewMode && e && e.errorObject && e.errorObject.code == 12289)) {
                    _this.logError(e);
                    _this.errorAlert(_this.prepareErrorMessage(e), e)
                        .then(function () {
                        _this.close(true);
                    });
                }
                _this.startLockInterval();
                return pmc_mail_1.Q.reject(e);
            })
                .fin(function () {
                _this.nwin.removeSpinner();
            });
        });
        this.initSpellChecker();
    };
    EditorWindowController.prototype.onViewReload = function () {
        var _this = this;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.reload.text"), true, function () {
            if (_this.editMode || _this.openableFileElement == null) {
                return;
            }
            var currentViewId = _this.currentViewId;
            return pmc_mail_1.Q().then(function () {
                return _this.handle.isModifiedRemote();
            })
                .then(function (modified) {
                if (!modified) {
                    _this.callViewMethod("reset");
                    return;
                }
                return pmc_mail_1.Q().then(function () {
                    _this.handle.updateToLastVersion();
                    return _this.handle.read().then(function (c) { return c.getText(); });
                })
                    .then(function (text) {
                    _this.updateTaskStatuses(text);
                    _this.callViewMethod("setContent", currentViewId, text);
                });
            })
                .then(function () {
            });
        });
    };
    EditorWindowController.prototype.onViewMimeTypeDetect = function (mimeType) {
        this.mimeType = mimeType;
    };
    EditorWindowController.prototype.onViewNewFileFlagConsumed = function () {
        this.newFile = false;
    };
    EditorWindowController.prototype.onViewEnterEditModeByChange = function (data) {
        var _this = this;
        if (this.previewMode) {
            return;
        }
        pmc_mail_1.Q().then(function () {
            if (_this.openingStartEditModeQuestion) {
                return;
            }
            _this.openingStartEditModeQuestion = true;
            return pmc_mail_1.Q().then(function () {
                return _this.confirm(_this.i18n("plugin.editor.window.editor.enteringEditMode.question"));
            })
                .then(function (result) {
                if (result.result != "yes") {
                    return;
                }
                return _this.enterEditMode(data);
            })
                .fin(function () {
                _this.openingStartEditModeQuestion = false;
            });
        });
    };
    EditorWindowController.prototype.onViewEnterEditMode = function () {
        this.enterEditMode();
    };
    EditorWindowController.prototype.onViewSave = function () {
        var _this = this;
        var text;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.save.text"), true, function () {
            return pmc_mail_1.Q().then(function () {
                return _this.hasChangesToSave();
            })
                .then(function (hasChangesToSave) {
                if (!hasChangesToSave) {
                    return;
                }
                _this.callViewMethod("showSavingBanner");
                return pmc_mail_1.Q().then(function () {
                    return _this.retrieveFromView("getState");
                })
                    .then(function (t) {
                    text = t;
                    return _this.save(text);
                })
                    .then(function () {
                    _this.callViewMethod("confirmSave", text);
                    _this.callViewMethod("hideSavingBanner");
                })
                    .fail(function (e) {
                    _this.callViewMethod("hideSavingBanner");
                    return _this.onError(e);
                });
            });
        });
    };
    EditorWindowController.prototype.onViewHistory = function () {
        if (this.openableFileElement) {
            this.app.dispatchEvent({
                type: "open-history-view",
                parent: this,
                fileSystem: this.openableFileElement.fileSystem,
                path: this.openableFileElement.path,
                hostHash: this.session.hostHash
            });
        }
    };
    EditorWindowController.prototype.onViewExitEditMode = function () {
        this.exitEditMode();
    };
    EditorWindowController.prototype.onViewExitEditModeAndClose = function () {
        this.close();
    };
    EditorWindowController.prototype.onViewClose = function () {
        this.close();
    };
    EditorWindowController.prototype.onViewOpenMindmapHelp = function () {
        this.app.openSingletonWindow("mindmapHelp", MindmapHelpWindowController_1.MindmapHelpWindowController);
    };
    EditorWindowController.prototype.onViewDistractionFreeModeToggle = function () {
        this.nwin.toggleDistractionFreeMode();
    };
    EditorWindowController.prototype.onViewDirtyChange = function (dirty) {
        this.updateDirtyWindowsModel(dirty);
        this.nwin.setDirty(dirty);
    };
    EditorWindowController.prototype.onViewFocusedIn = function () {
        this.app.dispatchEvent({ type: "focused-in-preview" });
    };
    EditorWindowController.prototype.onViewEnterFromPreviewToEditMode = function () {
        this.enterEditMode();
    };
    EditorWindowController.prototype.enterEditMode = function (data) {
        var _this = this;
        return this.addTaskEx(this.i18n("plugin.editor.window.editor.task.enterEditMode.text"), true, function () {
            if (_this.editMode) {
                return;
            }
            return pmc_mail_1.Q().then(function () {
            })
                .then(function () {
                return _this.handle ? _this.handle.isModifiedRemote() : false;
            })
                .then(function (modified) {
                _this.app.dispatchEvent({
                    type: "file-opened",
                    element: _this.openableElement,
                    applicationId: "plugin.editor",
                    docked: _this.docked,
                    action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.EXTERNAL,
                    hostHash: _this.session.hostHash,
                });
                if (!modified) {
                    return pmc_mail_1.Q().then(function () {
                        if (data) {
                            return data;
                        }
                        if (_this.handle) {
                            return _this.handle.read().then(function (c) { return c.getText(); });
                        }
                        else {
                            return pmc_mail_1.Q().then(function () {
                                return _this.openableElement.getContent();
                            })
                                .then(function (content) {
                                return content.buffer.toString("utf8");
                            });
                        }
                    })
                        .then(function (text) {
                        _this.editMode = true;
                        _this.callViewMethod("switchToEditModeAndChangeContent", text);
                    });
                }
                return pmc_mail_1.Q().then(function () {
                    _this.handle.updateToLastVersion();
                    return _this.handle.read().then(function (c) { return c.getText(); });
                })
                    .then(function (text) {
                    _this.editMode = true;
                    _this.callViewMethod("switchToEditModeAndChangeContent", text);
                });
            }).fail(function (e) {
                if (pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.message == "locked-in-another-session-by-me") {
                    _this.editMode = false;
                    return _this.onError(e);
                }
                return pmc_mail_1.Q.reject(e);
            });
        });
    };
    EditorWindowController.prototype.confirmSaveBeforeSend = function () {
        return __awaiter(this, void 0, void 0, function () {
            var hasChanges, confirmResult, textToSave, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4, this.hasChangesToSave()];
                    case 1:
                        hasChanges = _a.sent();
                        if (!hasChanges) return [3, 5];
                        return [4, this.confirmEx({
                                message: this.i18n("plugin.editor.window.editor.task.beforeSend.unsavedWarning.text", [this.openableElement.getName()]),
                                yes: { label: this.i18n("plugin.editor.window.editor.save.confirm.yes.label") },
                                no: { label: this.i18n("plugin.editor.window.editor.save.confirm.no.label") },
                                cancel: { visible: true },
                            })];
                    case 2:
                        confirmResult = _a.sent();
                        if (!(confirmResult.result == "yes")) return [3, 5];
                        return [4, this.retrieveFromView("getState")];
                    case 3:
                        textToSave = _a.sent();
                        return [4, this.save(textToSave)];
                    case 4:
                        _a.sent();
                        this.callViewMethod("confirmSave", textToSave);
                        _a.label = 5;
                    case 5: return [3, 7];
                    case 6:
                        e_1 = _a.sent();
                        this.logError(e_1);
                        return [3, 7];
                    case 7: return [2];
                }
            });
        });
    };
    EditorWindowController.prototype.exitEditMode = function (repaintView) {
        var _this = this;
        this.manager.refreshState();
        var text;
        return pmc_mail_1.Q().then(function () {
            return _this.hasChangesToSave();
        })
            .then(function (hasChangesToSave) {
            if (!hasChangesToSave) {
                return pmc_mail_1.Q().then(function () {
                })
                    .then(function () {
                    _this.callViewMethod("afterExitedEditMode");
                    _this.editMode = false;
                    if (repaintView !== false) {
                        _this.callViewMethod("exitEditModeWithoutChange");
                    }
                    return true;
                });
            }
            return pmc_mail_1.Q().then(function () {
                _this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_DIRTY);
                return _this.confirmEx({
                    message: _this.i18n("plugin.editor.window.editor.task.exitEditMode.unsavedWarning.text", [_this.openableElement.getName()]),
                    yes: { label: _this.i18n("plugin.editor.window.editor.save.confirm.yes.label") },
                    no: { label: _this.i18n("plugin.editor.window.editor.save.confirm.no.label") },
                    cancel: { visible: true },
                });
            })
                .then(function (result) {
                if (result.result == "yes") {
                    return pmc_mail_1.Q().then(function () {
                        return _this.retrieveFromView("getState");
                    })
                        .then(function (t) {
                        text = t;
                        return _this.saveWithLockRelease(text);
                    })
                        .then(function () {
                        _this.editMode = false;
                        if (repaintView !== false) {
                            _this.callViewMethod("exitEditModeWithConfirm", text);
                        }
                        _this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
                        return true;
                    });
                }
                else if (result.result == "no") {
                    return pmc_mail_1.Q().then(function () {
                        return _this.releaseLock();
                    })
                        .then(function () {
                        _this.editMode = false;
                        if (repaintView !== false) {
                            _this.callViewMethod("exitEditModeWithRevert");
                        }
                        _this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
                        return true;
                    });
                }
                return false;
            })
                .then(function (exitedEditMode) {
                if (exitedEditMode) {
                    _this.callViewMethod("afterExitedEditMode");
                }
                return exitedEditMode;
            });
        });
    };
    EditorWindowController.prototype.beforeClose = function (force) {
        var _this = this;
        this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_CLOSING);
        if (force || this.handle == null) {
            this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
            clearInterval(this.lockInterval);
            return;
        }
        var controller = this;
        var defer = pmc_mail_1.Q.defer();
        pmc_mail_1.Q().then(function () {
            return controller.exitEditMode(false);
        })
            .then(function (result) {
            if (result) {
                clearInterval(_this.lockInterval);
                _this.manager.stateChanged(pmc_mail_1.app.BaseWindowManager.STATE_IDLE);
                _this.tasksPlugin.unWatch(_this.session, "task", "*", "*", _this.taskChangedHandlerBound);
                defer.resolve();
            }
            else {
                _this.app.manager.cancelClosing();
                defer.reject();
            }
        });
        return defer.promise;
    };
    EditorWindowController.prototype.getEntryModel = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (_this.openableElement && _this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
                var osf = _this.openableElement;
                if (osf.section) {
                    return osf.section.getFileTree();
                }
            }
        })
            .then(function (tree) {
            var boundTasksStr = null;
            if (tree) {
                var id_1 = _this.openableElement.getElementId();
                var el = tree.collection.find(function (x) { return x.id == id_1; });
                if (el) {
                    boundTasksStr = el.meta.bindedElementId;
                }
            }
            var entryName = _this.openableElement ? _this.openableElement.getName() : "";
            return {
                fileName: entryName,
                title: _this.getTitle(),
                canBeEditable: _this.openableElement && _this.openableElement.isEditable(),
                extl: entryName.substr(entryName.lastIndexOf(".")),
                mimeType: _this.openableElement ? _this.openableElement.getMimeType() : "",
                boundTasksStr: JSON.stringify(_this.tasksPlugin.getBindedTasksData(_this.session, boundTasksStr)),
                hostHash: _this.session.hostHash,
                sectionId: _this.openableElement && _this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile && _this.openableElement.section ? _this.openableElement.section.getId() : null,
            };
        });
    };
    EditorWindowController.prototype.refreshName = function () {
        var _this = this;
        this.getEntryModel().then(function (model) {
            _this.callViewMethod("updateEntry", model);
            _this.setTitle(model.title);
        });
    };
    EditorWindowController.prototype.hasChangesToSave = function () {
        var _this = this;
        var isDirty;
        return pmc_mail_1.Q().then(function () {
            return _this.retrieveFromView("isDirty");
        })
            .then(function (r) {
            isDirty = r;
            return _this.retrieveFromView("canGetState");
        })
            .then(function (canGetState) {
            return _this.editMode && isDirty && canGetState;
        });
    };
    EditorWindowController.prototype.canBeQuietlyClosed = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.hasChangesToSave();
        })
            .then(function (hasChangesToSave) {
            return !hasChangesToSave;
        });
    };
    EditorWindowController.prototype.hasOpenedEntry = function (entry) {
        return entry.equals(this.openableElement);
    };
    EditorWindowController.prototype.save = function (text) {
        var _this = this;
        var content;
        var saved = false;
        return pmc_mail_1.Q().then(function () {
            var obj = null;
            try {
                obj = JSON.parse(text);
            }
            catch (e) { }
            if (obj && obj.content) {
                return _this.app.prepareHtmlMessageBeforeSending(obj.content, _this.session).then(function (newText) {
                    var _a = pmc_mail_1.utils.ContentEditableEditorMetaData.extractMetaFromHtml(newText), metaData = _a.metaData, html = _a.html;
                    obj.metaDataStr = JSON.stringify(metaData);
                    obj.content = html;
                    return JSON.stringify(obj);
                });
            }
            return text;
        })
            .then(function (newText) {
            text = newText;
            _this.releasingLock = true;
            content = pmc_mail_1.privfs.lazyBuffer.Content.createFromText(text, _this.mimeType);
            if (_this.handle) {
                return _this.handle.write(content)
                    .catch(function (e) {
                    if (pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                        var identity = _this.session.sectionManager.client.identity;
                        if (e.data.error.data.lockerPub58 == identity.pub58) {
                            return _this.handle.lock(true)
                                .then(function () {
                                return _this.save(text);
                            });
                        }
                        return _this.saveFileAsConflicted(content);
                    }
                    else if (pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
                        return _this.handle.refreshAndUpdateToLastVersion()
                            .then(function () {
                            if (_this.handle.descriptor.lastVersion.raw.modifier == _this.lastDescriptorInfo.modifier) {
                                Logger.error("Error: OLD_SIGNATURE_DOESNT_MATCH", JSON.stringify(_this.gatherInfoForErrorReport(_this.lastDescriptorInfo, _this.handle.descriptor), null, 2));
                            }
                            return _this.saveFileAsConflicted(content);
                        });
                    }
                })
                    .then(function () {
                    saved = true;
                    if (_this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile && _this.openableElement.getMimeType() == "application/x-stt") {
                        var openableElement_1 = _this.openableElement;
                        return _this.openableElement.section.getFileTree().then(function (tree) {
                            var entry = tree.collection.find(function (x) { return x.id == openableElement_1.id; });
                            var obj;
                            try {
                                obj = JSON.parse(text);
                            }
                            catch (e) { }
                            if (obj) {
                                var realStyle = {
                                    styleName: obj.style && obj.style.name && obj.style.name in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_STYLES ? obj.style.name : pmc_mail_1.component.mindmap.Mindmap.DEFAULT_STYLE_NAME,
                                    fontSize: obj.style && obj.style.fontSize && obj.style.fontSize in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? obj.style.fontSize : pmc_mail_1.component.mindmap.Mindmap.DEFAULT_FONT_SIZE,
                                    margin: obj.style && obj.style.margin && obj.style.margin in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_MARGINS ? obj.style.margin : pmc_mail_1.component.mindmap.Mindmap.DEFAULT_MARGIN,
                                };
                                return _this.app.fileStyleResolver.setStyle(entry, _this.handle, realStyle);
                            }
                        });
                    }
                    return;
                });
            }
        })
            .then(function () {
            if (_this.openableEditableElement) {
                var osf = _this.openableEditableElement;
                if (!saved) {
                    if (osf.section) {
                        return osf.section.saveFile(osf.path, content, _this.handle, osf, true);
                    }
                }
                else {
                    if (osf.section) {
                        return osf.section.getChatModule().sendSaveFileMessage(osf.section.getId(), osf.path);
                    }
                }
            }
            else if (_this.openableElement && _this.openableElement.openableElementType == "LocalOpenableElement") {
                return _this.openableElement.save(content);
            }
        })
            .fin(function () {
            _this.releasingLock = false;
        });
    };
    EditorWindowController.prototype.saveFileAsConflicted = function (content) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var openableFile = _this.openableElement;
            var currentSectionId = openableFile.section.getId();
            var fname = _this.createConflictedFileName(openableFile);
            var newOpenableFile;
            return openableFile.fileSystem.resolvePath(fname)
                .then(function (resolvedPath) {
                return openableFile.fileSystem.save(resolvedPath.path, content).thenResolve(resolvedPath.path);
            })
                .then(function (newPath) {
                newOpenableFile = new pmc_mail_1.mail.section.OpenableSectionFile(_this.session.sectionManager.getSection(currentSectionId), openableFile.fileSystem, newPath, true);
                return newOpenableFile.refresh()
                    .then(function () {
                    return newOpenableFile.fileSystem.openFile(newPath, pmc_mail_1.privfs.fs.file.Mode.READ_WRITE);
                });
            })
                .then(function (newHandle) {
                _this.handle = newHandle;
                _this.openableElement = newOpenableFile;
                return _this.getEntryModel().then(function (model) {
                    var text = content.getText();
                    _this.updateTaskStatuses(text);
                    var newFullFileName = newOpenableFile.path;
                    var newFileName = newFullFileName.substr(newFullFileName.lastIndexOf("/") + 1);
                    _this.updateFileName(newFileName, newFullFileName, _this.getTitle(newFullFileName));
                    if (_this.app.isElectronApp()) {
                        _this.app.filesLockingService.showWarning(newOpenableFile.path);
                    }
                });
            })
                .fail(function (e) {
                return pmc_mail_1.Q.reject(e);
            });
        });
    };
    EditorWindowController.prototype.createConflictedFileName = function (openableFile) {
        try {
            var parentPath = openableFile.path.split("/").slice(0, -1).join("/");
            var fileName = openableFile.getName();
            var fileParts = fileName.split(".");
            var ext = "";
            if (fileParts.length > 1) {
                ext = fileParts[fileParts.length - 1];
                fileName = fileParts.slice(0, -1).join(".");
            }
            var formatter = new pmc_mail_1.utils.Formatter();
            var conflictedCopyStr = this.app.localeService.i18n("plugin.editor.window.editor.saveAsConflicted.conflictedCopy");
            var dateString = formatter.standardDate(new Date()).replace(/:/g, "-").replace(/ /g, "-");
            return parentPath + "/" + fileName + " - " + conflictedCopyStr + " - " + dateString + (ext.length > 0 ? "." + ext : "");
        }
        catch (e) {
            console.log("error creating filename", e);
        }
    };
    EditorWindowController.prototype.saveWithLockRelease = function (text) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            var content = pmc_mail_1.privfs.lazyBuffer.Content.createFromText(text, _this.mimeType);
            if (_this.handle) {
                _this.releasingLock = true;
                return _this.handle.write(content, { releaseLock: true }).thenResolve(null);
            }
            if (_this.openableEditableElement) {
                var osf = _this.openableEditableElement;
                if (osf.section) {
                    return osf.section.saveFile(content, _this.handle, osf, true);
                }
            }
        })
            .fin(function () {
            _this.releasingLock = false;
        });
    };
    EditorWindowController.prototype.releaseLock = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            _this.releasingLock = true;
            if (_this.handle) {
                return _this.handle.release();
            }
        })
            .fail(function (e) {
            if (!pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                return pmc_mail_1.Q.reject(e);
            }
        })
            .fin(function () {
            _this.releasingLock = false;
        });
    };
    EditorWindowController.prototype.lockChecker = function () {
        if (!this.editMode || this.handle == null || this.releasingLock || this.networkIsDown()) {
            return;
        }
        var controller = this;
        this.addTaskEx(this.i18n("plugin.editor.window.editor.task.relock.text"), true, function () {
            return controller.lock(false);
        });
    };
    EditorWindowController.prototype.lock = function (withVersionUpdate) {
        if (withVersionUpdate === void 0) { withVersionUpdate = true; }
        return pmc_mail_1.Q();
    };
    EditorWindowController.prototype.autoSave = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (!_this.handle) {
                _this.logError("invalid handle on autosave");
                return;
            }
            var text;
            _this.addTaskEx(_this.i18n("plugin.editor.window.editor.task.autosave.text"), true, function () {
                return pmc_mail_1.Q().then(function () {
                    return _this.hasChangesToSave();
                })
                    .then(function (hasChangesToSave) {
                    if (!hasChangesToSave) {
                        return;
                    }
                    return pmc_mail_1.Q().then(function () {
                        return _this.retrieveFromView("getState");
                    })
                        .then(function (t) {
                        text = t;
                        return _this.save(text);
                    })
                        .then(function () {
                        _this.callViewMethod("confirmSave", text);
                    });
                });
            });
        });
    };
    EditorWindowController.prototype.saveFileAsRecovery = function (text) {
        var _this = this;
        var section;
        var osf;
        var filesService;
        var recoveryHandle;
        return pmc_mail_1.Q().then(function () {
            if (!_this.openableEditableElement) {
                return;
            }
            osf = _this.openableEditableElement;
            section = osf.section;
            filesService = section.getFileModule();
            return filesService.getFileSystem();
        })
            .then(function (fs) {
            var content = pmc_mail_1.privfs.lazyBuffer.Content.createFromText(text, _this.mimeType);
            if (_this.lastRecoveryFilePath) {
                return pmc_mail_1.Q().then(function () {
                    return fs.openFile(_this.lastRecoveryFilePath, pmc_mail_1.privfs.fs.file.Mode.READ_WRITE, true);
                })
                    .then(function (rHandle) {
                    recoveryHandle = rHandle;
                    return recoveryHandle.read(false);
                })
                    .then(function (readContent) {
                    var savedText = readContent.getText();
                    if (savedText != text) {
                        return recoveryHandle.write(content, { releaseLock: true }).thenResolve(null);
                    }
                    else {
                        return;
                    }
                })
                    .fail(function (e) {
                    _this.logError(e);
                });
            }
            else {
                var acl = filesService.getDescriptorAcl();
                var destPath = pmc_mail_1.mail.filetree.nt.Helper.resolvePath("/", osf.getName());
                return fs.createEx(destPath, content, true, { acl: acl })
                    .then(function (fInfo) {
                    _this.lastRecoveryFilePath = fInfo.path;
                });
            }
        });
    };
    EditorWindowController.prototype.lockedByMeInOtherSession = function (e) {
        var _this = this;
        var identity = this.session.sectionManager.identity;
        return pmc_mail_1.Q().then(function () {
            if (!pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.data.error.data.lockerPub58 != identity.pub58) {
                return pmc_mail_1.Q.reject(e);
            }
            var msg = _this.i18n("plugin.editor.window.editor.error.anotherSessionLock");
            return _this.confirm(msg);
        })
            .then(function (result) {
            if (result.result != "yes") {
                throw new Error("locked-in-another-session-by-me");
            }
        });
    };
    EditorWindowController.prototype.onErrorRethrow = function (e) {
        this.onError(e);
        throw e;
    };
    EditorWindowController.prototype.onError = function (e) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (e.message == "locked-in-another-session-by-me") {
                return;
            }
            _this.logError(e);
            if (pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                if (_this.editMode && !_this.releasingLock) {
                    _this.lockedByMeInOtherSession(e);
                }
                else {
                    var pub58 = e.data.error.data.lockerPub58;
                    var contact = _this.session.conv2Service.contactService.getContactByPub58(pub58);
                    var msg = void 0;
                    if (contact) {
                        msg = _this.i18n("plugin.editor.window.editor.error.anotherUserLock.known", [contact.getDisplayName()]);
                    }
                    else {
                        msg = _this.i18n("plugin.editor.window.editor.error.anotherUserLock.unknown", [pub58]);
                    }
                    _this.alert(msg);
                }
            }
            else if (pmc_mail_1.privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
                var controller_1 = _this;
                pmc_mail_1.Q().then(function () {
                    return controller_1.handle.refresh();
                })
                    .then(function () {
                    var msg = controller_1.i18n("plugin.editor.window.editor.error.modifiedAlready");
                    return controller_1.confirm(msg);
                })
                    .then(function (result) {
                    var lastVersion = controller_1.handle.updateToLastVersion();
                    if (result.result != "yes") {
                        return;
                    }
                    var currentViewId = _this.currentViewId;
                    return controller_1.addTaskEx(controller_1.i18n("plugin.editor.window.editor.task.load.text"), true, function () {
                        return pmc_mail_1.Q().then(function () {
                            return controller_1.handle.read().then(function (c) { return c.getText(); });
                        })
                            .then(function (text) {
                            _this.updateTaskStatuses(text);
                            controller_1.callViewMethod("setContent", currentViewId, text);
                        })
                            .fail(function (e) {
                            controller_1.handle.currentVersion = lastVersion;
                            return pmc_mail_1.Q.reject(e);
                        });
                    });
                });
            }
            else {
                return _this.errorAlert(_this.prepareErrorMessage(e), e);
            }
        });
    };
    EditorWindowController.prototype.destroy = function () {
        this.stopAutoSaveInterval();
        _super.prototype.destroy.call(this);
        this.stopLockInterval();
        this.updateDirtyWindowsModel(false);
    };
    EditorWindowController.prototype.stopLockInterval = function () {
        if (this.lockInterval) {
            clearInterval(this.lockInterval);
            this.lockInterval = null;
        }
    };
    EditorWindowController.prototype.startLockInterval = function () {
        var _this = this;
        if (!this.lockInterval) {
            this.lockInterval = setInterval(function () {
                _this.lockChecker();
            }, 60 * 1000);
        }
    };
    EditorWindowController.prototype.stopAutoSaveInterval = function () {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    };
    EditorWindowController.prototype.startAutoSaveInterval = function () {
        var _this = this;
        if (!this.autoSaveInterval) {
            this.autoSaveInterval = setInterval(function () {
                _this.autoSave();
            }, 60 * 1000 * 5);
        }
    };
    EditorWindowController.prototype.updateDirtyWindowsModel = function (dirty) {
        dirty = dirty && this.editMode;
        var dwm = EditorWindowController_1.DirtyWindowsModel;
        var data = dwm.get();
        var idx = data.indexOf(this);
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
    };
    EditorWindowController.prototype.reopen = function (openableElement, force) {
        var _this = this;
        if (force === void 0) { force = false; }
        if (!this.previewMode && !force) {
            throw new Error("Cannot reopen when not in preview mode");
        }
        var wasNoElement = this.openableElement === null;
        var client = this.session.sectionManager.client;
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        this.currentViewId++;
        this.openableElement = openableElement;
        this.openableEditableElement = this.openableElement && this.openableElement.isEditable() ? this.openableElement : null;
        this.openableFileElement = this.openableElement instanceof pmc_mail_1.app.common.shelltypes.OpenableFile ? this.openableElement : null;
        var isText = openableElement.getMimeType() == "application/x-stt";
        this.afterViewLoadedDeferred = pmc_mail_1.Q.defer();
        return (isText ? this.prepareForDisplay(openableElement) : pmc_mail_1.Q(null))
            .then(function (style) {
            return _this.viewLoadedDeferred.promise.thenResolve(style);
        })
            .then(function (style) {
            _this.setWindowIcon(_this.openableElement);
            _this.refreshName();
            _this.callViewMethod("reopen", _this.currentViewId, wasNoElement);
            if (_this.app.isElectronApp() && _this.openableElement.openableElementType == "LocalOpenableElement") {
                _this.watcher = new LocalFsWatcher_1.LocalFfWatcher();
                _this.watcher.watch(_this.openableElement.getElementId(), _this.onChangeLocalContent.bind(_this));
            }
            if (wasNoElement) {
                _this.updatePreTitleIcon();
            }
        })
            .then(function () {
            return _this.afterViewLoadedDeferred.promise;
        })
            .fin(function () {
            _this.editorButtons.refreshButtonsState();
        });
    };
    EditorWindowController.prototype.updateCachedStyleName = function (text) {
        if (!(this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile)) {
            return;
        }
        var openableElement = this.openableElement;
        var isText = this.openableElement.getMimeType() == "application/x-stt";
        if (isText && this.handle) {
            var obj = void 0;
            try {
                obj = JSON.parse(text);
            }
            catch (e) { }
            if (obj) {
                var realStyle = {
                    styleName: obj.style && obj.style.name && obj.style.name in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_STYLES ? obj.style.name : pmc_mail_1.component.mindmap.Mindmap.DEFAULT_STYLE_NAME,
                    fontSize: obj.style && obj.style.fontSize && obj.style.fontSize in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? obj.style.fontSize : pmc_mail_1.component.mindmap.Mindmap.DEFAULT_FONT_SIZE,
                    margin: obj.style && obj.style.margin && obj.style.margin in pmc_mail_1.component.mindmap.Mindmap.AVAILABLE_MARGINS ? obj.style.margin : pmc_mail_1.component.mindmap.Mindmap.DEFAULT_MARGIN,
                };
                this.app.fileStyleResolver.cacheStyle(openableElement.id, realStyle);
            }
        }
    };
    EditorWindowController.prototype.prepareForDisplay = function (openableElement) {
        var _this = this;
        if (openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
            return openableElement.section.getFileTree().then(function (tree) {
                var entry = tree.collection.find(function (x) { return x.id == openableElement.id; });
                return _this.app.fileStyleResolver.getStyle(entry);
            })
                .then(function (style) {
                _this.callViewMethod("setStyle", style.styleName, style.fontSize, style.margin, false);
                return style;
            });
        }
        return pmc_mail_1.Q(null);
    };
    EditorWindowController.prototype.release = function () {
        var client = this.session.sectionManager.client;
        this.unregisterPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        if (!this.previewMode) {
            throw new Error("Cannot release when not in preview mode");
        }
        this.currentViewId++;
        this.openableElement = null;
        this.openableEditableElement = null;
        this.openableFileElement = null;
        this.refreshName();
        this.callViewMethod("release", this.currentViewId);
    };
    EditorWindowController.prototype.afterIframeHide = function () {
        this.callViewMethod("toggleEditorHidden", true);
    };
    EditorWindowController.prototype.afterIframeShow = function () {
        this.callViewMethod("toggleEditorHidden", false);
    };
    EditorWindowController.prototype.onViewClipboardPaste = function () {
        var _this = this;
        var supportedFormats = ["text", "MindMapElement"];
        var data = {};
        supportedFormats.forEach(function (format) {
            if (_this.app.clipboard.hasFormat(format)) {
                data[format] = _this.app.clipboard.getFormat(format);
            }
        });
        this.callViewMethod("clipboardPaste", data);
    };
    EditorWindowController.prototype.onViewClipboardCopy = function (data) {
        this.app.clipboard.set(data);
    };
    EditorWindowController.prototype.onViewDownload = function () {
        this.editorButtons.onViewExport();
    };
    EditorWindowController.prototype.onViewSend = function () {
        var _this = this;
        new Promise(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.confirmSaveBeforeSend()];
                    case 1:
                        _a.sent();
                        this.editorButtons.onViewSend();
                        return [2];
                }
            });
        }); });
    };
    EditorWindowController.prototype.saveBeforePrinting = function () {
        var _this = this;
        var text = "";
        return pmc_mail_1.Q().then(function () {
            return _this.hasChangesToSave();
        })
            .then(function (hasChangesToSave) {
            if (!hasChangesToSave) {
                return;
            }
            return pmc_mail_1.Q().then(function () {
                return _this.retrieveFromView("getState");
            })
                .then(function (t) {
                text = t;
                return _this.save(text);
            })
                .then(function () {
                _this.callViewMethod("confirmSave", text);
            })
                .fail(function (e) {
                return pmc_mail_1.Q.reject(e);
            });
        });
    };
    EditorWindowController.prototype.onViewPrint = function () {
        this.editorButtons.onViewPrint();
    };
    EditorWindowController.prototype.onViewSaveAsPdf = function () {
        var _this = this;
        if (this.isPrinting || this.isSavingAsPdf) {
            return;
        }
        if (this.openableElement) {
            this.saveBeforePrinting().then(function () {
                var notificationId = _this.notifications.showNotification(_this.i18n("plugin.editor.window.editor.notifier.savingAsPdf"), { autoHide: false, progress: true });
                var parentController = _this.getClosestNotDockedController();
                var parent = parentController ? parentController.nwin : null;
                _this.app.saveAsPdf(_this.session, _this.openableElement, parent)
                    .then(function () {
                    setTimeout(function () {
                        _this.notifications.showNotification(_this.i18n("plugin.editor.window.editor.notifier.savedAsPdf"));
                    }, 500);
                })
                    .fin(function () {
                    _this.notifications.hideNotification(notificationId);
                    _this.isPrinting = false;
                })
                    .fail(function () {
                });
            });
        }
    };
    EditorWindowController.prototype.onViewPdfOutput = function (data) {
        var buffer = new Buffer(data, "binary");
        var fileName = pmc_mail_1.mail.filetree.Path.splitFileName(this.openableElement ? this.openableElement.getName() : "document.stt").name + ".pdf";
        var content = pmc_mail_1.privfs.lazyBuffer.Content.createFromBuffer(buffer, "application/pdf", fileName);
        this.app.directSaveContent(content, this.session);
        this.onViewSavedAsPdf();
    };
    EditorWindowController.prototype.onViewAttachToTask = function () {
        this.editorButtons.attachToTask(this.handle);
    };
    EditorWindowController.prototype.prepareToPrint = function (scale) {
        var _this = this;
        if (scale === void 0) { scale = false; }
        if (this.prepareToPrintDeferred == null) {
            this.prepareToPrintDeferred = pmc_mail_1.Q.defer();
            this.viewLoadedDeferred.promise.then(function () {
                return _super.prototype.prepareToPrint.call(_this);
            })
                .then(function () {
                _this.callViewMethod("prepareToPrint", scale);
            });
        }
        return this.prepareToPrintDeferred.promise;
    };
    EditorWindowController.prototype.onViewPreparedToPrint = function () {
        if (this.prepareToPrintDeferred) {
            this.prepareToPrintDeferred.resolve();
        }
    };
    EditorWindowController.prototype.onViewOpenTask = function (taskIdsStr) {
        var _this = this;
        var entryId = this.openableElement.getElementId();
        taskIdsStr += "";
        var resolved = this.session.sectionManager.resolveFileId(entryId);
        var taskId = "";
        if (taskIdsStr.indexOf(",") >= 0) {
            this.taskChooser.options.onlyTaskIds = taskIdsStr.split(",");
            this.taskChooser.refreshTasks();
            this.taskChooser.showPopup().then(function (result) {
                if (result.taskId) {
                    _this.editorPlugin.openTask(_this.session, resolved.section.getId(), result.taskId);
                }
            });
        }
        else {
            taskId = taskIdsStr;
            this.editorPlugin.openTask(this.session, resolved.section.getId(), taskId);
        }
    };
    EditorWindowController.prototype.getTitle = function (overridePath) {
        if (!this.openableElement) {
            return "";
        }
        if (this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
            var parsed = pmc_mail_1.mail.filetree.nt.Entry.parseId(this.openableElement.id);
            if (parsed) {
                var section = this.session.sectionManager.getSection(parsed.sectionId);
                if (section) {
                    var sectionName = section.getFullSectionName();
                    var path = parsed.path[0] == "/" ? parsed.path.substring(1) : parsed.path;
                    if (overridePath) {
                        path = overridePath.substr(1);
                    }
                    return sectionName + "/" + path;
                }
            }
        }
        else if (this.openableElement.openableElementType == "LocalOpenableElement") {
            if (overridePath) {
                return overridePath;
            }
            return this.openableElement.getElementId();
        }
        return this.openableElement.getName();
    };
    EditorWindowController.prototype.getPreTitleIcon = function () {
        if (!this.openableElement) {
            return null;
        }
        if (this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
            var parsed = pmc_mail_1.mail.filetree.nt.Entry.parseId(this.openableElement.id);
            if (parsed) {
                var section = this.session.sectionManager.getSection(parsed.sectionId);
                if (section) {
                    if (section.isPrivate() && section.getName() == "<my>") {
                        return "private";
                    }
                    else if (section.isPrivateOrUserGroup()) {
                        return "person";
                    }
                    return section.getScope() == "public" ? "section-public" : "section-non-public";
                }
            }
        }
        else if (this.openableElement.openableElementType == "LocalOpenableElement") {
            return "local";
        }
        return null;
    };
    EditorWindowController.prototype.updatePreTitleIcon = function () {
        var icon = this.getPreTitleIcon();
        this.nwin.updatePreTitleIcon(icon);
    };
    EditorWindowController.prototype.onViewGetTaskStatuses = function (channelId, taskIdsStr) {
        var taskIds = JSON.parse(taskIdsStr);
        var statuses = {};
        this.tasksPlugin.addTaskStatusesFromTaskIds(this.session, statuses, taskIds);
        this.sendToViewChannel(channelId, JSON.stringify(statuses));
    };
    EditorWindowController.prototype.taskChangedHandler = function () {
    };
    EditorWindowController.prototype.updateTaskStatuses = function (text) {
        var statuses = {};
        this.tasksPlugin.addTaskStatusesFromMessage(this.session, statuses, text);
        this.callViewMethod("setTaskStatuses", JSON.stringify(statuses));
    };
    EditorWindowController.prototype.updateFileName = function (newFileName, newFullFileName, newTitle) {
        this.updatedFullFileName = newFullFileName;
        this.setTitle(newTitle);
        this.callViewMethod("updateFileName", newFileName, newFullFileName, newTitle);
    };
    EditorWindowController.prototype.getEntryFromOpenableFile = function (openableElement) {
        return __awaiter(this, void 0, void 0, function () {
            var tree, entry, entry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile)) return [3, 2];
                        return [4, openableElement.section.getFileTree()];
                    case 1:
                        tree = _a.sent();
                        entry = tree.collection.list.find(function (x) { return x.name == openableElement.getName(); });
                        return [2, entry];
                    case 2:
                        if ((this.openableElement.openableElementType == "LocalOpenableElement")) {
                            entry = openableElement.entry;
                            return [2, entry];
                        }
                        _a.label = 3;
                    case 3: return [2];
                }
            });
        });
    };
    EditorWindowController.prototype.onViewRename = function () {
        var _this = this;
        if (this.isRenaming) {
            return;
        }
        this.isRenaming = true;
        pmc_mail_1.Q().then(function () {
            return _this.getEntryFromOpenableFile(_this.openableElement)
                .then(function (entry) {
                return _this.promptEx({
                    width: 400,
                    height: 140,
                    title: _this.i18n("plugin.editor.window.editor.rename.message"),
                    input: {
                        multiline: false,
                        value: _this.openableElement.name
                    },
                    selectionMode: entry.isDirectory() ? "all" : "filename",
                });
            });
        })
            .then(function (result) {
            if (result.result == "ok" && result.value != _this.openableElement.name) {
                var notificationId_1 = _this.notifications.showNotification(_this.i18n("plugin.editor.window.editor.rename.notification.renaming"), { autoHide: false, progress: true });
                var notifKey_1 = "renamed";
                return pmc_mail_1.Q().then(function () {
                    if (_this.openableElement instanceof pmc_mail_1.mail.section.OpenableSectionFile) {
                        var osf_1 = _this.openableElement;
                        var newFullFileName_1 = "";
                        return osf_1.section.getFileTree().then(function (tree) {
                            return tree.refreshDeep(true).thenResolve(tree);
                        })
                            .then(function (tree) {
                            if (tree.collection.list.find(function (x) { return x.name == result.value; })) {
                                notifKey_1 = "alreadyExists";
                                return true;
                            }
                            else {
                                newFullFileName_1 = osf_1.path.substr(0, osf_1.path.lastIndexOf("/")) + "/" + result.value;
                                return tree.fileSystem.rename(osf_1.path, result.value)
                                    .then(function () {
                                    _this.app.fileRenameObserver.dispatchFileRenamedEvent(osf_1.handle.ref.did, newFullFileName_1, osf_1.path, _this.session.hostHash);
                                })
                                    .thenResolve(true);
                            }
                        })
                            .then(function (res) {
                            notifKey_1 = res ? "renamed" : "error";
                        })
                            .fail(function () {
                            notifKey_1 = "error";
                        });
                    }
                    else if (_this.openableElement.openableElementType == "LocalOpenableElement") {
                        var el_1 = _this.openableElement;
                        var oldPath_1 = el_1.entry.path;
                        el_1.rename(result.value)
                            .then(function () {
                            var newFullFileName = el_1.entry.path.substr(0, el_1.entry.path.lastIndexOf("/")) + "/" + result.value;
                            _this.app.fileRenameObserver.dispatchLocalFileRenamedEvent(newFullFileName, oldPath_1);
                        });
                    }
                })
                    .fin(function () {
                    _this.notifications.hideNotification(notificationId_1);
                    if (notifKey_1) {
                        setTimeout(function () {
                            _this.notifications.showNotification(_this.i18n("plugin.editor.window.editor.rename.notification." + notifKey_1));
                        }, 900);
                    }
                });
            }
        })
            .fin(function () {
            _this.isRenaming = false;
        });
    };
    EditorWindowController.prototype.isFileLocked = function () {
        return this.app.filesLockingService.isLocked(this.session, this.openableElement);
    };
    EditorWindowController.prototype.canUnlockFile = function () {
        return this.app.filesLockingService.canUnlockFile(this.session, this.openableElement);
    };
    EditorWindowController.prototype.lockFile = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            if (_this.openableElement && !_this.openableElement.isLocalFile()) {
                return _this.isFileLocked().then(function (locked) {
                    if (locked) {
                        return;
                    }
                    return _this.app.filesLockingService.manualLockFile(_this.session, _this.openableElement);
                });
            }
        });
    };
    EditorWindowController.prototype.unlockFile = function () {
        if (this.openableElement && !this.openableElement.isLocalFile()) {
            return this.app.filesLockingService.manualUnlockFile(this.session, this.openableElement);
        }
    };
    EditorWindowController.prototype.updateLockUnlockButtons = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return pmc_mail_1.Q.all([
                _this.newFile ? pmc_mail_1.Q.resolve(false) : _this.isFileLocked(),
                _this.newFile ? pmc_mail_1.Q.resolve(false) : _this.canUnlockFile()
            ]);
        })
            .then(function (res) {
            var canUnlock = res[0], locked = res[1];
            _this.updateLockInfoOnActionButtons(locked, canUnlock);
            if (_this.editorButtons) {
                _this.editorButtons.updateLockState(locked, canUnlock);
            }
        });
    };
    EditorWindowController.prototype.updateLockInfoOnActionButtons = function (locked, canUnlock) {
        this.callViewMethod("updateLockInfoOnActionButtons", locked, canUnlock);
    };
    EditorWindowController.prototype.onViewLockFile = function () {
        this.lockFile();
    };
    EditorWindowController.prototype.onViewUnlockFile = function () {
        this.unlockFile();
    };
    EditorWindowController.prototype.gatherInfoForErrorReport = function (oldDescriptorInfo, descriptor) {
        var el = this.options && this.options.entry && this.options.entry instanceof pmc_mail_1.mail.section.OpenableSectionFile ? this.options.entry : null;
        return {
            who: this.app.identity.hashmail,
            host: this.app.identity.host,
            platform: this.app.getSystemPlatfrom(),
            appVersion: this.app.getVersion(),
            descriptor: { did: descriptor.ref.did, version: descriptor.lastVersion.raw.signature, serverDate: descriptor.lastVersion.raw.serverDate, modifier: descriptor.lastVersion.raw.modifier },
            oldDescriptor: oldDescriptorInfo,
            sessionHost: this.session.host,
            filePath: el ? el.path : null,
            sectionId: el ? el.section.getId() : null,
            currentViewId: this.currentViewId,
            editorOpenDate: this.editorOpenDate,
            editorType: "text-note-editor"
        };
    };
    var EditorWindowController_1;
    EditorWindowController.textsPrefix = "plugin.editor.window.editor.";
    EditorWindowController.DirtyWindowsModel = new pmc_mail_1.utils.Model([]);
    EditorWindowController = EditorWindowController_1 = __decorate([
        Dependencies(["notification", "editorbuttons"])
    ], EditorWindowController);
    return EditorWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.EditorWindowController = EditorWindowController;
EditorWindowController.prototype.className = "com.privmx.plugin.editor.window.editor.EditorWindowController";

//# sourceMappingURL=EditorWindowController.js.map
