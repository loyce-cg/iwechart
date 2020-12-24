import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as toolbarTemplate} from "./template/toolbar.html";
import {Templates} from "../../component/template/web";
import {Model} from "./MindmapEditorWindowController";
import {app} from "../../Types";
import * as $ from "jquery";
import * as Q from "q";
import {NotificationView} from "../../component/notification/NotificationView";
import { TaskChooserView } from "../../component/taskchooser/web";
import { TaskTooltipView } from "../../component/tasktooltip/web";
import { PersonsView } from "../../component/persons/PersonsView";
import { MindmapEditorView } from "../../component/mindmapeditor/MindmapEditorView";
import { State } from "../../component/mindmapeditor/MindmapEditorController";
import { EditorButtonsView } from "../../component/editorbuttons/web";
import * as ResizeObserverPolyfill from "resize-observer-polyfill";

declare var html2pdf: any;

@WindowView
export class MindmapEditorWindowView extends BaseWindowView<Model> {
    
    static readonly MAX_FILENAME_WIDTH: number = 230;
    
    $toolbar: JQuery;
    state: State;
    toolbarTmpl: any;
    editMode: boolean = false;
    personsComponent: PersonsView;
    notifications: NotificationView;
    editorButtons: EditorButtonsView;
    taskTooltip: TaskTooltipView;
    taskChooser: TaskChooserView;
    mindmapEditor: MindmapEditorView;
    isDirty: boolean = false;
    html2canvasScaleMultiplier: number = 1;
    fileLoadedDeferred: Q.Deferred<void> = Q.defer();
    currentViewId: number = 1;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.helper));
        this.notifications = this.addComponent("notifications", new NotificationView(this));
        this.editorButtons = this.addComponent("editorbuttons", new EditorButtonsView(this));
        this.taskTooltip = this.addComponent("tasktooltip", new TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };
        this.taskChooser = this.addComponent("taskchooser", new TaskChooserView(this));
        this.mindmapEditor = this.addComponent("mindmapeditor", new MindmapEditorView(this));
        
        if (!(<any>window).ResizeObserver) {
            (<any>window).ResizeObserver = ResizeObserverPolyfill;
        }
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.state = {
            docked: model.docked,
            fileName: model.fileName,
            editMode: model.editMode,
            previewMode: model.previewMode,
            entry: model.entry,
            dirty: false,
            customHtml: this.mindmapEditor.getCustomToolbarMenuHtml(),
            rightSideHtml: this.mindmapEditor.getCustomToolbarRightSideMenuHtml(),
            editModeFromPreview: false,
            canPrint: model.canPrint,
            canSaveAsPdf: model.canSaveAsPdf,
            boundTasksStr: model.boundTasksStr,
        };
        if (model.printMode) {
            $("html").addClass("print-mode");
            $("body").addClass("print-mode");
        }
        $("body").attr("data-style-name", model.initialStyleName);
        
        this.clearState(true);
        this.$toolbar = this.$main.find(".toolbar-container");
        this.toolbarTmpl = this.templateManager.createTemplate(toolbarTemplate);
        
        this.$toolbar.empty().append(this.toolbarTmpl.renderToJQ(this.state));
        this.renderName();
        
        this.$toolbar.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$toolbar.on("click", "[data-action=print]", this.onPrintClick.bind(this));
        this.$toolbar.on("click", "[data-action=history]", this.onHistoryClick.bind(this));
        this.$toolbar.on("click", "[data-action=send]", this.onSendClick.bind(this));
        this.$toolbar.on("click", "[data-action=download]", this.onDownloadClick.bind(this));
        this.$toolbar.on("click", "[data-action=save-as-pdf]", this.onSaveAsPdfClick.bind(this));
        this.$toolbar.on("click", "[data-action=lock]", this.onLockFileClick.bind(this));
        this.$toolbar.on("click", "[data-action=unlock]", this.onUnlockFileClick.bind(this));

        this.$toolbar.on("click", "[data-action=enter-edit-mode]", this.onEnterEditModeClick.bind(this));
        this.$toolbar.on("click", "[data-action=reload]", this.onReloadClick.bind(this));
        this.$toolbar.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$toolbar.on("click", "[data-action=rename]", this.onRenameClick.bind(this));
        this.$toolbar.on("click", "[data-action=attach-to-task]", this.onAttachToTaskClick.bind(this));
        this.$toolbar.on("click", "[data-task-id]", this.onTaskClick.bind(this));
        this.$toolbar.on("click", "[data-action=open-mindmap-help]", this.onOpenMindmapHelpClick.bind(this));
        this.$toolbar.on("click", "[data-action=open-toolbar-more]", this.onOpenToolbarMoreClick.bind(this));
        this.$main.on("click", ".context-menu-backdrop2", this.onCloseToolbarMoreClick.bind(this));
        this.$main.on("click", ".context-menu-toolbar-more", this.onToolbarMoreItemClick.bind(this));
        this.$toolbar.on("click", "[data-action=open-tools-menu]", this.onToolbarToolsClick.bind(this));
        this.$toolbar.on("click", ".context-menu-toolbar-tools", this.onToolbarToolsItemClick.bind(this));
        this.$main.on("click", ".style-switcher [data-action=switch-style]", this.onSwitchStyleClick.bind(this));
        this.$main.on("click", ".style-switcher [data-action=open]", this.onSwitchStyleTriggerClick.bind(this));
        this.$main.on("click", ".style-switcher .backdrop", this.onSwitchStyleBackdropClick.bind(this));
        this.$main.on("click", ".style-switcher [data-action=switch-font-size]", this.onSwitchFontSizeClick.bind(this));
        this.$main.on("click", ".font-size-switcher [data-action=open]", this.onSwitchFontSizeTriggerClick.bind(this));
        this.$main.on("click", ".font-size-switcher .backdrop", this.onSwitchFontSizeBackdropClick.bind(this));
        this.bindKeyPresses();
        this.personsComponent.$main = this.$main;
        this.notifications.$container = this.$main.find(".notifications");
        this.editorButtons.$main = this.$main;
        this.editorButtons.$container = this.$main;
        this.taskTooltip.$container = this.$main;
        this.taskChooser.$container = this.$main;
        this.mindmapEditor.$container = this.$main.find("#editor-container");
        return Q.all([
            this.personsComponent.triggerInit(),
            this.notifications.triggerInit(),
            this.editorButtons.triggerInit(),
            this.taskTooltip.triggerInit(),
            this.taskChooser.triggerInit(),
            this.mindmapEditor.triggerInit(),
        ])
        .then(() => {
            this.renderEditMode();
            $(window).resize(this.onResizeWindow.bind(this));
            this.updateToolbarItemsVisibility();
            this.$main.find(".print-header").text(model.fileName);
        }).thenResolve(null);
    }
    
    focus() {
        this.$main.find("[data-action='ok']").focus();
    }
    
    bindKeyPresses(): void {
    }
    
    copyPasteKeydownHandler(_e: KeyboardEvent): void {
    }
    
    setIsDirty(isDirty: boolean) {
        this.isDirty = isDirty;
        this.state.dirty = isDirty;
        this.renderDirty();
    }
    
    toggleEditorHidden(hidden: boolean): void {
        let $editor = this.$main.closest("body");
        $editor.toggleClass("hide", hidden);
    }
    
    clearState(addLoading: boolean, editMode: boolean = null) {
        if (editMode !== null) {
            this.state.editMode = editMode;
            this.renderEditMode();
            this.$main.toggleClass("readonly", !editMode);
            this.$main.toggleClass("editable", !!editMode);
        }
        let $toolbarContainer = this.$main.find(".toolbar-container");
        let $editor = this.$main.find(".component-mindmap-editor");
        if (addLoading) {
            this.$main.append(Templates.loading(this.templateManager, true));
            $toolbarContainer.css("visibility", "hidden");
            $editor.css("visibility", "hidden");
            $("#editor-container").css({ opacity: 0, pointerEvents: "none" });
        }
        else {
            this.$main.find(".screen-loading").closest(".screen-center").remove();
            $toolbarContainer.css("visibility", "visible");
            $editor.css("visibility", "visible");
            $("#editor-container").css({ opacity: 1, pointerEvents: "auto" });
            this.fileLoadedDeferred.resolve();
        }
        if (!addLoading) {
            this.triggerEvent("stateCleared");
        }
    }
    
    setBoundTasksStr(boundTasksStr: string): void {
        if (this.state) {
            this.state.boundTasksStr = boundTasksStr;
            this.$toolbar.empty().append(this.toolbarTmpl.renderToJQ(this.state));
            this.renderName();
        }
    }
    
    renderName(): void {
        let rev = this.state.fileName.split("").reverse().join("");
        this.fontMetrics.add(rev);
        this.fontMetrics.measure();
        let l = this.fontMetrics.getMaxTextLength(rev, MindmapEditorWindowView.MAX_FILENAME_WIDTH, false);
        let newText = (l < rev.length ? "..." : "") + rev.substr(0, l).split("").reverse().join("");
        this.$toolbar.find(".toolbar .file-name-with-rename-trigger .file-name").text(newText);
        $("body").find(".context-menu-file").remove();
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
    }
    
    prepareToPrint(scaling: boolean = false): void {
        this.html2canvasScaleMultiplier = 1.0;
        this.fileLoadedDeferred.promise.then(() => {
            if (scaling) {
                let $elem = this.$main.find(".component-mindmap-editor").first();
                let $mindmap = $elem.find(".mindmap");
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
            let $elem = this.$main.find(".component-mindmap-editor").first();
            let $mindmap = $elem.find(".mindmap");
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
                $elem.find(".mindmap").replaceWith($mindmap);
            }
            $elem.width($elem.width());
            $elem.height($elem.height() + 10);
            html2pdf()
            .from($elem[0])
            .set({
                margin: 16,
                filename: this.state.fileName.substr(0, this.state.fileName.lastIndexOf(".")) + ".pdf",
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 2 * this.html2canvasScaleMultiplier },
                jsPDF: { unit: "pt", format: "A4", orientation: "portrait" }
            })
            .output().then((data: string) => {
                this.triggerEvent("pdfOutput", data);
            });
        });
    }
    
    release(viewId: number): void {
        if (viewId != this.currentViewId + 1) {
            return;
        }
        this.currentViewId = viewId;
        this.mindmapEditor.release();
    }

    isVisible(): boolean {
        let isVisible: boolean = this.$main.is(":visible");
        return isVisible;
    }
    
    
    
    
    
    /**************************************************
    **************** Toolbar management ***************
    ***************************************************/
    onResizeWindow(): void {
        this.updateToolbarItemsVisibility();
    }
    
    getElementWidth(element: HTMLElement): number {
        let style = window.getComputedStyle(element);
        let totalWidth = 0;
        totalWidth += element.offsetWidth;
        totalWidth += parseFloat(style.marginLeft) + parseFloat(style.marginRight);
        totalWidth += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        totalWidth += parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        return totalWidth;
    }
    
    doInnerElementsFit(element: HTMLElement): boolean {
        if (!element) {
            return;
        }
        let $parent = $(element);
        let elementsWidth = 0;
        $parent.children().each((_, x) => {
            elementsWidth += this.getElementWidth(x);
        });
        return (element.offsetWidth - elementsWidth) > 0;
    }
    
    updateToolbarItemsVisibility(): void {
        let $toolbar = this.$toolbar.find(".toolbar");
        let elementsFit = this.doInnerElementsFit($toolbar.get(0));
        $toolbar.find(".right-side-buttons").toggleClass("invisible", !elementsFit);
        $toolbar.parent().find(".more-button").toggleClass("hide", elementsFit);
        $toolbar.toggleClass("with-more-button", !elementsFit);
    }
    
    onOpenToolbarMoreClick(): void {
        let $menu = this.$main.find(".context-menu-toolbar-more");
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
        this.$main.find(".context-menu-toolbar-more").removeClass("visible");
        this.$main.find(".context-menu-toolbar-tools").removeClass("visible");
    }

    onToolbarMoreItemClick(e: MouseEvent): void {
        let $btn = $(e.currentTarget);
        if (!$btn.is(":disabled")) {
            this.$main.find(".context-menu-toolbar-more").removeClass("visible");
        }
    }

    onToolbarToolsItemClick(e: MouseEvent): void {
        let $btn = $(e.currentTarget);
        if (!$btn.is(":disabled")) {
            this.$main.find(".context-menu-toolbar-tools").removeClass("visible");
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
    
    
    
    
    
    /**************************************************
    ****************** Toolbar items ******************
    ***************************************************/
    onSaveClick(): void {
        this.mindmapEditor.exitNodeLabelEditMode(true);
        this.triggerEvent("save");
    }
    
    onPrintClick(): void {
        this.triggerEvent("print");
    }
    
    onHistoryClick(): void {
        this.triggerEvent("history");
    }
    
    onSendClick(): void {
        this.triggerEvent("send");
    }
    
    onDownloadClick(): void {
        this.triggerEvent("download");
    }
    
    onSaveAsPdfClick(): void {
        this.mindmapEditor.exitNodeLabelEditMode(true);
        this.triggerEvent("saveAsPdf");
    }
    
    onEnterEditModeClick(): void {
        this.triggerEvent("enterEditMode");
    }
    
    onReloadClick(): void {
        this.triggerEvent("reload");
    }
    
    onAttachToTaskClick(): void {
        this.triggerEvent("attachToTask");
    }
    
    onOpenMindmapHelpClick(): void {
        this.triggerEvent("openMindmapHelp");
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
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onRenameClick(): void {
        this.triggerEvent("rename");
    }
    
    
    
    
    
    /**************************************************
    ***************** Style switching *****************
    ***************************************************/
    setStyle(styleStr: string, setEditorStyle: boolean = true): void {
        let style: { styleName: string, fontSize: string } = JSON.parse(styleStr);
        if (style.styleName) {
            this.$body.attr("data-style-name", style.styleName);
        }
        else {
            this.$body.removeAttr("data-style-name");
        }
        if (this.mindmapEditor && this.mindmapEditor.$component) {
            if (style.styleName) {
                this.mindmapEditor.$component.attr("data-style-name", style.styleName);
            }
            else {
                this.mindmapEditor.$component.removeAttr("data-style-name");
            }
        }
        if (setEditorStyle && this.mindmapEditor) {
            this.mindmapEditor.setStyle(style.styleName, style.fontSize);
        }
        this.refreshStyleSwitcherStateView();
        this.focus();
    }
    
    refreshStyleSwitcherStateView(): void {
        let $items = this.getStyleSwitcher().find("[data-action=switch-style]");
        $items.filter('.active').removeClass('active');
        let styleName = this.mindmapEditor.mindmap.getStyleName();
        $items.filter('[data-name="' + styleName + '"]').addClass("active");
        this.refreshFontSizeSwitcherStateView();
    }
    
    onSwitchStyleClick(event: Event): void {
        this.setStyle(JSON.stringify({ styleName: $(event.currentTarget).data("name") }));
        this.hideStyleSwitcher();
    }
    
    onSwitchStyleTriggerClick(): void {
        this.toggleStyleSwitcher();
    }
    
    onSwitchStyleBackdropClick(): void {
        this.hideStyleSwitcher();
    }
    
    hideStyleSwitcher(): void {
        let $switcher = this.getStyleSwitcher();
        $switcher.removeClass("open");
        $switcher.closest(".toolbar-container").trigger("mouseout");
    }
    
    showStyleSwitcher(): void {
        this.refreshStyleSwitcherStateView();
        this.getStyleSwitcher().addClass("open");
    }
    
    toggleStyleSwitcher(): void {
        let $switcher = this.getStyleSwitcher();
        if ($switcher.hasClass("open")) {
            this.hideStyleSwitcher();
        }
        else {
            this.showStyleSwitcher();
        }
    }
    
    getStyleSwitcher(): JQuery {
        return this.$main.find(".style-switcher");
    }
    
    
    
    
    
    /**************************************************
    *************** Font size switching ***************
    ***************************************************/
    setFontSize(fontSize: string, setEditorStyle: boolean = true): void {
        if (this.mindmapEditor && this.mindmapEditor.$component) {
            this.mindmapEditor.setEditorFontSize(fontSize);
        }
        if (setEditorStyle && this.mindmapEditor) {
            this.mindmapEditor.setStyle(undefined, fontSize);
        }
        this.refreshFontSizeSwitcherStateView();
        this.focus();
    }
    
    refreshFontSizeSwitcherStateView(): void {
        let $items = this.getStyleSwitcher().find("[data-action=switch-font-size]");
        $items.filter('.active').removeClass('active');
        let fontSize = this.mindmapEditor.mindmap.getFontSize();
        $items.filter('[data-name="' + fontSize + '"]').addClass("active");
    }
    
    onSwitchFontSizeClick(event: Event): void {
        this.setFontSize($(event.currentTarget).data("name"));
        this.hideStyleSwitcher();
        //this.hideFontSizeSwitcher();
    }
    
    onSwitchFontSizeTriggerClick(): void {
        this.toggleFontSizeSwitcher();
    }
    
    onSwitchFontSizeBackdropClick(): void {
        this.hideFontSizeSwitcher();
    }
    
    hideFontSizeSwitcher(): void {
        let $switcher = this.getFontSizeSwitcher();
        $switcher.removeClass("open");
        $switcher.closest(".toolbar-container").trigger("mouseout");
    }
    
    showFontSizeSwitcher(): void {
        this.refreshFontSizeSwitcherStateView();
        this.getFontSizeSwitcher().addClass("open");
    }
    
    toggleFontSizeSwitcher(): void {
        let $switcher = this.getFontSizeSwitcher();
        if ($switcher.hasClass("open")) {
            this.hideFontSizeSwitcher();
        }
        else {
            this.showFontSizeSwitcher();
        }
    }
    
    getFontSizeSwitcher(): JQuery {
        return this.$main.find(".font-size-switcher");
    }
    
    updateFileName(newFileName: string, _newFullFileName: string, _newTitle: string): void {
        if (this.state && this.state.entry && this.state.entry.fileName) {
            this.state.entry.fileName = newFileName;
        }
        if (this.state && this.state.fileName) {
            this.state.fileName = newFileName;
        }
        this.$toolbar.find(".file-name").text(newFileName);
    }
    
    onLockFileClick(): void {
        this.triggerEvent("lockFile");
    }
    
    onUnlockFileClick(): void {
        this.triggerEvent("unlockFile");
    }
    
    updateLockInfoOnActionButtons(locked: boolean, canUnlock: boolean): void {
        let unlockAvail = locked && canUnlock;
        this.$toolbar.find("[data-action=unlock]").toggleClass("hide", !unlockAvail);
        this.$toolbar.find("[data-action=lock]").toggleClass("hide", locked);
    }
}
