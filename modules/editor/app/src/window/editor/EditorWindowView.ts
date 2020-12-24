import {JQuery as $, webUtils, window as wnd, Q, Types, component} from "pmc-web";
import {app} from "pmc-mail";
import {func as mainTemplate} from "./template/main.html";
import {func as toolbarTemplate} from "./template/toolbar.html";
import {func as editorBannerTemplate} from "./template/editor-banner.html";
import {Mindmap} from "./editors/Mindmap";
import {TextEdit} from "./editors/TextEdit";
import {HtmlEdit} from "./editors/HtmlEdit";
import {Editor, EditorOptions} from "./editors/Editor";
import {NotesPreferences} from "../../main/EditorPlugin";
import {Model, EntryModel} from "./EditorWindowController";
import { StyledEditor } from "./editors/StyledEditor";

export interface State {
    docked: boolean;
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

declare var html2pdf: any;

export class EditorWindowView extends wnd.base.BaseWindowView<Model> {
    
    static readonly MAX_FILENAME_WIDTH: number = 230;
    
    currentViewId: number;
    $toolbar: JQuery;
    $editor: JQuery;
    toolbarTmpl: Types.webUtils.MailTemplate<State>;
    state: State;
    editor: Editor<any>;
    lastEditAttemptEventData: any;
    $savingBanner: JQuery;
    showingFileMenu: boolean;
    lastMouseMoveEvent: JQueryMouseEventObject;
    previewMode: boolean;
    isCtrlKeyDown: boolean = false;
    $buttonsOverlay: JQuery;
    $toolbarContents: JQuery;
    editModeFromPreview: boolean = false;
    personsComponent: component.persons.PersonsView;
    notifications: component.notification.NotificationView;
    editorButtons: component.editorbuttons.EditorButtonsView;
    taskTooltip: component.tasktooltip.TaskTooltipView;
    taskChooser: component.taskchooser.TaskChooserView;
    overlayVisibilityTimer: NodeJS.Timer;
    $mainContent:  JQuery;
    toolbarOverflownWidth: number = -1;
    fileLoadedDeferred: Q.Deferred<void> = Q.defer();
    entry: EntryModel;
    html2canvasScaleMultiplier: number = 1;
    taskStatuses: { [taskId: string]: string } = {};
    printMode: boolean = false;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("persons", new component.persons.PersonsView(this, this.helper));
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this));
        this.editorButtons = this.addComponent("editorbuttons", new component.editorbuttons.EditorButtonsView(this));
        this.taskTooltip = this.addComponent("tasktooltip", new component.tasktooltip.TaskTooltipView(this));
        this.taskChooser = this.addComponent("taskchooser", new component.taskchooser.TaskChooserView(this));
        this.taskTooltip.refreshAvatars = () => {
            this.personsComponent.refreshAvatars();
        }
    }
    
    initWindow(model: Model) {
        this.printMode = !!model.printMode;
        return Q().then(() => {
            if (model.printMode) {
                $("html").addClass("print-mode");
                $("body").addClass("print-mode");
            }
            $("body").attr("data-style-name", model.initialStyleName);
            this.$mainContent = this.$main.find(".main-content");
            this.personsComponent.$main = this.$main;
            this.editorButtons.$main = this.$main;
            this.editorButtons.$container = this.$mainContent;
            this.notifications.$container = this.$main.find(".notifications");
            this.currentViewId = model.currentViewId;
            this.previewMode = model.previewMode;
            this.$toolbar = this.$mainContent.find(".toolbar-container");
            this.$editor = this.$mainContent.find(".editor");
            this.$statusBar = this.$mainContent.find(".status-bar");
            this.taskTooltip.$container = this.$main;
            this.taskChooser.$container = this.$main;
            this.toolbarTmpl = this.templateManager.createTemplate(toolbarTemplate);
            
            return Q().then(() => {
                return this.personsComponent.triggerInit();
            }).then(() => {
                return Q.all([
                    this.notifications.triggerInit(),
                    this.editorButtons.triggerInit(),
                    this.taskTooltip.triggerInit(),
                    this.taskChooser.triggerInit(),
                ]);
            });
        })
        .then(() => {
            this.editorButtons.onContainerSizeChangedHandler(() => {
                this.updatePaddingBottom();
            });
            this.updatePaddingBottom();
            $(window).resize(this.onResizeWindow.bind(this));
            
            if (model.previewMode && model.docked) {
                this.$mainContent.on("click", this.onFocusedIn.bind(this));
                this.bindTabSwitch();
                this.bindEnterPressed();
                
            }
            this.bindToolbarActions();
            // this.$main.on("keydown", this.onKeyDown.bind(this));
            
            this.prepareForDistractionFreeMode();
            this.refreshPreviewMode();
            this.bindEditorKeyPresses();
        });
    }
        
    bindToolbarActions(): void {
        this.$mainContent.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$mainContent.on("click", "[data-action=enter-edit-mode]", this.onEnterEditModeClick.bind(this));
        this.$mainContent.on("click", "[data-action=exit-edit-mode]", this.onExitEditModeClick.bind(this));
        this.$mainContent.on("click", "[data-action=exit-edit-mode-and-close]", this.onExitEditModeAndCloseClick.bind(this));
        this.$mainContent.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$mainContent.on("click", "[data-action=rename]", this.onRenameClick.bind(this));
        this.$mainContent.on("click", "[data-action=open-mindmap-help]", this.onOpenMindmapHelpClick.bind(this));
        this.$mainContent.on("click", "[data-action=reload]", this.onReloadClick.bind(this));
        this.$mainContent.on("click", "[data-action=distracton-free-mode-toggle]", this.onDistractionFreeModeToggleClick.bind(this));
        this.$mainContent.on("click", "[data-action=popup-window]", this.onPopupWindowClick.bind(this));
        this.$mainContent.on("click", "[data-action=edit]", this.onOpenEditWindowClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=download]", this.onDownloadClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=attach-to-task]", this.onAttachToTaskClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=send]", this.onSendClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=print]", this.onPrintClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=save-as-pdf]", this.onSaveAsPdfClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=lock]", this.onLockFileClick.bind(this));
        this.$mainContent.on("click", ".toolbar-container [data-action=unlock]", this.onUnlockFileClick.bind(this));

        this.$mainContent.on("click", ".toolbar-container [data-action=history]", this.onHistoryClick.bind(this));
        this.$mainContent.on("click", "[data-action=open-toolbar-more]", this.onOpenToolbarMoreClick.bind(this));
        this.$mainContent.on("click", ".context-menu-backdrop2", this.onCloseToolbarMoreClick.bind(this));
        this.$mainContent.on("click", ".context-menu-toolbar-more", this.onToolbarMoreItemClick.bind(this));
        this.$mainContent.on("click", "[data-action=open-tools-menu]", this.onToolbarToolsClick.bind(this));
        this.$mainContent.on("click", ".context-menu-toolbar-tools", this.onToolbarToolsItemClick.bind(this));
        this.$mainContent.on("click", "[data-task-id]", this.onTaskClick.bind(this));
    }
    
    toggleEditorHidden(hidden: boolean): void {
        let $editor = this.$main.closest("body");
        $editor.toggleClass("hide", hidden);
    }
    
    onResizeWindow(): void {
        this.updateToolbarItemsVisibility();
    }
    
    updateToolbarItemsVisibility(): void {
        let $toolbar = this.$toolbar.find(".toolbar");
        let elementsFit = this.doInnerElementsFit($toolbar.get(0));
        $toolbar.find(".right-side-buttons").toggleClass("invisible", ! elementsFit);
        $toolbar.parent().find(".more-button").toggleClass("hide", elementsFit);
    }
    
    onFocusedIn() {
        this.triggerEvent("focusedIn");
    }
    
    load(currentViewId: number, text: string, docked: boolean, editMode: boolean, entry: EntryModel, newFile: boolean, preferences: NotesPreferences): void {
        if (this.currentViewId != currentViewId) {
            return;
        }
        let Type: {new(options: EditorOptions): Editor<any>, mimetype: string};
        if (entry.mimeType == "application/x-smm") {
            Type = Mindmap;
        }
        else if ((<any>entry.mimeType).startsWith("text/")) {
            Type = TextEdit;
        }
        else if (entry.mimeType == "application/x-stt") {
            Type = entry.extl == ".stx" ? TextEdit : HtmlEdit;
        }
        else if (entry.extl == ".smm") {
            Type = Mindmap;
        }
        else if (entry.extl == ".stx" || entry.extl == ".txt") {
            Type = TextEdit;
        }
        else if (entry.extl == ".stt") {
            Type = HtmlEdit;
        }
        else {
            throw new Error(this.i18n("plugin.editor.window.editor.error.unknownFileType"));
        }
        this.entry = entry;
        this.$mainContent.find("> .buttons").toggleClass("hide", !entry.canBeEditable);
        this.$body.attr("data-style-name", "none");
        this.$body.attr("data-editor-margin", "0%");
        this.$editor.hide();
        this.editor = new Type({
            parent: this,
            initState: text,
            editMode: editMode,
            newFile: newFile,
            preferences: preferences,
            previewMode: this.previewMode,
            taskStatuses: this.taskStatuses,
        });
        this.editor.attach(this.$editor);
        this.$editor.off('.editor');
        this.$editor.on('focus.editor', () => {
            this.editor.focus();
        });
        this.$editor.on('click.editor', () => {
            this.editor.focus();
        });
        
        this.state = {
            docked: docked,
            editMode: editMode,
            previewMode: this.previewMode,
            entry: entry,
            dirty: false,
            editModeFromPreview: false,
            customHtml: this.editor.getCustomToolbarMenuHtml(),
            rightSideHtml: this.editor.getCustomToolbarRightSideMenuHtml(),
            canPrint: entry.mimeType == "application/x-smm" || entry.mimeType == "application/x-stt",
            canSaveAsPdf: entry.mimeType == "application/x-smm" || entry.mimeType == "application/x-stt",
            boundTasksStr: this.entry.boundTasksStr,
        };
        this.updateRelatedSection();
        this.$toolbar.empty().append(this.toolbarTmpl.renderToJQ(this.state));
        this.renderName();
        this.editor.addEventListener("editAttemptWhenNotEditable", this.onEditAttemptWhenNotEditable.bind(this));
        this.editor.addEventListener("change", this.onDirtyChange.bind(this));
        this.editor.addEventListener("linkClick", this.onLinkClick.bind(this));

        this.editor.addEventListener("copy", this.onEditorCopy.bind(this));
        this.editor.addEventListener("paste", this.onEditorPaste.bind(this));

        this.triggerEvent("mimeTypeDetect", Type.mimetype);
        this.triggerEvent("newFileFlagConsumed");
        if (editMode) {
            this.showEditModeBanner();
        }
        this.$editor.show();
        this.$editor.addClass("pf-scrollable-horizontal");
        this.makeCustomScroll(this.$editor);
        let $inner = this.$editor.children(".pf-content");
        this.makeCustomScroll($inner);
        this.$editor.data("pf-scroll").$content = $inner.data("pf-scroll").$content;
        if (this.previewMode) {
            this.addButtonsOverlay();
        }
        if (!this.previewMode) {
            this.editor.focus();
        }
        
        this.refreshPreviewMode();
        this.updateToolbarItemsVisibility();
        this.$main.find(".print-header").text(entry.fileName);
        this.updatePaddingBottom();
        this.fileLoadedDeferred.resolve();
    }
    
    getStyleName(): string {
        if (this.editor instanceof StyledEditor) {
            return this.editor && this.editor.data && this.editor.data.style ? this.editor.data.style.name : "default";
        }
        return null;
    }
    
    setStyle(styleName: string, fontSize: string, margin: string): void {
        this.$body.attr("data-style-name", styleName);
    }
    
    switchToEditMode(data: string): void {
        this.editor.setEditMode(true);
        this.showEditModeBanner();
        if (data && this.lastEditAttemptEventData) {
            let eventData = this.lastEditAttemptEventData;
            this.lastEditAttemptEventData = null;
            if (this.editor instanceof Mindmap) {
                setTimeout(() => {
                    $(eventData.event.target).trigger(eventData.event);
                }, 1);
            }
            if (this.editor instanceof HtmlEdit) {
                setTimeout(() => {
                    this.editor.focus();
                }, 1);
            }
        }
        this.state.editMode = true;
        this.renderEditMode();
        this.editor.focus();
    }
    
    setContent(currentViewId: number, text: string): void {
        if (this.currentViewId != currentViewId) {
            return;
        }
        this.editor.initState = text;
        this.editor.backToInitState();
        if (!this.previewMode) {
            this.editor.focus();
        }
    }
    
    updateContentPreview(currentViewId: number, text: string): void {
        if (this.currentViewId != currentViewId) {
            return;
        }
        this.editor.initState = text;
        this.editor.backToInitState();
        this.refreshPreviewMode();
    }
    
    reset(): void {
        this.editor.backToInitState();
        this.editor.focus();
    }
    
    switchToEditModeAndChangeContent(text: string): void {
        this.editor.initState = text;
        this.editor.backToInitState();
        this.editor.setEditMode(true);
        this.showEditModeBanner();
        this.state.editMode = true;
        this.renderEditMode();
        this.editor.focus();
    }
    
    exitEditModeWithoutChange(): void {
        this.editor.setEditMode(false);
        this.state.editMode = false;
        this.renderEditMode();
        this.editor.focus();
    }
    
    exitEditModeWithConfirm(text: string): void {
        this.editor.confirmSave(text);
        this.editor.setEditMode(false);
        this.state.editMode = false;
        this.renderEditMode();
        this.editor.focus();
    }
    
    exitEditModeWithRevert(): void {
        this.editor.backToInitState();
        this.editor.setEditMode(false);
        this.state.editMode = false;
        this.renderEditMode();
        this.editor.focus();
    }
    
    canGetState(): boolean {
        return this.editor != null;
    }
    
    getState(): string {
        this.editor.beforeSave();
        return this.editor.getState();
    }
    
    getElements() {
        return this.editor.getElements();
    }
    
    isDirty(): boolean {
        return this.editor && this.editor.isChanged();
    }
    
    updateEntry(entry: EntryModel): void {
        if (this.state) {
            this.state.entry = entry;
            this.renderName();
            this.updateRelatedSection();
        }
    }
    
    confirmSave(text: string): void {
        this.editor.confirmSave(text);
        this.editor.focus();
    }
    
    focus(): void {
        if (this.editor) {
            this.editor.focus();
        }
    }
    
    onEditAttemptWhenNotEditable(data: any): void {
        this.lastEditAttemptEventData = data;
        this.triggerEvent("enterEditModeByChange", true);
    }
    
    onDirtyChange(dirty: boolean): void {
        this.state.dirty = dirty;
        this.renderDirty();
    }
    
    onLinkClick(data: {url: string}): void {
        this.triggerEventInTheSameTick("openUrl", data.url);
    }
    
    onSaveClick(): void {
        this.triggerEvent("save");
    }
    
    onHistoryClick(): void {
        this.triggerEvent("history");
    }
    
    onEnterEditModeClick(): void {
        this.triggerEvent("enterEditMode");
    }
    
    onExitEditModeClick(): void {
        this.triggerEvent("exitEditMode");
    }
    
    afterExitedEditMode(): void {
        if (this.editModeFromPreview) {
            this.editModeFromPreview = false;
            this.addButtonsOverlay();
            
            this.previewMode = true;
            this.state.previewMode = true;
            this.state.editMode = false;
            this.editor.editMode = false;
            let $editorContents = this.$mainContent.find(".editor").detach();
            this.editorButtons.$buttons.detach();
            this.$mainContent.empty();
            this.$mainContent.append($editorContents);
            this.$mainContent.append(this.editorButtons.$buttons);
        }
    }
    
    onExitEditModeAndCloseClick(): void {
        this.triggerEvent("exitEditModeAndClose");
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onRenameClick(): void {
        this.triggerEvent("rename");
    }
    
    onOpenMindmapHelpClick(): void {
        this.triggerEvent("openMindmapHelp");
    }
    
    onReloadClick(): void {
        this.triggerEvent("reload");
    }
    
    onDistractionFreeModeToggleClick(): void {
        this.triggerEventInTheSameTick("distractionFreeModeToggle");
    }
    
    onPopupWindowClick(): void {
        this.triggerEvent("popupWindow");
    }
    
    renderDirty(): void {
        if (this.state.dirty) {
            this.$toolbar.find(".toolbar").addClass("dirty");
            this.$toolbar.find(".toolbar [data-action=save]").prop("disabled", false);
        }
        else {
            this.$toolbar.find(".toolbar").removeClass("dirty");
            this.$toolbar.find(".toolbar [data-action=save]").prop("disabled", true);
        }
        if (this.state.editMode) {
            this.triggerEvent("dirtyChange", this.state.dirty);
        }
    }
    
    renderEditMode(): void {
        if (this.state.editMode) {
            this.$toolbar.find(".toolbar").addClass("edit-mode");
            this.$body.find(".context-menu-toolbar-more").addClass("edit-mode");
        }
        else {
            this.$toolbar.find(".toolbar").removeClass("edit-mode");
            this.$body.find(".context-menu-toolbar-more").removeClass("edit-mode");
        }
        this.refreshPreviewMode();
        this.triggerEvent("dirtyChange", this.state.dirty);
    }
    
    renderName(): void {
        let rev = this.state.entry.fileName.split("").reverse().join("");
        this.fontMetrics.add(rev);
        this.fontMetrics.measure();
        let l = this.fontMetrics.getMaxTextLength(rev, EditorWindowView.MAX_FILENAME_WIDTH, false);
        let newText = (l < rev.length ? "..." : "") + rev.substr(0, l).split("").reverse().join("");
        this.$toolbar.find(".toolbar .file-name-with-rename-trigger .file-name").text(newText);
        $("body").find(".context-menu-file").remove();
    }
    
    showEditModeBanner(): void {
        let text = this.helper.i18n("plugin.editor.window.editor.editModeBanner.text");
        let $banner = this.createBanner(text);
        this.showAndHideBanner($banner, 500);
    }
    
    showSavingBanner(): void {
        if (!this.$savingBanner) {
            let text = this.helper.i18n("plugin.editor.window.editor.savingBanner.text");
            this.$savingBanner = this.createBanner(text);
            this.showBanner(this.$savingBanner);
        }
    }
    
    hideSavingBanner(): void {
        if (this.$savingBanner) {
            Q.delay(500)
            .then(() => {
                this.hideBanner(this.$savingBanner)
                .then(() => {
                    delete this.$savingBanner;
                });
            });
        }
    }
    
    createBanner(text: string): JQuery {
        return this.templateManager.createTemplate(editorBannerTemplate).renderToJQ({text: text});
    }
    
    showBanner($banner: JQuery): Q.Promise<void> {
        return Q.Promise<void>(resolve => {
            this.$mainContent.append($banner);
            $banner.animate({opacity: 1}, 500, () => {
                setTimeout(() => {
                    resolve(null);
                }, 500);
            });
        });
    }
    
    hideBanner($banner: JQuery): Q.Promise<void> {
        return Q.Promise<void>(resolve => {
            $banner.animate({opacity: 0}, 500, () => {
                $banner.remove();
                resolve(null);
            });
        });
    }
    
    showAndHideBanner($banner: JQuery, delay: number): void {
        this.showBanner($banner)
        .then(() => {
            return Q.delay(delay)
            .then(() => {
                return this.hideBanner($banner);
            });
        });
    }
    
    prepareForDistractionFreeMode(): void {
        let hidingBarsForDFM = false;
        let showingBarsForDFM = false;
        this.$body.on("distraction-free-mode-on", () => {
            this.$body.addClass("distraction-free-mode");
            this.$toolbar.css({top: -this.$toolbar.outerHeight()});
            this.$statusBar.css({bottom: -this.$statusBar.outerHeight()});
            showingBarsForDFM = false;
            hidingBarsForDFM = false;
        });
        this.$body.on("distraction-free-mode-off", () => {
            this.$body.removeClass("distraction-free-mode");
            this.$toolbar.css({top: 0});
            this.$statusBar.css({bottom: 0});
        });
        this.$body.on("mousemove", (event: JQueryMouseEventObject) => {
            if (this.$body.hasClass("distraction-free-mode")) {
                if ((!showingBarsForDFM && event.pageY <= 5) || (showingBarsForDFM && event.pageY <= this.$toolbar.outerHeight())) {
                    if (!showingBarsForDFM) {
                        showingBarsForDFM = true;
                        hidingBarsForDFM = false;
                        this.$toolbar.stop(true, false).animate({top: 0});
                        this.$statusBar.stop(true, false).animate({bottom: 0});
                    }
                }
                else {
                    if (!this.showingFileMenu) {
                        this.$toolbar.trigger("mouseout");
                    }
                }
            }
            this.lastMouseMoveEvent = event;
        });
        this.$body.on("mouseout", ".toolbar-container,.status-bar", event => {
            if (this.$body.hasClass("distraction-free-mode")) {
                if (this.$toolbar.find("[data-prevent-toolbar-hide-when-visible]:visible").length) {
                    return;
                }
                if (event.pageY <= this.$toolbar.outerHeight()) {
                    return;
                }
                if (!hidingBarsForDFM) {
                    hidingBarsForDFM = true;
                    showingBarsForDFM = false;
                    this.$toolbar.stop(true, false).animate({top: -this.$toolbar.outerHeight()});
                    this.$statusBar.stop(true, false).animate({bottom: -this.$statusBar.outerHeight()});
                }
            }
        });
    }
    
    refreshPreviewMode() {
        this.$mainContent.toggleClass("preview-mode", this.previewMode);
        this.$mainContent.removeClass("released");
        this.$buttonsOverlay = null;
        
        let $htmlEditor = this.$editor.find(".html-editor");
        $htmlEditor.attr("contenteditable", this.previewMode ? "false" : "true")
        
        if (this.previewMode) {
            // mozliwosc zaznaczania tekstu
            $htmlEditor.removeClass("unselectable").addClass("selectable");
            
            this.makeCustomScroll(this.$editor.parent());
            this.addButtonsOverlay();
        }
    }
    
    reopen(currentViewId: number, alwaysTriggerLoad: boolean = false) {
        this.currentViewId = currentViewId;
        if (this.loaded || alwaysTriggerLoad) {
            this.triggerEvent("load");
        }
    }
    
    release(currentViewId: number) {
        this.destroyScroll(this.$editor);
        this.currentViewId = currentViewId;
        this.editor = null;
        this.$editor.html("");
        this.$mainContent.addClass("released");
        this.$toolbar.html("");
        this.$buttonsOverlay = null;
    }
    
    onDownloadClick(): void {
        this.triggerEvent("download");
    }
    
    onAttachToTaskClick(): void {
        this.triggerEvent("attachToTask");
    }
    onSendClick(): void {
        this.triggerEvent("send");
    }
    onPrintClick(): void {
        this.triggerEvent("print");
    }
    onSaveAsPdfClick(): void {
        this.triggerEvent("saveAsPdf");
    }
    
    onOpenEditWindowClick(e: MouseEvent) {
        if (!this.state.docked) {
            this.editModeFromPreview = true;
            this.state.editModeFromPreview = true;
            this.removeButtonsOverlay();
            
            this.previewMode = false;
            this.state.previewMode = false;
            
            this.state.editMode = true;
            this.editor.editMode = true;
            let $editorContents = this.$mainContent.find(".editor").detach();
            this.$mainContent.empty().append("<div class='toolbar-container'></div>");
            this.$toolbar = this.$mainContent.find(".toolbar-container");
            
            this.toolbarTmpl = this.templateManager.createTemplate(toolbarTemplate);
            this.$toolbar.empty().append(this.toolbarTmpl.renderToJQ(this.state));
            this.renderName();
            // this.bindToolbarActions();
            this.$mainContent.append($editorContents);
            
            this.triggerEvent("enterFromPreviewToEditMode");
            
            e.stopPropagation();
            return false;
        }
    }
    
    onEditorPaste(): void {
        this.triggerEvent("clipboardPaste");
    }
    
    onEditorCopy(data: app.common.clipboard.ClipboardData): void {
        this.triggerEvent("clipboardCopy", data);
    }
    
    clipboardPaste(data: app.common.clipboard.ClipboardData): void {
        this.editor.paste(data);
    }
    
    bindEditorKeyPresses(): void {
        $(document).on("keydown", e => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.keyCode == 83) {
                this.triggerEvent("save");
                return false;
            }
            else if (e.keyCode === webUtils.KEY_CODES.downArrow) {
                if (this.previewMode) {
                    e.preventDefault();
                    this.scrollPreview(false);
                }
            }
            else if (e.keyCode === webUtils.KEY_CODES.upArrow) {
                if (this.previewMode) {
                    e.preventDefault();
                    this.scrollPreview(true);
                }
            }
            else if (e.keyCode == webUtils.KEY_CODES.openBracket && webUtils.WebUtils.hasCtrlModifier(<any>e)) {
                this.setSmallerFontSize();
            }
            else if (e.keyCode == webUtils.KEY_CODES.closeBraket && webUtils.WebUtils.hasCtrlModifier(<any>e)) {
                this.setLargerFontSize();
            }
        });
    }
    
    setSmallerFontSize(): void {
        this.setAdjacentFontSize(-1);
    }
    
    setLargerFontSize(): void {
        this.setAdjacentFontSize(1);
    }
    
    setAdjacentFontSize(direction: -1|1): void {
        if (!this.editor || !(this.editor instanceof StyledEditor)) {
            return;
        }
        let availableSizes = this.getAvailableFontSizesArray();
        let currSizeStr = this.editor.getFontSize();
        let currSize = availableSizes.filter(x => x.cssSize == currSizeStr)[0];
        if (!currSize) {
            return;
        }
        let idx = availableSizes.indexOf(currSize);
        let newIdx = idx + direction;
        if (newIdx < 0 || newIdx > (availableSizes.length - 1)) {
            return;
        }
        let newSize = availableSizes[newIdx];
        // this.setEditorFontSize(newSize.cssSize);
        this.editor.setStyle(undefined, newSize.cssSize, undefined);
    }
    
    getAvailableFontSizesArray(): { cssSize: string, displayedSize: string }[] {
        let arr: { cssSize: string, displayedSize: string }[] = [];
        for (let cssSize in component.mindmap.Mindmap.AVAILABLE_FONT_SIZES) {
            let displayedSize = component.mindmap.Mindmap.AVAILABLE_FONT_SIZES[cssSize];
            arr.push({ cssSize, displayedSize });
        }
        return arr.sort((a, b) => parseFloat(a.cssSize) - parseFloat(b.cssSize));
    }
    
    scrollPreview(up: boolean) {
        const offset: number = 40;
        let $conv = this.$editor.children(".pf-content").children(".pf-content");
        let currPos = $conv.scrollTop();
        $conv.scrollTop(up ? currPos - offset : currPos + offset);
    }
    
    addButtonsOverlay() {
        let $editorContent = this.$mainContent.find(".editor").detach();
        // this.$toolbarContents = this.$main.find(".toolbar-container").detach();
        this.editorButtons.$buttons.removeClass("hidden-buttons");
        this.$mainContent.append($editorContent);
    }
    
    removeButtonsOverlay() {
        this.editorButtons.$buttons.addClass("hidden-buttons");
    }

    doInnerElementsFit(element: HTMLElement): boolean {
        if (! element) {
            return;
        }
        return element.clientHeight < 50;
    }
    
    getElementWidth(element: HTMLElement): number {
        let style = window.getComputedStyle(element);
        let totalWidth = 0;
        totalWidth += element.offsetWidth, // or use style.width
        totalWidth += parseFloat(style.marginLeft) + parseFloat(style.marginRight),
        totalWidth += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
        totalWidth += parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        return totalWidth;
    }
    
    onOpenToolbarMoreClick(): void {
        let $menu = this.$mainContent.find(".context-menu-toolbar-more");
        let $menuContent = $menu.find(".context-menu-content");
        let $btns = this.$toolbar.find("button[data-action]");
        let offset = $btns.first().offset().top + 10;
        $menuContent.empty();
        let empty = true;
        let dropDownOpenerInvisible: boolean = false;
        $btns.each((_idx, btn) => {
            let $btn = $(btn);
            let isDropDownOpener = $btn.is("[data-action=open-tools-menu]");
            let isInDropDown = $btn.parent().is(".context-menu-content");
            if (isInDropDown || $btn.offset().top > offset || ($btn.hasClass("float-right") && ($btn.parent().hasClass("invisible") || $btn.parent().parent().hasClass("invisible")))) {
                if (isDropDownOpener) {
                    dropDownOpenerInvisible = true;
                    return;
                }
                if (isInDropDown && !dropDownOpenerInvisible) {
                    return;
                }
                let $parent = $btn.parent();
                if (!$parent.is(".style-switcher") && !$parent.is(".font-size-switcher")) {
                    let $newBtn = $btn.clone(true);
                    if (isInDropDown) {
                        $parent = $parent.parent().parent();
                    }
                    $newBtn.toggleClass("read-mode-buttons", $parent.hasClass("read-mode-buttons"));
                    $newBtn.toggleClass("edit-mode-buttons", $parent.hasClass("edit-mode-buttons"));
                    $menuContent.append($newBtn);
                    empty = false;
                }
            }
            else if (isDropDownOpener || (!isDropDownOpener && !isInDropDown)) {
                dropDownOpenerInvisible = false;
            }
        });
        if (!empty) {
            $menu.addClass("visible");
        }
    }
    
    onCloseToolbarMoreClick(): void {
        this.$mainContent.find(".context-menu-toolbar-more").removeClass("visible");
        this.$mainContent.find(".context-menu-toolbar-tools").removeClass("visible");
    }
    
    onToolbarMoreItemClick(e: MouseEvent): void {
        let $btn = $(e.currentTarget);
        if (!$btn.is(":disabled")) {
            this.$mainContent.find(".context-menu-toolbar-more").removeClass("visible");
        }
    }
    
    onToolbarToolsItemClick(e: MouseEvent): void {
        let $btn = $(e.currentTarget);
        if (!$btn.is(":disabled")) {
            this.$mainContent.find(".context-menu-toolbar-tools").removeClass("visible");
        }
    }
    
    onToolbarToolsClick(e: MouseEvent): void {
        let $btn = $(e.currentTarget);
        let offset = $btn.offset();
        if (!$btn.is(":disabled")) {
            let $el = $btn.parent().find(".context-menu-toolbar-tools");
            $el.find("style").remove();
            let hw = $btn.outerWidth() / 2;
            $el.append("<style type='text/css'>.context-menu-toolbar-tools .context-menu-content:before { right: auto; left: " + hw + "px; }</style>");
            $el.find(".context-menu-content").css({
                right: "auto",
                left: offset.left,
            })
            $el.addClass("visible");
        }
    }
    
    onTaskClick(e: MouseEvent): void {
        if ($.contains(this.taskChooser.$main[0], <any>e.target)) {
            return;
        }
        let $ele = $(e.target);
        let taskId = $ele.closest("[data-task-id]").data("task-id");
        this.taskChooser.movePopup(e.pageX,  e.pageY, 300, 150);
        this.triggerEvent("openTask", taskId);
    }
    
    prepareToPrint(scaling: boolean = false): void {
        this.html2canvasScaleMultiplier = 1.0;
        this.fileLoadedDeferred.promise.then(() => {
            if (scaling) {
                let $elem = this.$main.find(".main-content").first();
                let $mindmap = $elem.find(".mindmap-root .mindmap");
                if ($mindmap.length > 0) {
                    let availWidth = $mindmap.parent().innerWidth();
                    let mindmapWidth = $mindmap.find("svg").outerWidth(true);
                    let scale = mindmapWidth > availWidth ? (availWidth / mindmapWidth) : 1.0;
                    this.html2canvasScaleMultiplier = 1.0 / scale;
                    $mindmap.css({
                        transform: "scale(" + scale + ")",
                        transformOrigin: "left top",
                        marginTop: "10px",
                    });
                }
            }
            (<HTMLFrameElement>frameElement).style.height = document.body.clientHeight + "px";
            this.triggerEvent("preparedToPrint");
        });
    }
    
    saveAsPdf(): void {
        this.fileLoadedDeferred.promise.then(() => {
            let $elem = this.$main.find(".main-content").first();
            let $mindmap = $elem.find(".mindmap-root .mindmap");
            if ($mindmap.length > 0) {
                $mindmap.find("path").css({
                    stroke: "#ccc",
                    strokeWidth: "1px",
                    fill: "none",
                });
                $mindmap.find(".node.selected").removeClass("selected");
                let h = $mindmap.height() + 10;
                let $el = $mindmap.parent();
                while ($el.length > 0) {
                    $el.height(h);
                    $el = $el.parent();
                }
                $elem.find(".mindmap-root .mindmap").replaceWith($mindmap);
            }
            $elem.width($elem.width());
            $elem.height($elem.height() + 10);
            html2pdf()
            .from($elem[0])
            .set({
                margin: 16,
                filename: this.entry.fileName.substr(0, this.entry.fileName.lastIndexOf(".")) + ".pdf",
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2 * this.html2canvasScaleMultiplier },
                jsPDF: { unit: "pt", format: "A4", orientation: "portrait" }
            })
            .output().then((data: string) => {
                this.triggerEvent("pdfOutput", data);
            });
        });
    }
    
    setBoundTasksStr(boundTasksStr: string): void {
        if (this.state) {
            this.state.boundTasksStr = boundTasksStr;
            this.$toolbar.empty().append(this.toolbarTmpl.renderToJQ(this.state));
            this.renderName();
        }
    }
    
    updateTaskStatuses(): Q.Promise<void> {
        let text = this.editor.getState();
        let matches = text.match(/\B#[0-9]{3,}\b/g);
        if (!matches) {
            return;
        }
        let taskIdsObj: { [taskId: string]: boolean } = {};
        for (let taskHashId of matches) {
            let taskId = taskHashId.substr(1);
            taskIdsObj[taskId] = true;
        }
        let taskIds = Object.keys(taskIdsObj);
        this.channelPromise<string>("getTaskStatuses", JSON.stringify(taskIds)).then(taskStatusesStr => {
            this.setTaskStatuses(taskStatusesStr);
        });
    }
    
    setTaskStatuses(taskStatusesStr: string): void {
        let taskStatuses: { [taskId: string]: string } = JSON.parse(taskStatusesStr);
        let changed: boolean = false;
        for (let taskId in taskStatuses) {
            if (this.taskStatuses[taskId] != taskStatuses[taskId]) {
                changed = true;
                this.taskStatuses[taskId] = taskStatuses[taskId];
            }
        }
        for (let taskId in this.taskStatuses) {
            if (this.taskStatuses[taskId] != taskStatuses[taskId]) {
                changed = true;
                delete this.taskStatuses[taskId];
            }
        }
        if (changed && this.editor) {
            this.editor.updateTaskBadges();
        }
    }
    
    updateRelatedSection() {
        if (this.editor && this.state && this.state.entry) {
            this.editor.relatedHostHash = this.state.entry.hostHash;
            this.editor.relatedSectionId = this.state.entry.sectionId;
        }
    }
    
    updateFileName(newFileName: string, newFullFileName: string, newTitle: string): void {
        if (this.state && this.state.entry && this.state.entry.fileName) {
            this.state.entry.fileName = newFileName;
        }
        this.$toolbar.find(".file-name").text(newFileName);
    }
    
    updatePaddingBottom(): void {
        if (!this.state || this.state.editMode) {
            return;
        }
        let buttonsHeight = this.editorButtons.getButtonsHeight();
        this.$editor.find(".editor-textarea").css("padding-bottom", buttonsHeight + 12);
    }

    onLockFileClick(e: MouseEvent): void {
        this.triggerEvent("lockFile");
    }

    onUnlockFileClick(e: MouseEvent): void {
        this.triggerEvent("unlockFile");
    }

    updateLockInfoOnActionButtons(locked: boolean, canUnlock: boolean): void {
        let unlockAvail = locked && canUnlock;
        this.$toolbar.find("[data-action=unlock]").toggleClass("hide", !unlockAvail);
        this.$toolbar.find("[data-action=lock]").toggleClass("hide", locked);
    }
    
}
