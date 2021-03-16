import {ComponentView} from "../../component/base/ComponentView";
import {StatusBarView} from "../../component/statusbar/StatusBarView";
import * as $ from "jquery";
import {UI, KEY_CODES} from "../../web-utils/UI";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {app, webUtils} from "../../Types";
import * as Q from "q";
import {MsgBoxViewService} from "./MsgBoxViewService";
import * as RootLogger from "simplito-logger";
import {MsgBoxResult} from "../msgbox/MsgBoxWindowController";
import { CustomizationData } from "../../app/common/customization/CustomizationData";
// import { SpellCheckerView } from "../../app/electron/SpellCheckerView";
import { PerformanceLogger } from "../../app/common/PerformanceLogger";
import { FontMetricsView } from "../../app/common/fontMetrics/FontMetricsView";
import { WebUtils, ContentEditableEditor } from "../../web-utils";
import { FilePickerData } from "../../web-utils/ContentEditableEditorMetaData";
import { TitleTooltipView } from "../../component/titletooltip/TitleTooltipView";
export type Logger = typeof RootLogger;
require("../../web-utils/PfScroll");
require("../../web-utils/PfScrollExperimental");
require("../../web-utils/JQueryExt");

export function WindowView(constructor: any) {
    //Empty decorator it only mark WindowView to be registered
}
export class BaseWindowView<M, C = any> extends ComponentView {
    
    helper: MailClientViewHelper;
    templateFunc: webUtils.MailTemplateDefinition<M, C>;
    mainTemplate: webUtils.MailTemplate<M, C>
    $html: JQuery;
    $body: JQuery;
    $main: JQuery;
    $statusBar: JQuery;
    statusBar: StatusBarView;
    windowFocusable: boolean;
    msgBox: MsgBoxViewService;
    fontMetrics: FontMetricsView;
    onErrorCallback: (e: any) => void;
    logErrorCallback: (e: any) => void;
    onWindowResizeBound: () => void;
    clearCacheTimer: any = null;
    timeAgoRefresherTimer: any = null;
    unreadBadgeClickAction: string = null;
    unreadBadgeUseDoubleClick: boolean = null;
    clipboardIntegration: "ask"|"enabled"|"disabled" = "enabled";
    taskPickerResultHandler: (taskId: string) => void = null;
    filePickerResultHandler: (data: FilePickerData) => void = null;
    titleTooltip: TitleTooltipView;
    
    constructor(parent: app.ViewParent, template: webUtils.MailTemplateDefinition<M, C>, i18nPrefix?: string) {
        super(parent);
        (<any>document).privMxView = this;
        PerformanceLogger.log("openingWindows.BaseWindowView.constructor().start", this.className);
        this.templateFunc = template;
        this.mainTemplate = this.templateManager.createTemplate(this.templateFunc);
        this.helper = this.templateManager.getHelperByClass(MailClientViewHelper);
        this.statusBar = this.addComponent("statusBar", new StatusBarView(this, i18nPrefix));
        this.msgBox = new MsgBoxViewService(this.getControllerId(), this.parent.viewManager.getService("msgBoxService"));
        this.onErrorCallback = this.onError.bind(this);
        this.logErrorCallback = this.logError.bind(this);
        (<any>window).privmx_i18n = this.helper.i18n.bind(this.helper);
        if (this.parent.viewManager.preventLinkOpenage) {
            $("body").on("click", "a[href]", event => {
                if (!event.originalEvent.defaultPrevented) {
                    event.preventDefault();
                    this.triggerEventInTheSameTick("openUrl", $(event.target).closest("a").attr("href"));
                    return false;
                }
            });
        }
        $("body").on("mouseenter", "[title]", e => {
            let $el = $(e.currentTarget) as JQuery;
            $el.attr("data-title-id", $el.attr("title"));
            $el.addClass("has-title-tooltip");
            $el.removeAttr("title");
            setTimeout(() => {
                $el.trigger(e);
            }, 15);
        });
        this.catchUnhandledErrors();
        window.addEventListener("keydown", e => {
            if (e.key == "f" && WebUtils.hasCtrlModifier(e)) {
                e.preventDefault();
                e.cancelBubble = true;
                this.triggerEvent("toggleSearch");
            }
            else if ((e.keyCode == KEY_CODES.dash || e.keyCode == KEY_CODES.subtract) && WebUtils.hasCtrlModifier(e)) {
                this.triggerEvent("zoomOut");
            }
            else if ((e.keyCode == KEY_CODES.equalSign || e.keyCode == KEY_CODES.add) && WebUtils.hasCtrlModifier(e)) {
                this.triggerEvent("zoomIn");
            }
            else if ((e.keyCode == KEY_CODES.numpad0 || e.keyCode == KEY_CODES.key0) && WebUtils.hasCtrlModifier(e)) {
                this.triggerEvent("resetZoom");
            }
        });
        this.onWindowResizeBound = () => {
            this.updateScreenCoverPanelZoom();
            this.updateNoConnectionScreenCoverPanelZoom();
        };
        PerformanceLogger.log("openingWindows.BaseWindowView.constructor().end", this.className);
        this.fontMetrics = new FontMetricsView();
        this.titleTooltip = this.addComponent("titleTooltip", new  TitleTooltipView(this));
        this.handleCopyPaste();
        this.bindDevConsoleShortcut();
    }


    getControllerId(): number {
        return this.parent.viewManager.controllerId;
    }
    
    getLogger(): Logger {
        return RootLogger.get(this.className);
    }
    
    prepareErrorMessage(e: any): string {
        //TODO use prepareErrorMessage from ErrorLog
        //TODO and use ErrorLog for everything
        if (!e) {
            return this.i18n("core.error.unknwon");
        }
        let error = {
            code: 0,
            message: ""
        };
        if (e.errorObject) {
            error.code = e.errorObject.code;
            error.message = e.errorObject.message;
        }
        else if (e.data && e.data.error) {
            error.code = e.data.error.code;
            error.message = e.data.error.message || e.msg;
        }
        else {
            error.code = e.code || 0x5001;
            error.message = e.message || e.msg || e || "";
        }
        return this.i18n("core.error", [error.code, error.message]);
    }
    
    onError(e: any): Q.Promise<MsgBoxResult> {
        this.logError(e);
        return this.msgBox.alert(this.prepareErrorMessage(e));
    }
    
    logError(e: any) {
        this.getLogger().error(e, e == null ? null : e.stack);
    }
    
    reportUnhandledError(m:string, l:number, s:any, c:any, e:any) {
        this.triggerEvent("reportUnhandledError", m,l,s,c,e);
    }
    
    suppressUnhandledError(m:string, l:number, s:any, c:any, e:any) {
        // do nothing
    }
    
    suppressErrors() {
        window.onerror = this.suppressUnhandledError.bind(this);
    }
    
    catchUnhandledErrors() {
        window.onerror = this.reportUnhandledError.bind(this);
    }
    
    pauseTimeAgoRefresher() {
        this.turnTimeAgoRefresherOff();
    }
    
    resumeTimeAgoRefresher() {
        this.turnTimeAgoRefresher();
    }
    
    turnTimeAgoRefresherOff(): void {
        clearInterval(this.timeAgoRefresherTimer);
        this.timeAgoRefresherTimer = null;
    }
    
    turnTimeAgoRefresher(interval?: number) {
        clearInterval(this.timeAgoRefresherTimer);
        this.timeAgoRefresherTimer = setInterval(() => {
            this.$main.find("[data-timeago]").each((i, e) => {
                let $e = $(e);
                let date = $e.data("timeago");
                let type = $e.data("timeago-type");
                if (type == "calendarDate") {
                    $e.text(this.helper.calendarDate(date));
                }
                else {
                    $e.text(this.helper.timeAgo(date));
                }
            });
        }, interval || 60 * 1000);
    }
    
    initCore(model: M): Q.Promise<void> {
        PerformanceLogger.log("openingWindows.BaseWindowView.initCore().start", this.className);
        return Q().then(() => {
            this.$html = $("html");
            this.$body = $("body");
            this.render(model);
            this.$statusBar = this.$main.find(".status-bar");
            this.bindBodyClick();
            this.$body.on("keydown", this.onBodyKeydown.bind(this));
            this.$body.on("click", "a.linkified", this.onLinkifiedClick.bind(this));
            UI.preventBackspace();
            if (this.helper.isContextMenuBlocked()) {
                this.$body.on("contextmenu", BaseWindowView.preventEvent);
            }
            this.$body.on("contextmenu", this.openContextMenu.bind(this));
            this.$body.on("click", ".file-label.link[data-meta-data]", this.onFileLinkWithMetaDataClick.bind(this));
            let $screenCover = this.$body.find("#screen-cover");
            if ($screenCover.length > 0) {
                $screenCover.find("img").attr("src", this.helper.getAssetByName("CUSTOM_LOGO_127X112"));
                $screenCover.find(".text").text(this.helper.i18n("index.screenCover.text"));
                $screenCover.on("click", () => {
                    this.triggerEvent("screenCoverClick");
                });
            }
            
            let $noConnectionScreenCover = this.$body.find("#no-connection-screen-cover");
            if ($noConnectionScreenCover.length > 0) {
                $noConnectionScreenCover.find("img").attr("src", this.helper.getAssetByName("CUSTOM_LOGO_127X112"));
                $noConnectionScreenCover.find(".text-inner").text(this.helper.i18n("index.screenCover.reconnecting"));
            }


            this.listenOnUIEvents(this.helper.getUIEventsListener());
            if (this.$statusBar.length) {
                this.statusBar.$container = this.$statusBar;
                return this.statusBar.triggerInit();
            }
        })
        .then(() => {
            this.titleTooltip.$container = this.$body;
            return this.titleTooltip.triggerInit();
        })
        .then(() => {
            PerformanceLogger.log("openingWindows.BaseWindowView.initCore().end", this.className);
            return;
        });
    }
    
    onLinkifiedClick(e: JQuery.Event) {
        if (this.helper.openLinksByController() && !e.originalEvent.defaultPrevented) {
            e.preventDefault();
            let $a = $(e.target).closest("a");
            this.triggerEventInTheSameTick("openUrl", $a.attr("href"));
            return false;
        }
    }
    
    init(model: M): Q.Promise<void> {
        PerformanceLogger.log("openingWindows.BaseWindowView.init().start", this.className);
        return this.initCore(model).then(() => {
            return this.initWindow(model);
        })
        .then(() => {
            PerformanceLogger.log("openingWindows.BaseWindowView.init().end", this.className);
            return;
        });
    }
    
    initWindow(model: M): Q.IWhenable<void> {
    }
    
    render(model: M): void {
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$body.append(this.$main);
    }
    
    listenOnUIEvents(listener: () => void): void {
        if (listener === null) {
            let enableEventThrottling = true;
            let eventThrottlingMsecs = 250;
            
            let lastEvent: number = performance.now();
            listener = () => {
                if (enableEventThrottling) {
                    let now = performance.now();
                    if (now < lastEvent + eventThrottlingMsecs) {
                        return;
                    }
                    lastEvent = now;
                }
                this.triggerEvent("UIEvent");
            };
        }
        if (typeof(listener) == "function") {
            let body = this.$body[0];
            body.addEventListener("contextmenu", listener, true);
            body.addEventListener("mousedown", listener, true);
            body.addEventListener("mouseup", listener, true);
            body.addEventListener("mousemove", listener, true);
            body.addEventListener("keydown", listener, true);
            body.addEventListener("keyup", listener, true);
        }
    }
    
    openContextMenu(e: Event): void {
        if (BaseWindowView.preventEvent(e)) {
            this.triggerEvent("openContextMenu");
        }
    }
    
    onBodyKeydown(event: KeyboardEvent): void {
        if (event.which == 122) {
            this.triggerEvent("toggleDevTools");
        }
        if (event.ctrlKey && event.which == KEY_CODES.key8) {
            this.triggerEvent("shareSection");
        }
    }
    
    static preventEvent(e:Event): boolean {
        // allow right-click events on inputs and textareas only
        return $(e.target).is("input") || $(e.target).is("textarea") || $(e.target).attr("contenteditable") === "true";
    }
    
    makeCustomScroll($elem: JQuery): void {
        $elem.pfScroll();
    }
    destroyScroll($elem: JQuery): void {
        $elem.pfScroll().destroy();
    }
    
    focusWindow() {
        this.triggerEvent("focus");
    }
    
    bindBodyClick(): void {
        this.$body[0].addEventListener("click", event => {
            if (this.windowFocusable !== false && !$(event.target).is("select") && $(event.target).closest("[data-window-opener]").length == 0) {
                this.triggerEvent("focus");
            }
        }, true);
    }
    
    isDetachedIframe(): boolean {
        return window == null || (window.parent != window && window.parent == null);
    }
    
    i18n(key: string, ...args: any[]): string {
        return this.helper.i18n.apply(this.helper, arguments);
    }
    
    triggerJQEvent(name: string): void {
        $("body").trigger(name);
    }
    
    refreshWindowHeight() {
        $("html").css("overflow", "hidden");
        this.triggerEventInTheSameTick("setWindowHeight", Math.ceil($("body").outerHeight()));
    }
    
    bindTabSwitch(): void {
        this.$body[0].addEventListener("keydown", event => {
            if (event.keyCode == 9) {
                event.stopPropagation();
                event.preventDefault();
                this.triggerEvent("tabSwitch", event.shiftKey, event.ctrlKey);
            }
        }, true);
    }

    bindEnterPressed(): void {
        this.$body[0].addEventListener("keydown", event => {
            if (event.keyCode == 13) {
                event.stopPropagation();
                event.preventDefault();
                this.triggerEvent("enterPressed", event.shiftKey, event.ctrlKey);
            }
        }, true);
    }

    
    focusDocked(id: number) {
        let iframe = <HTMLIFrameElement>this.$main.find(".iframe-container#iframe-" + id + " iframe")[0];
        if (iframe) {
            iframe.contentWindow.focus();
        }
    }
    
    print(): void {
        window.print();
        this.triggerEvent("printed");
    }
    
    saveAsPdf(): void {
        this.triggerEvent("savedAsPdf");
    }
    
    autoIframeHeight() {
        (<HTMLIFrameElement>frameElement).style.height = document.documentElement.scrollHeight + "px";
        setTimeout(() => {
            (<HTMLIFrameElement>frameElement).style.height = document.documentElement.scrollHeight + "px";
        }, 500);
    }
    
    setCustomizedTheme(themeStr: string) {
        let theme: CustomizationData = JSON.parse(themeStr);
        for (let varName in theme.cssVariables) {
            document.documentElement.style.setProperty(varName, theme.cssVariables[varName]);
        }
        let src = theme.logoHeader ? theme.logoHeader : this.helper.getAssetByName("CUSTOM_LOGO_87X22");
        this.$html.find(".logo-87x22-container:not(.wh)").find("img").attr("src", src);
        src = theme.logoHeaderWh ? theme.logoHeaderWh : this.helper.getAssetByName("CUSTOM_LOGO_87X22_WH");
        this.$html.find(".logo-87x22-container.wh").find("img").attr("src", src);
        src = theme.logoLoginScreen ? theme.logoLoginScreen : this.helper.getAssetByName("CUSTOM_LOGO_127X112");
        this.$html.find(".logo-127x112-container").find("img").attr("src", src);
    }
    
    triggerSpellCheckerUpdate(): void {
        let sel = document.getSelection();
        let act = <HTMLElement>document.activeElement;
        let ranges: Range[] = [];
        if (sel) {
            for (let i = 0; i < sel.rangeCount; ++i) {
                ranges.push(sel.getRangeAt(i).cloneRange());
            }
            sel.removeAllRanges();
        }
        $("textarea, [contenteditable='true']").each((_, el) => {
            el.blur();
            el.focus();
            let ce: ContentEditableEditor = null;
            if ($(el).is("[contenteditable='true']")) {
                ce = $(el).data("contentEditableEditor");
            }
            if (ce) {
                ce.changesManager.isFrozen = true;
            }
            document.execCommand("insertHTML", false, " ");
            document.execCommand("delete", false);
            if (ce) {
                ce.changesManager.isFrozen = false;
            }
        });
        sel = document.getSelection();
        if (sel && act && act.focus) {
            act.focus();
            sel.removeAllRanges();
            for (let range of ranges) {
                sel.addRange(range);
            }
        }
    }
    
    toggleScreenCover(show: boolean): void {
        this.$body.toggleClass("with-screen-cover", show);
        if (show) {
            this.updateScreenCoverPanelZoom();
            window.addEventListener("resize", this.onWindowResizeBound);
        }
        else {
            window.removeEventListener("resize", this.onWindowResizeBound);
        }
    }

    toggleNoConnectionScreenCover(show: boolean): void {
        this.$body.toggleClass("with-no-connection-screen-cover", show);
        if (show) {
            this.updateNoConnectionScreenCoverPanelZoom();
            window.addEventListener("resize", this.onWindowResizeBound);
        }
        else {
            window.removeEventListener("resize", this.onWindowResizeBound);
        }
    }

    updateConnectionScreenCoverStatus(status: string): void {
        let $noConnectionScreenCover = this.$body.find("#no-connection-screen-cover");
        if ($noConnectionScreenCover.length > 0) {
            if (status == "reloginFailed") {
                $noConnectionScreenCover.find(".text-inner").text(this.helper.i18n("index.screenCover.status." + status, 3));
            }
            else {
                $noConnectionScreenCover.find(".text-inner").text(this.helper.i18n("index.screenCover.status." + status));
            }
        }
    }
    
    resetConnectionScreenCoverStatus(): void {
        let $noConnectionScreenCover = this.$body.find("#no-connection-screen-cover");
        if ($noConnectionScreenCover.length > 0) {
            $noConnectionScreenCover.find(".text-inner").text(this.helper.i18n("index.screenCover.reconnecting"));
        }
    }

    updateScreenCoverPanelZoom(): void {
        let zoomWidth = Math.min(1.0, Math.max(0, window.innerWidth / 300));
        let zoomHeight = Math.min(1.0, Math.max(0, window.innerHeight / 250));
        let zoom = Math.min(zoomWidth, zoomHeight);
        this.$body.find(".cover-panel").css("zoom", zoom);
    }

    updateNoConnectionScreenCoverPanelZoom(): void {
        let zoomWidth = Math.min(1.0, Math.max(0, window.innerWidth / 300));
        let zoomHeight = Math.min(1.0, Math.max(0, window.innerHeight / 250));
        let zoom = Math.min(zoomWidth, zoomHeight);
        this.$body.find(".no-connection-cover-panel").css("zoom", zoom);
    }
    
    measureCharacters(charsStr: string): string {
        return this.fontMetrics.onControllerMeasureCharacters(charsStr);
    }
    
    getAllowBreakAfterChars(): string {
        return this.fontMetrics.getAllowBreakAfterChars();
    }
    
    elementEllipsis($el: JQuery, text: string = null, reverse: boolean = false, margin: number = 15): void {
        let fontMetrics: FontMetricsView = $el.data("fontmetrics");
        if (!fontMetrics) {
            fontMetrics = new FontMetricsView();
            fontMetrics.setFont({
                family: FontMetricsView.FONT_FAMILY,
                sizePx: 12,
                weight: FontMetricsView.FONT_WEIGHT_BOLD,
            });
            $el.data("fontmetrics", fontMetrics);
        }
        $el.css("display", "block");
        $el.css("font-kerning", "none");
        $el.data("text", text);
        let fn = () => {
            let text = $el.data("text");
            if (text === null ){
                return;
            }
            if (reverse) {
                text = text.split("").reverse().join("");
            }
            fontMetrics.add(text);
            fontMetrics.measure();
            let l = fontMetrics.getMaxTextLength(text, $el.innerWidth() - margin, false);
            text = (l < text.length ? "..." : "") + (reverse ? text.substr(0, l).split("").reverse().join("") : text.substr(0, l));
            $el.text(text);
        };
        
        if (text !== null) {
            fn();
        }
        
        if ($el.data("element-ellipsis-initialized")) {
            return;
        }
        
        if ((<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver((e: any) => {
                fn();
            });
            try {
                resizeObserver.observe($el[0]);
            } catch (e) {}
        }
        
        $el.data("element-ellipsis-initialized", true);
    }
    
    updateTaskBadges(taskId: string, taskLabelClass: string): void {
        this.$body.find(".task-label[data-task-id='" + taskId + "']").each((_, el) => {
            let $el = $(el);
            let autoUpdate = $el.data("task-badge-autoupdate");
            if (autoUpdate === undefined || autoUpdate) {
                let classes = el.classList;
                let classesToRemove: string[] = [];
                for (let i = 0; i < classes.length; ++i) {
                    if (classes[i].substr(0, 12) == "task-status-") {
                        classesToRemove.push(classes[i]);
                    }
                }
                for (let cls of classesToRemove) {
                    $el.removeClass(cls);
                }
                $el.addClass(taskLabelClass);
            }
        })
    }
    
    toMBString(bytes: number): string {
        return (bytes / (1000.0 * 1000)).toFixed(2) + " MB";
    }
    
    getResourcesMemUsage(): void {
        const web = (<any>window).electronRequire("electron").webFrame;
        setTimeout(() => {
            this.getResourcesMemUsage();
        }, 10000);
        console.log("getting mem usage..");
        let usageObj = web.getResourceUsage();
        console.log("after..");
        console.log("css", this.toMBString(web.getResourceUsage().cssStyleSheets.size));
        console.log("fonts", this.toMBString(usageObj.fonts.size));
        console.log("images", this.toMBString(usageObj.images.size));
        console.log("scripts", this.toMBString(usageObj.scripts.size));
        console.log("xlsScripts", this.toMBString(usageObj.xslStyleSheets.size));
        console.log("other", this.toMBString(usageObj.other.size));
    }

    clearCache(): void {
        if (this.clearCacheTimer) {
            clearTimeout(this.clearCacheTimer);
        }
        this.clearCacheTimer = setTimeout(() => {
            this.clearCache();
        }, 600000);
        const web = (<any>window).electronRequire("electron").webFrame;
        web.clearCache();
        let frame = web.getFrameForSelector("iframe");
        frame.clearCache();
    }
    
    setUnreadBadgeClickAction(unreadBadgeClickAction: string): void {
        this.unreadBadgeClickAction = unreadBadgeClickAction;
        this.$body.attr("data-unread-badge-click-action", unreadBadgeClickAction);
    }
    
    setUnreadBadgeUseDoubleClick(unreadBadgeUseDoubleClick: boolean): void {
        this.unreadBadgeUseDoubleClick = unreadBadgeUseDoubleClick;
        this.$body.attr("data-unread-badge-use-double-click", "" + unreadBadgeUseDoubleClick);
    }
    
    bindDevConsoleShortcut(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == 192 && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.triggerEvent("openDevConsole");
            }
        });
    }

    handleCopyPaste(): void {
        if (this.isElectron()) {
            $(document).on("keydown", this.copyPasteKeydownHandler.bind(this));
        }
    }

    
    copyPasteKeydownHandler(e: KeyboardEvent): void {
        if (this.clipboardIntegration == "enabled" && (e.ctrlKey || e.metaKey) && (e.keyCode == KEY_CODES.c || e.keyCode == KEY_CODES.x)) {
            this.copyOrCut(false, false);
            return;
        }
        let handled = false;
        if (e.ctrlKey || e.metaKey) {
            if (e.keyCode == KEY_CODES.v) {
                handled = true;
                this.paste(false);
            }
            else if (e.keyCode == KEY_CODES.c || e.keyCode == KEY_CODES.x) {
                handled = true;
                this.copyOrCut(false, e.keyCode == KEY_CODES.x);
            }
        }
        if (handled) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }
    
    copy(dig: boolean): void {
        this.copyOrCut(dig, false);
    }
    
    cut(dig: boolean): void {
        this.copyOrCut(dig, true);
    }
    
    copyOrCut(dig: boolean, cut: boolean): void {
        if (dig && document.activeElement && document.activeElement.tagName.toLowerCase() == "iframe") {
            let iframe = (<HTMLIFrameElement>document.activeElement);
            if (iframe && iframe.contentDocument && (<any>iframe.contentDocument).privMxView) {
                (<any>iframe.contentDocument).privMxView.copyOrCut(dig, cut);
            }
            return;
        }
        let selection = this.copySelection(cut);
        if (selection && selection.text && selection.text.length > 0) {
            delete selection.$parent;
            this.triggerEvent("customCopy", JSON.stringify(selection));
            setTimeout(() => {
                this.triggerEvent("customCopy", JSON.stringify(selection));
            }, 100);
        }
    }
    
    paste(dig: boolean): void {
        if (dig && document.activeElement && document.activeElement.tagName.toLowerCase() == "iframe") {
            let iframe = (<HTMLIFrameElement>document.activeElement);
            if (iframe && iframe.contentDocument && (<any>iframe.contentDocument).privMxView) {
                (<any>iframe.contentDocument).privMxView.paste(true);
            }
            return;
        }
        let onlyPlainText = false;
        let activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName.toLowerCase() == "textarea" || activeElement.tagName.toLowerCase() == "input")) {
            onlyPlainText = true;
        }
        this.triggerEvent("customPaste", onlyPlainText);
    }
    
    isElectron(): boolean {
        return document.body.classList.contains("electron");
    }
    
    setClipboardIntegration(integration: "ask"|"disabled"|"enabled"): void {
        this.clipboardIntegration = integration;
    }
    
    copySelection(cut: boolean): { text: string, html: string, $parent: JQuery } {
        let sel = document.getSelection();
        if (!sel) {
            return null;
        }
        let activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName.toLowerCase() == "textarea" || activeElement.tagName.toLowerCase() == "input")) {
            let str = sel.toString();
            if (cut) {
                document.execCommand("insertHTML", false, "");
            }
            return {
                text: str,
                html: undefined,
                $parent: <JQuery>$(activeElement),
            };
        }
        if (sel.rangeCount == 0) {
            return null;
        }
        let rng = sel.getRangeAt(0);
        if (!rng) {
            return null;
        }
        let $tmp = this.cloneRangeContents(rng);
        let commonAncestorContainer = rng.commonAncestorContainer;
        if ((commonAncestorContainer instanceof HTMLElement) && commonAncestorContainer.classList.contains("selectable")) {
            $tmp.addClass("selectable");
        }
        this.recursiveRemoveNonSelectable($tmp);
        let $selectionParent: JQuery = rng.startContainer == rng.endContainer ? <JQuery>$(rng.startContainer) : <JQuery>$(rng.startContainer).parents().has(<Element>rng.endContainer).first();
        if (cut) {
            let $cont = $(rng.startContainer);
            if ($cont.closest("[contenteditable=true]").length > 0) {
                rng.deleteContents();
                let $ce = <JQuery>$(activeElement).closest("[contenteditable]");
                if ($ce && $ce.data("contentEditableEditor")) {
                    let ce: ContentEditableEditor = $ce.data("contentEditableEditor");
                    if (ce.options && ce.options.onChange) {
                        ce.options.onChange();
                    }
                }
            }
            if (activeElement && $(activeElement).is("[contenteditable]") && activeElement.textContent == "" && activeElement.innerHTML.replace(/<[^>]+>/g, "") == "") {
                activeElement.innerHTML = ""; // Chromium hack: fixes huge cursor bug
            }
        }
        let $tmp2 = $tmp.clone();
        if (
            ! $selectionParent.hasClass("selectable")
            && !($selectionParent.attr("contenteditable") == "true")
            && !($selectionParent instanceof HTMLInputElement)
            && !($selectionParent instanceof HTMLTextAreaElement)
        ) {
            $tmp2 = this.pickSelectableOnly($tmp2);
        }
        this.recursiveReplaceBrs($tmp2[0]);
        let ret = {
            text: $tmp2.text(),
            html: ContentEditableEditor.PRIVMX_COPIED_HTML_PREFIX + $tmp2.html(),
            $parent: $selectionParent,
        };
        return ret;
    }
    
    pickSelectableOnly($el: JQuery): JQuery {
        let copied: string[] = [];
        if ($el.children().length == 0 || $el.hasClass("selectable")) {
            copied = this.addTextToCopied(copied, $el[0]);
        }
        else {
            $el.find(".selectable").each((i, child) => {
                copied = this.addTextToCopied(copied, child);
            })
        }
        return this.mergeCopiedContents(copied);
    }

    addTextToCopied(copied: string[], el: HTMLElement): string[] {
        let ret = copied;
        ret.push(el.innerHTML);
        if (el instanceof HTMLDivElement || el instanceof HTMLParagraphElement) {
            if ($(el).css("display").indexOf("inline") == -1 ) {
                ret.push("\n");
            }
        }
        else
        if (el instanceof HTMLBRElement) {
            ret.push("\n");
        }
        return ret;
    }

    mergeCopiedContents(copied: string[]): JQuery {
        let toMerge = this.removeNewLineFromCopiedIfAtEnd(copied);
        let $ret = $("<div>"+toMerge.join("")+"</div>");
        return $ret;
    }

    removeNewLineFromCopiedIfAtEnd(copied: string[]): string [] {
        if (copied[copied.length-1] == "\n") {
            return copied.slice(0, -1);
        }
        return copied;
    }

    cloneRangeContents(rng: Range): JQuery {
        // // Fix range endpoint
        // rng = rng.cloneRange();
        // if (rng.endOffset == 0) {
        //     console.log(rng.startContainer, rng.endContainer, rng.startOffset, rng.endOffset, rng.cloneContents(), rng.toString())
        // }
        
        // Clone contents and create JQuery element
        return $("<div></div>").append(rng.cloneContents());
    }
    
    customPaste(dataStr: string): void {
        let data = JSON.parse(dataStr);
        let activeElement = document.activeElement;
        
        let $ce = <JQuery>$(activeElement).closest("[contenteditable]");
        if ($ce && $ce.data("contentEditableEditor")) {
            let ce: ContentEditableEditor = $ce.data("contentEditableEditor");
            if (!ce.options || !ce.options.onPaste) {
                ce.onPaste(null, data, $ce);
                return;
            }
        }
        
        let forceText = activeElement && (activeElement.tagName.toLowerCase() == "textarea" || activeElement.tagName.toLowerCase() == "input");
        if (data.html && !forceText) {
            ContentEditableEditor.stripHtml(data.html)
            .then(html => {
                document.execCommand("insertHTML", false, html);
            });
        }
        else if (data.text) {
            document.execCommand("insertHTML", false, this.helper.escapeHtml(data.text));
        }
    }
    
    recursiveRemoveNonSelectable($el: JQuery): void {
        if ($el.css("user-select") == "none") {
            $el.remove();
        }
        else {
            $el.children().each((_, childEl) => {
                this.recursiveRemoveNonSelectable($(childEl));
            });
        }
    }
    
    recursiveReplaceBrs(el: Node): void {
        for (let i = 0; i < el.childNodes.length; ++i) {
            let child = el.childNodes[i];
            if (child instanceof HTMLBRElement) {
                el.replaceChild(new Text("\n"), child);
            }
            if (child.hasChildNodes()) {
                this.recursiveReplaceBrs(child);
            }
        }
    }
    
    onRequestTaskPicker(currentTaskId: string, relatedHostHash: string, relatedSectionId: string, disableCreatingTasks: boolean): void {
        this.triggerEvent("requestTaskPicker", currentTaskId, relatedHostHash, relatedSectionId, disableCreatingTasks);
    }
    
    onRequestFilePicker(currentFileId: string, relatedHostHash: string, relatedSectionId: string): void {
        this.triggerEvent("requestFilePicker", currentFileId, relatedHostHash, relatedSectionId);
    }
    
    onTaskPickerResult(taskPickerResultHandler: (taskId: string) => void): void {
        this.taskPickerResultHandler = taskPickerResultHandler;
    }
    
    onFilePickerResult(filePickerResultHandler: (data: FilePickerData) => void): void {
        this.filePickerResultHandler = filePickerResultHandler;
    }
    
    taskPickerResult(taskId: string): void {
        if (this.taskPickerResultHandler) {
            this.taskPickerResultHandler(taskId);
        }
    }
    
    filePickerResult(dataStr: string): void {
        if (this.filePickerResultHandler) {
            this.filePickerResultHandler(JSON.parse(dataStr));
        }
    }
    
    setTaskPickerEnabled(isEnabled: boolean): void {
        $(document.body).attr("data-auto-task-picker", isEnabled ? "true" : "false");
    }
    
    setFilePickerEnabled(isEnabled: boolean): void {
        $(document.body).attr("data-auto-file-picker", isEnabled ? "true" : "false");
    }
    
    onFileLinkWithMetaDataClick(e: MouseEvent): void {
        let metaDataStr = $(e.currentTarget).data("meta-data");
        if (!metaDataStr) {
            return;
        }
        this.triggerEvent("openFileFromMetaData", ContentEditableEditor.base64ToUtf8(metaDataStr));
    }
    
    async getMediaDevices(types: { videoInput?: boolean, audioInput?: boolean, audioOutput?: boolean }, showDeviceSelector: boolean) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const defaultVideoInputDevice = devices.filter(device => device.kind == "videoinput")[0];
        const defaultAudioInputDevice = devices.filter(device => device.kind == "audioinput")[0];
        const defaultAudioOutputDevice = devices.filter(device => device.kind == "audiooutput")[0];
        const defaultVideoInput = defaultVideoInputDevice ? defaultVideoInputDevice.deviceId : null;
        const defaultAudioInput = defaultAudioInputDevice ? defaultAudioInputDevice.deviceId : null;
        const defaultAudioOutput = defaultAudioOutputDevice ? defaultAudioOutputDevice.deviceId : null;
        
        let resultStr = await this.channelPromise<string>("getMediaDevicesStr", types, showDeviceSelector);
        let result = JSON.parse(resultStr);
        let mediaDevices = result.selectedDevices;
        let rawResult = result.rawResult;
        mediaDevices.videoInput = mediaDevices.videoInput || defaultVideoInput;
        mediaDevices.audioInput = mediaDevices.audioInput || defaultAudioInput;
        mediaDevices.audioOutput = mediaDevices.audioOutput || defaultAudioOutput;
        
        let ret: {
            videoInput?: string | null;
            audioInput?: string | null;
            audioOutput?: string | null;
            rawResult?: {
                selected: boolean;
                videoInput?: string | false | null;
                audioInput?: string | false | null;
                audioOutput?: string | false | null;
            };
        } = {
            ...mediaDevices,
            rawResult,
        };
        return ret;
    }
    
    updateUserCustomSuccessColor(customSuccessColor: string | null): void {
        if (!customSuccessColor) {
            customSuccessColor = "default";
        }
        let style = document.querySelector("style#customSuccessColorStyle") as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement("style");
            style.setAttribute("id", "customSuccessColorStyle");
            document.head.appendChild(style);
        }
        const str = customSuccessColor.substr(5, customSuccessColor.length - 6);
        const [h, s, l, a] = str.split(",");
        style.innerHTML = customSuccessColor == "default" ? "" : `:root {
            --color-success-h: ${h};
            --color-success-s: ${s};
            --color-success-l: ${l};
            --color-success-a: ${a};
        }`;
    }
    
}
