import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as toolbarTemplate} from "./template/toolbar.html";
import {Templates} from "../../component/template/web";
import {Model} from "./ImageEditorWindowController";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import * as $ from "jquery";
import * as Q from "q";
import {NotificationView} from "../../component/notification/NotificationView";
import {WebUtils} from "../../web-utils/WebUtils";
import { TaskChooserView } from "../../component/taskchooser/web";
import { TaskTooltipView } from "../../component/tasktooltip/web";
import { PersonsView } from "../../component/persons/PersonsView";
import * as ResizeObserverPolyfill from "resize-observer-polyfill";

declare var tui: any;
declare var blackTheme: any;

export interface State {
    docked: boolean;
    dirty: boolean;
    fileName: string;
    editMode: boolean;
    boundTasksStr: string;
}

export class DirtyState {
    undoCount: number;
    undoCountOnSave: number;
    redoCount: number;
    redoCountOnSave: number;
    initialDirty: boolean;
    constructor() {
        this.reset();
    }
    reset() {
        this.undoCount = 0;
        this.undoCountOnSave = 0;
        this.redoCount = 0;
        this.redoCountOnSave = 0;
        this.initialDirty = false;
    }
    setUndo(value: number) {
        this.undoCount = value;
    }
    setRedo(value: number) {
        this.redoCount = value;
    }
    save() {
        this.undoCountOnSave = this.undoCount;
        this.redoCountOnSave = this.redoCount;
    }
    setInitialDirty(isOn: boolean): void {
        this.initialDirty = isOn;
    }
    
    isDirty() {
        return (this.redoCount != this.redoCountOnSave || this.undoCount != this.undoCountOnSave || (this.initialDirty && this.undoCount == 0 && this.redoCount == 0));
    }
}

@WindowView
export class ImageEditorWindowView extends BaseWindowView<Model> {
    
    static readonly MAX_FILENAME_WIDTH: number = 230;
    static readonly AVAILABLE_ZOOM_LEVELS: number[] = [0.25, 0.375, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0];
    static readonly DEFAULT_ZOOM_LEVEL_ID: number = 7;
    
    $toolbar: JQuery;
    tuiEditor: any;
    currentDateString: string;
    state: State;
    iconsPath: string;
    toolbarTmpl: any;
    images: HTMLImageElement[];
    mimeType: string = "image/png";
    editMode: boolean = false;
    dirtyState: DirtyState;
    personsComponent: PersonsView;
    notifications: NotificationView;
    taskTooltip: TaskTooltipView;
    taskChooser: TaskChooserView;
    currentDataUrl: string;
    isReadonly: boolean = false;
    zoomLevels: number[] = ImageEditorWindowView.AVAILABLE_ZOOM_LEVELS;
    zoomLevelId: number = ImageEditorWindowView.DEFAULT_ZOOM_LEVEL_ID;
        
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.notifications = this.addComponent("notifications", new NotificationView(this));
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.helper));
        this.taskTooltip = this.addComponent("tasktooltip", new TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };
        this.taskChooser = this.addComponent("taskchooser", new TaskChooserView(this));
        if (!(<any>window).ResizeObserver) {
            (<any>window).ResizeObserver = ResizeObserverPolyfill;
        }
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.state = {
            docked: model.docked,
            dirty: false,
            fileName: model.fileName,
            editMode: model.editMode,
            boundTasksStr: model.boundTasksStr,
        };
        
        this.clearState(true);
        this.iconsPath = model.iconsPath;
        this.$toolbar = this.$main.find(".toolbar-container");
        this.toolbarTmpl = this.templateManager.createTemplate(toolbarTemplate);
        this.$body.attr("data-style-name", "white-on-black");
        this.dirtyState = new DirtyState();
        
        this.$toolbar.empty().append(this.toolbarTmpl.renderToJQ(this.state));
        this.renderName();
        $(window).resize(this.onResizeWindow.bind(this));
        
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=rename]", this.onRenameClick.bind(this));
        this.$main.on("click", "[data-action=ok]", this.onOkClick.bind(this));
        this.$main.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$main.on("click", "[data-action=enter-edit-mode]", this.onEnterEditModeClick.bind(this));
        this.$main.on("click", "[data-action=print]", this.onPrintClick.bind(this));
        this.$main.on("click", "[data-action=send]", this.onSendClick.bind(this));
        this.$main.on("click", "[data-action=history]", this.onHistoryClick.bind(this));
        this.$main.on("click", "[data-action=attach-to-task]", this.onAttachToTaskClick.bind(this));
        this.$main.on("click", "[data-task-id]", this.onTaskClick.bind(this));
        this.$main.on("click", ".zoom-in", this.onZoomInClick.bind(this));
        this.$main.on("click", ".zoom-out", this.onZoomOutClick.bind(this));
        this.$main.on("click", "[data-action=open-toolbar-more]", this.onOpenToolbarMoreClick.bind(this));
        this.$main.on("click", ".context-menu-backdrop2", this.onCloseToolbarMoreClick.bind(this));
        this.$main.on("click", ".context-menu-toolbar-more", this.onToolbarMoreItemClick.bind(this));
        this.bindKeyPresses();
        this.personsComponent.$main = this.$main;
        this.notifications.$container = this.$main.find(".notifications");
        this.taskTooltip.$container = this.$main;
        this.taskChooser.$container = this.$main;
        return Q.all([
            this.personsComponent.triggerInit(),
            this.notifications.triggerInit(),
            this.taskTooltip.triggerInit(),
            this.taskChooser.triggerInit(),
        ])
        .then(() => {
            this.updateToolbarItemsVisibility();
        });
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
    
    doInnerElementsFit(element: HTMLElement): boolean {
        return element.clientHeight < 50;
    }
    
    getElementWidth(element: HTMLElement): number {
        let style = window.getComputedStyle(element);
        let totalWidth = 0;
        totalWidth += element.offsetWidth; // or use style.width
        totalWidth += parseFloat(style.marginLeft) + parseFloat(style.marginRight);
        totalWidth += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        totalWidth += parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        return totalWidth;
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
    
    onSaveClick(): void {
        this.save();
    }
    
    onEnterEditModeClick(): void {
        if (this.isReadonly) {
            this.triggerEvent("enterEditMode");
        }
    }
    
    onPrintClick(): void {
        this.triggerEvent("print");
    }
    
    onSendClick(): void {
        this.triggerEvent("sendScreenshot", this.getDataUrl());
    }
    
    onAttachToTaskClick(): void {
        this.triggerEvent("attachToTask", this.getDataUrl());
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
    
    getDataUrl(): string {
        if (this.isReadonly) {
            let $canvasContainer = this.$main.find("#canvas-container");
            return $canvasContainer.find("img").attr("src");
        }
        return this.tuiEditor.toDataURL({
            format: this.mimeType == "image/jpeg" ? "jpeg" : "png",
            quality: 0.92,
        });
    }
        
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onRenameClick(): void {
        this.triggerEvent("rename");
    }
    
    save(): void {
        this.dirtyState.save();
        if (this.editMode) {
            this.triggerEvent("save", this.getDataUrl());
        }
        else {
            this.triggerEvent("saveScreenshot", this.getDataUrl());
        }
    }
    
    focus() {
        this.$main.find("[data-action='ok']").focus();
    }
    
    onOkClick(): void {
        this.triggerEvent("takeScreenshot");
    }
    
    reopenEditor(url: string): void {
        super.suppressErrors();
        try {
            this.createEditor(url);
            this.$main.toggleClass("readonly", false);
            this.setZoomLevelId(ImageEditorWindowView.DEFAULT_ZOOM_LEVEL_ID);
        } catch (e) {
            setTimeout(() => {
                this.reopenEditor(url);
            }, 100);
        }
        
        super.catchUnhandledErrors();
    }
    
    showReadonly(canvas: HTMLCanvasElement): void {
        this.$main.toggleClass("readonly", true);
        let $img = $("<img />");
        $img.attr("src", canvas.toDataURL());
        let $canvasContainer = this.$main.find("#canvas-container");
        $canvasContainer.empty();
        $canvasContainer.append($img);
        this.clearState(false);
    }
    
    createEditor(url: string): void {
        let customTheme = blackTheme;
        customTheme["menu.activeIcon.path"] = this.iconsPath + "/icon-b.svg";
        customTheme["menu.normalIcon.path"] = this.iconsPath + "/icon-d.svg";
        customTheme["menu.disabledIcon.path"] = this.iconsPath + "/icon-a.svg";
        customTheme["menu.hoverIcon.path"] = this.iconsPath + "/icon-c.svg";
        
        customTheme["submenu.activeIcon.path"] = this.iconsPath + "/icon-c.svg";
        customTheme["submenu.normalIcon.path"] = this.iconsPath + "/icon-d.svg";
        
        this.tuiEditor = new tui.ImageEditor(document.querySelector("#tui-image-editor"), {
             includeUI: {
                 menuBarPosition: "bottom",
                 // uiSize: {
                 //     width: this.$body.innerWidth(),
                 //     height: this.$body.innerHeight()
                 // },
                 loadImage: {
                     path: url,
                     name: this.state.fileName
                 },
                 theme: customTheme,
                 // initMenu: "basic"
             },
            selectionStyle: {
                cornerSize: 20,
                rotatingPointOffset: 70
            }
        });
        this.$main.find(".tui-image-editor-header").css("display", "none");
        
        // fix nie dodajacych sie ikon
        this.tuiEditor.registerIcons({
            "icon-arrow": "M40 12V0l24 24-24 24V36H0V12h40z",
            "icon-arrow-2": "M49,32 H3 V22 h46 l-18,-18 h12 l23,23 L43,50 h-12 l18,-18  z ",
            "icon-arrow-3": "M43.349998,27 L17.354,53 H1.949999 l25.996,-26 L1.949999,1 h15.404 L43.349998,27  z ",
            "icon-star": "M35,54.557999 l-19.912001,10.468 l3.804,-22.172001 l-16.108,-15.7 l22.26,-3.236 L35,3.746 l9.956,20.172001 l22.26,3.236 l-16.108,15.7 l3.804,22.172001  z ",
            "icon-star-2": "M17,31.212 l-7.194,4.08 l-4.728,-6.83 l-8.234,0.524 l-1.328,-8.226 l-7.644,-3.14 l2.338,-7.992 l-5.54,-6.18 l5.54,-6.176 l-2.338,-7.994 l7.644,-3.138 l1.328,-8.226 l8.234,0.522 l4.728,-6.83 L17,-24.312 l7.194,-4.08 l4.728,6.83 l8.234,-0.522 l1.328,8.226 l7.644,3.14 l-2.338,7.992 l5.54,6.178 l-5.54,6.178 l2.338,7.992 l-7.644,3.14 l-1.328,8.226 l-8.234,-0.524 l-4.728,6.83  z ",
            "icon-polygon": "M3,31 L19,3 h32 l16,28 l-16,28 H19  z ",
            "icon-location": "M24 62C8 45.503 0 32.837 0 24 0 10.745 10.745 0 24 0s24 10.745 24 24c0 8.837-8 21.503-24 38zm0-28c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10z",
            "icon-heart": "M49.994999,91.349998 l-6.96,-6.333 C18.324001,62.606995 2.01,47.829002 2.01,29.690998 C2.01,14.912998 13.619999,3.299999 28.401001,3.299999 c8.349,0 16.362,5.859 21.594,12 c5.229,-6.141 13.242001,-12 21.591,-12 c14.778,0 26.390999,11.61 26.390999,26.390999 c0,18.138 -16.314001,32.916 -41.025002,55.374001 l-6.96,6.285  z ",
            "icon-bubble": "M44 48L34 58V48H12C5.373 48 0 42.627 0 36V12C0 5.373 5.373 0 12 0h40c6.627 0 12 5.373 12 12v24c0 6.627-5.373 12-12 12h-8z"
        });

        this.tuiEditor.clearUndoStack();
        this.tuiEditor.clearRedoStack();
        
        this.tuiEditor.on({
            "undoStackChanged": (undoLength: number) => {
                this.dirtyState.setUndo(undoLength);
                this.setDirty(this.dirtyState.isDirty());
                this.setSize();
            },
            "redoStackChanged": (redoLength: number) => {
                this.dirtyState.setRedo(redoLength);
                this.setDirty(this.dirtyState.isDirty());
                this.setSize();
            }
        });
        this.clearState(false);
        setTimeout(() => {
            this.setSize();
        }, 1);
        if ((<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver(() => {
                this.setSize();
            });
            resizeObserver.observe(this.$main.find(".tui-image-editor-wrap")[0]);
        }
        else {
            $(window).on("resize", this.setSize.bind(this));
        }
    }
    
    setSize() {
        let $tuiWrap = this.$main.find(".tui-image-editor-wrap");
        let width = $tuiWrap.width();
        let height = $tuiWrap.height();
        let $imageEditorWindow = this.$main.find(".tui-image-editor");
        let canvas = <HTMLCanvasElement>$imageEditorWindow.find("canvas").get(0);
        let baseWidth = canvas.width;
        let baseHeight = canvas.height;
        
        let scale = Math.min(1.0, width / baseWidth, height / baseHeight);
        let newWidth = scale * baseWidth;
        let newHeight = scale * baseHeight;
        $imageEditorWindow.css("width", newWidth + "px");
        $imageEditorWindow.css("height", newHeight + "px");
        $imageEditorWindow.find("canvas, .tui-image-editor-canvas-container")
            .css("max-width", newWidth + "px")
            .css("max-height", newHeight + "px");
    }
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.enter) {
                e.preventDefault();
                this.onOkClick();
            }
            else if (e.keyCode == KEY_CODES.escape) {
                e.preventDefault();
                this.onCloseClick();
            }
            else if (e.keyCode == KEY_CODES.s && e.ctrlKey) {
                if (this.isDirty()) {
                    this.save();
                }
            }
        });
    }

    loadImage(imgData: Buffer, mimeType: string) {
        this.mimeType = mimeType;
        let blob = new Blob([imgData], {"type": mimeType});
        let url = URL.createObjectURL(blob);
        
        let defer = Q.defer<void>();
        let img = new Image();
        img.onload = () => {
            this.images.push(img);
            this.triggerEvent("detectImageSize", img.naturalWidth, img.naturalHeight);
            return defer.resolve();
        }
        img.src = url;
        this.setZoomLevelId(ImageEditorWindowView.DEFAULT_ZOOM_LEVEL_ID);
        return defer.promise;
    }
    
    editImage(data: app.BlobData, _fileName: string, mimeType: string): void {
        this.isReadonly = false;
        this.mimeType = mimeType;
        this.editMode = true;
        if (this.currentDataUrl) {
            URL.revokeObjectURL(this.currentDataUrl);
        }
        this.currentDataUrl = WebUtils.createObjectURL(data);
        let img = new Image();
        img.onload = () => {
            this.triggerEvent("detectImageSize", img.naturalWidth, img.naturalHeight);
        };
        img.src = this.currentDataUrl;
        this.reopenEditor(this.currentDataUrl);
    }
    
    updateImage(data: Buffer[], mimeType: string, readonly: boolean = false) {
        this.isReadonly = readonly;
        this.editMode = false;
        this.images = [];
        Q().then(() => {
            let imagesToLoad: Q.IWhenable<any>[] = [];
            for (let i = 0; i < data.length; i++) {
                let whenable = this.loadImage(data[i], mimeType);
                imagesToLoad.push(Q().then(() => whenable));
            }
            
            return Q.all(imagesToLoad).then(() => {
                let totalWidth: number = 0;
                let maxHeight: number = 0;
                for (let i = 0; i < this.images.length; i++) {
                    totalWidth += this.images[i].width;
                    maxHeight = this.images[i].height > maxHeight ? this.images[i].height : maxHeight;
                }

                let canvas = document.createElement("canvas");
                canvas.width = totalWidth;
                canvas.height = maxHeight;
                let ctx = canvas.getContext("2d");

                let currPos = 0;
                for (let i = 0; i < this.images.length; i++) {
                    ctx.drawImage(this.images[i], currPos, 0);
                    currPos += this.images[i].width;
                }
                if (this.images.length > 0) {
                    if (readonly) {
                        this.showReadonly(canvas);
                    }
                    else {
                        canvas.toBlob(blob => {
                            if (this.currentDataUrl) {
                                URL.revokeObjectURL(this.currentDataUrl);
                            }
                            this.currentDataUrl = URL.createObjectURL(blob);
                            this.reopenEditor(this.currentDataUrl);
                        });
                    }
                }
                
            });
        })
        .then(() => {
            this.dirtyState.setInitialDirty(true);
            this.dirtyState.setInitialDirty(!readonly);
            if (readonly) {
                this.setDirty(false);
            }
        })
    }
    
    isDirty(): boolean {
        return this.state.dirty;
    }
    
    setDirty(isDirty: boolean) {
        this.state.dirty = isDirty;
        this.triggerEvent("setDirty", isDirty);
        this.updateToolbarButtonsState();
    }
    
    updateToolbarButtonsState(): void {
        let isDirty = this.isDirty();
        this.$toolbar.find("[data-action=save]").prop("disabled", !isDirty);
    }
    
    clearState(addLoading: boolean) {
        let $toolbarContainer = this.$main.find(".toolbar-container");
        let $editor = this.$main.find("#tui-image-editor");
        if (addLoading) {
            this.$main.append(Templates.loading(this.templateManager, true));
            $toolbarContainer.css("visibility", "hidden");
            $editor.css("visibility", "hidden");
        }
        else {
            this.$main.find(".screen-loading").closest(".screen-center").remove();
            $toolbarContainer.css("visibility", "visible");
            $editor.css("visibility", "visible");
        }
        this.$main.toggleClass("loading", addLoading);
    }
    
    setProgress(progress: {percent: number}): void {
        if (window == null) {
            return;
        }
        this.$main.find(".screen-loading-progress-text").html(progress.percent + "%");
    }
    
    onHistoryClick(): void {
        this.triggerEvent("history");
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
        let l = this.fontMetrics.getMaxTextLength(rev, ImageEditorWindowView.MAX_FILENAME_WIDTH, false);
        let newText = (l < rev.length ? "..." : "") + rev.substr(0, l).split("").reverse().join("");
        this.$toolbar.find(".toolbar .file-name-with-rename-trigger .file-name").text(newText);
        $("body").find(".context-menu-file").remove();
    }
    
    onZoomInClick(): void {
        this.zoomIn();
    }
    
    onZoomOutClick(): void {
        this.zoomOut();
    }
    
    zoomIn(): void {
        let zoomLevelId = Math.min(this.zoomLevels.length - 1, this.zoomLevelId + 1);
        this.setZoomLevelId(zoomLevelId);
    }
    
    zoomOut(): void {
        let zoomLevelId = Math.max(0, this.zoomLevelId - 1);
        this.setZoomLevelId(zoomLevelId);
    }
    
    setZoomLevelId(zoomLevelId: number): void {
        this.zoomLevelId = zoomLevelId;
        let zoomLevel = this.zoomLevels[this.zoomLevelId];
        let $elem = this.$main.find("#tui-image-editor .tui-image-editor-wrap");
        if ($elem.length == 0) {
            $elem = this.$main.find("#canvas-container img");
        }
        $elem.css("position", "relative");
        $elem.css("transform", `scale(${zoomLevel})`);
        let x = parseInt($elem.css("left")) || 0;
        let y = parseInt($elem.css("top")) || 0;
        [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
        $elem.css("left", x + "px");
        $elem.css("top", y + "px");
        $elem.parent().off("mousewheel.wheelmove").on("mousewheel.wheelmove", e => {
            let x = parseInt($elem.css("left")) || 0;
            let y = parseInt($elem.css("top")) || 0;
            let d = (<any>e).originalEvent.wheelDelta / 4;
            if (e.shiftKey) {
                x += d;
                [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
                $elem.css("left", x + "px");
            }
            else {
                y += d;
                [x, y] = this.adjustCoordsToMakeImgVisible($elem, x, y);
                $elem.css("top", y + "px");
            }
        });
    }
    
    adjustCoordsToMakeImgVisible($img: JQuery, x: number, y: number): [number, number] {
        $img = $img.find("canvas.lower-canvas");
        let imgW = $img.width();
        let imgH = $img.height();
        let $parent = $img.closest(".tui-image-editor-main-container, #canvas-container");
        let parentW = $parent.width();
        let parentH = $parent.height();
        
        let offsetX = (parentW - imgW) / 2;
        let offsetY = (parentH - imgH) / 2;
        let imgBox = {
            x0: offsetX + x,
            y0: offsetY + y,
            x1: offsetX + x + imgW,
            y1: offsetY + y + imgH,
        };
        let containerBox = {
            x0: 0,
            y0: 0,
            x1: 0 + parentW,
            y1: 0 + parentH,
        };
        let minVisibleSize = 64;
        let viewBox = {
            x0: containerBox.x0 + minVisibleSize,
            y0: containerBox.y0 + minVisibleSize,
            x1: containerBox.x1 - minVisibleSize,
            y1: containerBox.y1 - minVisibleSize,
        };
        
        if (imgBox.x1 < viewBox.x0) {
            // Image too far left
            x += viewBox.x0 - imgBox.x1;
        }
        else if (imgBox.x0 > viewBox.x1) {
            // Image too far right
            x -= imgBox.x0 - viewBox.x1;
        }
        if (imgBox.y1 < viewBox.y0) {
            // Image too far up
            y += viewBox.y0 - imgBox.y1;
        }
        else if (imgBox.y0 > viewBox.y1) {
            // Image too far down
            y -= imgBox.y0 - viewBox.y1;
        }
        
        return [x, y];
    }
    
    updateFileName(newFileName: string, _newFullFileName: string, _newTitle: string): void {
        if (this.state && this.state.fileName) {
            this.state.fileName = newFileName;
        }
        this.$toolbar.find(".file-name").text(newFileName);
    }
}
