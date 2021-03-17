import {component, window as wnd, JQuery as $, Q, Types, webUtils} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as sectionTemplate} from "./template/section.html";
import {ViewModel} from "./AppsWindowController";
import {SectionModel} from "./AppsWindowController";

export class AppsWindowView extends wnd.base.BaseAppWindowView<ViewModel> {
    
    static readonly SINGLE_CLICK_DELAY: number = 300;
    static readonly MIN_TIME_BETWEEN_LOADING_SPINNERS_REMOVAL: number = 300;
    
    userGuide: component.userguide.UserGuideView;
    sectionList: component.extlist.ExtListView<SectionModel>;
    static MAX_SECTIONS_CONTAINER_HEIGHT: number = 240;
    resizeDebounceTimer: any;
    userGuideVisible: boolean = false;
    loadedModules: {[id: string]: boolean} = {};
    scheduledModules: {[id: string]: boolean} = {};
    $loadingUnread: JQuery;
    basicTooltip: component.tooltip.TooltipView;
    protected _delayedClickTimeout: number = null;
    protected _nextSpinnerRemoval: Q.Promise<void> = Q();

    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        
        this.loadedModules["chat"] = false;
        this.loadedModules["notes2"] = false;
        this.loadedModules["tasks"] = false;
        this.loadedModules["calendar"] = false;
        
        const visibilityObserver = new (webUtils as any).VisibilityObserver(document.body);
        let visibilityObserverSingleShotRegistered: boolean = false;
        
        this.sectionList = this.addComponent("sectionList", new component.extlist.ExtListView(this, {
            template: sectionTemplate,
            onAfterListRender: () => {
                // let sectionsHeight = this.$main.find(".sections-inner").outerHeight();
                // this.$main.find(".sections").css("height", sectionsHeight > AppsWindowView.MAX_SECTIONS_CONTAINER_HEIGHT ? AppsWindowView.MAX_SECTIONS_CONTAINER_HEIGHT + "px" : sectionsHeight + "px");
                
                if (visibilityObserver.isTargetVisible) {
                    this.updateSplitSectionsNames();
                }
                else if (!visibilityObserverSingleShotRegistered) {
                    visibilityObserver.addSingleShotCallback((visible: boolean) => {
                        visibilityObserverSingleShotRegistered = false;
                        if (visible) {
                            this.updateSplitSectionsNames();
                        }
                    });
                    visibilityObserverSingleShotRegistered = true;
                    return;
                }
            }
        }));
        this.basicTooltip = this.addComponent("basicTooltip", new component.tooltip.TooltipView(this));
    }
    
    initWindow(model: ViewModel): Q.Promise<void> {
        $(window).on("resize", this.onResizeWindow.bind(this));
        this.$main.on("click", "[data-trigger]", this.onTriggerClick.bind(this));
        this.$main.on("click", "[data-section-id]", this.onSectionClick.bind(this));
        this.makeCustomScroll(this.$main.find(".sections"));
        this.sectionList.$container = this.$main.find(".sections-inner");
        this.$main.find(".sections").css("height", AppsWindowView.MAX_SECTIONS_CONTAINER_HEIGHT + "px");
        this.$loadingUnread = this.$main.find(".loading-unread-counts");
        
        let $launchers = this.$main.find(".launchers");
        $launchers.on("click", ".number.badge", this.onBadgeClick.bind(this));
        $launchers.on("dblclick", ".number.badge", this.onBadgeDoubleClick.bind(this));
        $launchers.on("mouseenter", ".number.badge", this.onBadgeMouseEnter.bind(this));
        $launchers.on("mouseleave", ".number.badge", this.onBadgeMouseLeave.bind(this));
        
        if (model.chatFullyLoaded) {
            this.setAppWindowBadgeFullyLoaded("chat", true);
        }
        else {
            this.updateSpinners(null, "chat", true);
        }
        if (model.notes2FullyLoaded) {
            this.setAppWindowBadgeFullyLoaded("notes2", true);
        }
        else {
            this.updateSpinners(null, "notes2", true);
        }
        if (model.tasksFullyLoaded) {
            this.setAppWindowBadgeFullyLoaded("tasks", true);
        }
        else {
            this.updateSpinners(null, "tasks", true);
        }
        if (model.calendarFullyLoaded) {
            this.setAppWindowBadgeFullyLoaded("calendar", true);
        }
        else {
            this.updateSpinners(null, "calendar", true);
        }

        return this.sectionList.triggerInit()
        .then(() => {
            this.basicTooltip.$container = this.$main;
            this.basicTooltip.isEnabled = (e: MouseEvent) => {
                let unreadBadgeClickAction = $(document.body).attr("data-unread-badge-click-action");
                return unreadBadgeClickAction != "ignore";
            };
            return this.basicTooltip.triggerInit();
        });
    }
    
    onTriggerClick(event: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let $e = $(event.currentTarget);
        let action = $e.data("trigger");
        if (action == "launch-app-window") {
            let unreadBadgeClickAction = this.$body.attr("data-unread-badge-click-action");
            let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
            if (unreadBadgeClickAction == "ignore" || $(event.target).closest(".number.badge").length == 0) {
                this.triggerEvent("appWindowOpen", $e.data("app-window"));
            }
            else {
                if (unreadBadgeUseDoubleClick) {
                    this._delayedClickTimeout = <any>setTimeout(() => {
                        this.triggerEvent("appWindowOpen", $e.data("app-window"));
                    }, AppsWindowView.SINGLE_CLICK_DELAY);
                }
            }
        }
        else {
            this.navBar.triggerCustomAction(action, event);
        }
    }
    

    onSectionClick(event: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let $e = $(event.target).closest("[data-section-id]");
        let unreadBadgeClickAction = this.$body.attr("data-unread-badge-click-action");
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeClickAction != "ignore" && $(event.target).closest(".number.badge").length > 0) {
            if (unreadBadgeUseDoubleClick) {
                this._delayedClickTimeout = <any>setTimeout(() => {
                    this.triggerEvent("sectionClick", $e.data("section-id"));
                }, AppsWindowView.SINGLE_CLICK_DELAY);
            }
            return;
        }
        this.triggerEvent("sectionClick", $e.data("section-id"));
    }
    
    setAppWindowBadge(appWindowId: string, count: number): void {
        let $badge = this.$main.find(".app-launcher[data-app-window='" + appWindowId + "'] .badge");
        this.setBadge($badge, count);
    }
    
    scheduleSetAppWindowBadgeFullyLoaded(appWindowId: string, fullyLoaded: boolean): void {
        if (!fullyLoaded) {
            this.setAppWindowBadgeFullyLoaded(appWindowId, fullyLoaded);
            return;
        }
        if (this.scheduledModules[appWindowId]) {
            return;
        }
        this.scheduledModules[appWindowId] = true;
        this._nextSpinnerRemoval = this._nextSpinnerRemoval.then(() => {
            this.setAppWindowBadgeFullyLoaded(appWindowId, fullyLoaded);
            let def = Q.defer<void>();
            setTimeout(() => {
               def.resolve();
            }, AppsWindowView.MIN_TIME_BETWEEN_LOADING_SPINNERS_REMOVAL);
            return def.promise;
        });
    }
    
    setAppWindowBadgeFullyLoaded(appWindowId: string, fullyLoaded: boolean): void {
        // this.$main.toggleClass(appWindowId + "-unread-counts-fully-loaded", fullyLoaded);
        if (this.loadedModules[appWindowId] != fullyLoaded) {
            this.loadedModules[appWindowId] = fullyLoaded;
            this.updateSpinners(null, appWindowId, !fullyLoaded, true);
        }

        let allLoaded = true;
        for (let id in this.loadedModules) {
            if (!this.loadedModules[id]) {
                allLoaded = false;
                return;
            }
        }
        if (allLoaded) {
            $.when(this.$loadingUnread.fadeOut(500)).done(() => {
                this.$loadingUnread.children().remove();
            });
            this.setAllSpinnersHidden(true);
        }
    }
    
    setBadge($badge: JQuery, count: number): void {
        if (count) {
            $badge.text(count).addClass("visible");
        }
        else {
            $badge.removeClass("visible");
        }
    }
  
    updateSplitSectionsNames() {
        const options: webUtils.ellipsis.EllipsisOptions = {
            wordBreak: {
                isEnabled: true,
                minWordLength: 6,
                minPrefixLength: 3,
                minSuffixLength: 3,
            },
        };
        const ellipsisNormal = new webUtils.ellipsis.Ellipsis(options);
        const ellipsisBold = new webUtils.ellipsis.Ellipsis(options);
        this.$main.find(".sections .wi-element-name").each((_, el) => {
            const $el = $(el);
            $el.find(".section-breadcrumb").remove();
            const breadcrumb = $el.data("breadcrumb").trim();
            const sectionName = $el.data("section-name").trim();
            const textSpans: webUtils.ellipsis.SimpleTextSpan[] = [];
            if (breadcrumb.length > 0) {
                textSpans.push({
                    text: breadcrumb + " ",
                    textToHtml: text => `<span class="section-breadcrumb">${text}</span>`,
                });
            }
            if (sectionName.length > 0) {
                textSpans.push({
                    text: sectionName,
                    textToHtml: text => text,
                });
            }
            const ellipsis = $el.hasClass("bold") ? ellipsisBold : ellipsisNormal;
            ellipsis.apply($el, textSpans);
        });
    }
    
    getFilesPos(): {x: number, y: number} {
        let $notes2Tale = this.$main.find(".app-launcher[data-app-window=notes2]");
        let rect = $notes2Tale[0].getBoundingClientRect() as DOMRect;
        return {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2
        }
    }

    showFilesUserGuide(): void {
        Q().then(() => {
            this.userGuide = this.addComponent("userguide", new component.userguide.UserGuideView(this));
            this.$main.append($('<div class="user-guide-container"></div>'));
            this.userGuide.$container = this.$main.find(".user-guide-container");
            return this.userGuide.triggerInit();
        })
        .then(() => {
            this.userGuideVisible = true;
        })
    }

    closeFilesUserGuide(): void {
        this.userGuideVisible = false;
        this.$main.find(".user-guide-container").remove();
    }

    onResizeWindow(): void {
        if (this.resizeDebounceTimer == null && this.userGuideVisible) {
            this.resizeDebounceTimer = setTimeout(() => {
                clearTimeout(this.resizeDebounceTimer);
                this.resizeDebounceTimer = null;
                (<any>this.userGuide).updatePos(this.getFilesPos().x, this.getFilesPos().y);
            }, 50)
        }
    }
    
    onBadgeClick(e: MouseEvent): void {
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (!unreadBadgeUseDoubleClick) {
            this.handleBadgeSingleOrDoubleClick(e);
        }
    }
    
    onBadgeDoubleClick(e: MouseEvent): void {
        let unreadBadgeUseDoubleClick = $(document.body).attr("data-unread-badge-use-double-click") == "true";
        if (unreadBadgeUseDoubleClick) {
            this.handleBadgeSingleOrDoubleClick(e);
        }
    }
    
    handleBadgeSingleOrDoubleClick(e: MouseEvent): void {
        this.clearDelayedClickTimeout();
        let moduleName = $(e.target).closest("[data-app-window]").data("app-window");
        let sectionId = $(e.target).closest("[data-section-id]").data("section-id");
        if (moduleName && ["chat", "notes2", "tasks"].indexOf(moduleName) >= 0) {
            this.triggerEvent("moduleBadgeClick", moduleName);
        }
        else if (sectionId) {
            this.triggerEvent("sectionBadgeClick", sectionId);
        }
    }
    
    onBadgeMouseEnter(e: MouseEvent): void {
        this.toggleBadgeParentHover(e, true);
    }
    
    onBadgeMouseLeave(e: MouseEvent): void {
        this.toggleBadgeParentHover(e, false);
    }
    
    toggleBadgeParentHover(e: MouseEvent, isBadgeHover: boolean): void {
        let $parent = $(e.target).closest("[data-app-window], [data-section-id]");
        $parent.toggleClass("with-badge-hover", isBadgeHover);
    }
    
    clearDelayedClickTimeout(): void {
        if (this._delayedClickTimeout) {
            clearTimeout(this._delayedClickTimeout);
            this._delayedClickTimeout = null;
        }
    }
    
    updateSpinners(sectionId: string, moduleName: string, state: boolean, checkCount: boolean = false): void {
        let badges: { $badge: JQuery, width: string, state: boolean }[] = [];
        let $badge: JQuery;
        if (sectionId) {
            // All modules and the section
            $badge = this.$main.find(`.wi-element[data-section-id="${sectionId}"]`).find(".wi-element-badge.number");
            badges.push({
                $badge: $badge,
                width: state ? ($badge.outerWidth() || 0).toString() : "initial",
                state: state,
            });
            this.$main.find(`.app-launcher[data-trigger="launch-app-window"]`).each((_, el) => {
                $badge = $(el).find(".number.badge");
                if ($badge.length > 0) {
                    let isModuleFullyLoaded = this.loadedModules[$(el).data("app-window")];
                    let moduleState = !isModuleFullyLoaded || state;
                    badges.push({
                        $badge: $badge,
                        width: moduleState ? ($badge.outerWidth() || 0).toString() : "initial",
                        state: moduleState,
                    });
                }
            });
        }
        if (moduleName) {
            // All sections and the module
            $badge = this.$main.find(`.app-launcher[data-trigger="launch-app-window"][data-app-window="${moduleName}"]`).find(".number.badge");
            let isModuleFullyLoaded = this.loadedModules[moduleName];
            let moduleState = !isModuleFullyLoaded || state;
            badges.push({
                $badge: $badge,
                width: moduleState ? ($badge.outerWidth() || 0).toString() : "initial",
                state: moduleState,
            });
            this.$main.find(`.wi-element[data-section-id]`).each((_, el) => {
                $badge = $(el).find(".wi-element-badge.number");
                if ($badge.length > 0) {
                    badges.push({
                        $badge: $badge,
                        width: state ? ($badge.outerWidth() || 0).toString() : "initial",
                        state: state,
                    });
                }
            });
        }
        for (let badge of badges) {
            badge.$badge.css("width", badge.width).toggleClass("with-spinner", badge.state);
            if (badge.state && !badge.$badge.hasClass("visible")) {
                badge.$badge.addClass("visible");
            }
            if (!badge.state && checkCount) {
                let num = badge.$badge[0] ? parseInt(badge.$badge[0].textContent.trim()) || 0 : 0;
                if (num == 0) {
                    badge.$badge.removeClass("visible");
                }
            }
        }
    }
    
    setAllSpinnersHidden(allSpinnersHidden: boolean):void {
        this.triggerEvent("setAllSpinnersHidden", allSpinnersHidden);
    }

    updateStatistics(chats: number, tasks: number, files: number): void {
        const $stats = this.$main.find(".modules-statistics");
        const $chatsCountElement = $stats.find(".chat-count");
        const $tasksCountElement = $stats.find(".tasks-count");
        const $filesCountElement = $stats.find(".notes2-count");

        $chatsCountElement.text(chats ? webUtils.NumberFormatter.formatSimpleWithSuffix(chats): "-");
        $tasksCountElement.text(tasks ? webUtils.NumberFormatter.formatSimpleWithSuffix(tasks): "-");
        $filesCountElement.text(files ? webUtils.NumberFormatter.formatSimpleWithSuffix(files): "-");
        
        $stats.fadeIn(500);
    }
    
}
