import {component, webUtils, window as wnd, Q, JQuery as $, Types, Logger as RootLogger} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as editorLoaderTemplate} from "./template/editor-loader.html";
import {func as emptyPreviewTemplate} from "./template/empty-preview.html";
import {func as directoryPreviewTemplate} from "./template/directory-preview.html";
import {Model, DirectoryPreviewModel, TrashedInfoModel} from "./Notes2WindowController";
import {FilesListView} from "../../component/fileslist/FilesListView";
let Logger = RootLogger.get("notes2-plugin.window.notes2.Notes2WindowView");

export enum FocusedElement {
    SIDEBAR,
    FILES_LIST,
    PREVIEW
}

export interface HostEntryModel {
    host: string;
    sectionsList: component.remotesectionlist.RemoteSectionListView;
    conv2List: component.remoteconv2list.RemoteConv2ListView;
}
export class Notes2WindowView extends wnd.base.BaseAppWindowView<Model> {
    
    static readonly SIDEBAR_MIN_WIDTH = 100;
    static readonly FILESLIST_MIN_WIDTH = 220;
    static readonly PREVIEW_MIN_WIDTH = 100;
    
    verticalSplitter: component.splitter.SplitterView;
    filesVerticalSplitter: component.splitter.SplitterView;
    personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    notifications: component.notification.NotificationView;
    $leftPanelFixed: JQuery;
    $leftPanelSections: JQuery;
    $leftPanelPeople: JQuery;
    $editorLoader: JQuery;
    filesLists: {[id: string]: FilesListView};
    remoteServers: {[hostHash: string]: HostEntryModel};
    active: FilesListView;
    isCtrlKeyDown: boolean = false;
    leftPanelGroups: string[] = ["my-files", /*"other-files",*/ "common-files", "conversations"];
    dragDrop: component.dragdrop.DragDrop;
    infoTooltip: component.infotooltip.InfoTooltip;
    sidebar: component.sidebar.SidebarView;
    lastFocusedElement: FocusedElement = FocusedElement.SIDEBAR;
    isSearchOn: boolean = false;
    sectionTooltip: component.sectiontooltip.SectionTooltipView;
    disabledSection: component.disabledsection.DisabledSectionView;
    loading: component.loading.LoadingView;
    $disabledSectionContainer: JQuery;
    mostRecentlyActivatedId: string = "none";
    $trashedInfo: JQuery;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.filesLists = {};
        this.verticalSplitter = this.addComponent("verticalSplitter", new component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
            firstPanelMinSize: Notes2WindowView.SIDEBAR_MIN_WIDTH,
            secondPanelMinSize: () => {
                if (this.filesVerticalSplitter && this.filesVerticalSplitter.$left && this.filesVerticalSplitter.$left.children().length > 0) {
                    if (this.filesVerticalSplitter.$component.hasClass("hide-file-preview")) {
                        return Notes2WindowView.FILESLIST_MIN_WIDTH;
                    }
                    return this.filesVerticalSplitter.$left.outerWidth() + Notes2WindowView.PREVIEW_MIN_WIDTH;
                }
                return Notes2WindowView.FILESLIST_MIN_WIDTH + Notes2WindowView.PREVIEW_MIN_WIDTH;
            },
        }));
        this.filesVerticalSplitter = this.addComponent("filesVerticalSplitter", new component.splitter.SplitterView(this, {
            type: "vertical",
            handlePlacement: "right",
            handleDot: true,
            firstPanelMinSize: Notes2WindowView.FILESLIST_MIN_WIDTH,
            secondPanelMinSize: Notes2WindowView.PREVIEW_MIN_WIDTH,
        }));
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.filesVerticalSplitter.addEventListener("handleMove", this.onHandleMove.bind(this));
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.disabledSection = this.addComponent("disabled-section", new component.disabledsection.DisabledSectionView(this));
        this.loading = this.addComponent("loading", new component.loading.LoadingView(this));
        
        this.sectionTooltip = this.addComponent("sectiontooltip", new component.sectiontooltip.SectionTooltipView(this));
        this.sidebar = this.addComponent("sidebar", new component.sidebar.SidebarView(this, {
            conv2List: {
                personsView: this.personsComponent,
                extList: {
                    template: null
                }
            },
            conv2Splitter: null,
            customElementList: {
                extList: {
                    template: null,
                    onAfterListRender: this.onAfterRenderCustomList.bind(this)
                }
            },
            sectionList: {
                extList: {
                    template: null
                }
            },
            customSectionList: {
                extList: {
                    template: null
                }
            },
        }));
    }
    
    onAfterRenderCustomList(): void {
        this.personsComponent.refreshAvatars();
    }
    
    initWindow(model: Model): Q.Promise<void> {
        let blurCheckId: NodeJS.Timer;
        document.addEventListener("blur", () => {
            clearTimeout(blurCheckId);
            blurCheckId = setTimeout(() => {
                let fe = this.getFocusedElement();
                if (fe != null) {
                    this.lastFocusedElement = fe;
                }
            }, 1);
        }, true);
        document.addEventListener("focus", () => {
            clearTimeout(blurCheckId);
            let fe = this.getFocusedElementFromEl($(<HTMLElement>document.activeElement));
            if (fe != null) {
                this.lastFocusedElement = fe;
            }
        }, true);
        return Q().then(() => {
            this.turnTimeAgoRefresher();
            this.$body.on("keydown", this.onKeydown.bind(this));
            this.personsComponent.$main = this.$main;
            this.personTooltip.init(this.$main);
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.verticalSplitter.$container = this.$mainContainer;
            return this.verticalSplitter.triggerInit();
        })
        .then(() => {
            this.verticalSplitter.$left.addClass("sidebar-container");
            this.sidebar.$container = this.verticalSplitter.$left;//.find(".l1");
            return this.sidebar.triggerInit();
        })
        .then(() => {
            this.verticalSplitter.$right.append($("<div class='section-files'></div>"));
            this.$disabledSectionContainer = $("<div class='disabled-section'>");
            this.verticalSplitter.$right.append(this.$disabledSectionContainer);
            this.disabledSection.$container = this.$disabledSectionContainer;
            this.disabledSection.triggerInit();
        })
        .then(() => {
            this.filesVerticalSplitter.$container = this.verticalSplitter.$right.find(".section-files");
            return this.filesVerticalSplitter.triggerInit();
        })
        .then(() => {
            this.filesVerticalSplitter.$right.addClass("preview-container").attr("tabindex", "-1");
            this.notifications.$container = this.filesVerticalSplitter.$left;
            return this.notifications.triggerInit();
        })
        .then(() => {
            let $emptyPreview = this.templateManager.createTemplate(emptyPreviewTemplate).renderToJQ();
            this.filesVerticalSplitter.$right.append($emptyPreview);
            this.filesVerticalSplitter.$right.append('<div class="trashed-info"></div>');
            this.$trashedInfo = this.filesVerticalSplitter.$right.children(".trashed-info");
            this.$editorLoader = this.templateManager.createTemplate(editorLoaderTemplate).renderToJQ();
            this.filesVerticalSplitter.$right.append(this.$editorLoader);
            this.makeCustomScroll(this.$main.find(".left-panel .scrollable-content"));
            this.activateFiles(model.activeId);
            if (model.iframeId != null) {
                this.showIframe(model.iframeId, model.iframeLoad);
            }
            else if (model.directory) {
                this.showDirectoryPreview(model.directory);
            }
        })
        .then(() => {
            this.sectionTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.sectionTooltip.$container = this.$main;
            return this.sectionTooltip.triggerInit();
        })
        .then(() => {
            this.sidebar.usersListTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.loading.$container = this.filesVerticalSplitter.$left;
            return this.loading.triggerInit();
        })
        .then(() => {
            this.updateShowFilePreview(model.showFilePreview);
        });
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    toggleDisabledSection(show: boolean): void {
        show ? this.$main.find(".section-files").hide() : this.$main.find(".section-files").show();
        this.$disabledSectionContainer.css("display", show ? "block" : "none");
    }

    activateFiles(id: string) {
        // this.loading.onStartLoading();
        this.mostRecentlyActivatedId = id;
        this.toggleDisabledSection(false);
        this.$main.find(".preview-container").toggleClass("hidden", id == null);
        if (id == null) {
            if (this.active) {
                this.active.$container.addClass("vhidden");
                this.active.onDeactivate();
            }
            this.loading.onFinishedLoading();
            return;
        }
        if (!(id in this.filesLists)) {
            this.filesLists[id] = this.addComponent(id, new FilesListView(this, this.personsComponent));
            this.filesLists[id].$container = $('<div class="files-list-container vhidden"></div>');
            this.filesVerticalSplitter.$left.append(this.filesLists[id].$container);
            this.filesVerticalSplitter.$left.addClass("notes2-fileslist-component");
        }
        this.filesLists[id].triggerInit()
        .then(() => {
            if (this.mostRecentlyActivatedId != id) {
                return;
            }
            let filesList = this.filesLists[id];
            if (this.active == filesList) {
                this.loading.onFinishedLoading();
                return;
            }
            if (this.active) {
                this.active.$container.addClass("vhidden");
                this.active.onDeactivate();
            }
            this.active = filesList;
            this.dragDrop = new component.dragdrop.DragDrop(this, filesList.$container.children(".files-list"));
            filesList.$container.removeClass("vhidden");
            filesList.onActivate();
            this.refreshFocus();
            this.loading.onFinishedLoading();
        })
        .fail(e => {
            this.loading.onFinishedLoading();
            Logger.error("Cannot create files list", e);
        });
    }
    
    onHandleMove(): void {
        for (let id in this.filesLists) {
            this.filesLists[id].onResize();
        }
    }
    
    //=========================
    //    EDITOR PREVIEW
    //=========================
    
    showEditorLoader(styleName: string): void {
        this.$editorLoader.attr("data-style-name", styleName || "");
        this.$editorLoader.find(".inner2").html('<i class="fa fa-circle-o-notch fa-spin"></i>');
        this.$editorLoader.removeClass("hide");
    }
    
    hideEditorLoader(): void {
        this.$editorLoader.addClass("hide");
        this.$editorLoader.find(".inner2").empty();
    }
    
    removeIframe(id: number) {
        let $container = this.filesVerticalSplitter.$right;
        $container.find(".iframe-container#iframe-" + id).remove();
    }
    
    hideIframe(id: number) {
        let $container = this.filesVerticalSplitter.$right;
        $container.find(".iframe-container#iframe-" + id).removeClass("active");
    }
    
    clearPreview() {
        let $container = this.filesVerticalSplitter.$right;
        $container.find(".iframe-container:not(.new-active)").removeClass("active");
        $container.find(".iframe-container.new-active").removeClass("new-active");
        this.hideDirectoryPreview();
    }
    
    showIframe(id: number, load: Types.app.WindowLoadOptions) {
        let $container = this.filesVerticalSplitter.$right;
        let $iframe = $container.find(".iframe-container#iframe-" + id);
        if ($iframe.length > 0) {
            $iframe.addClass("active new-active");
            // this.clearPreview();
            this.hideDirectoryPreview();
            this.hideEditorLoader();
        }
        else {
            this.clearPreview();
            let $active = $('<div id="iframe-' + id + '" class="iframe-container active"></div>');
            $container.append($active);
            this.viewManager.parent.registerDockedWindow(id, load, $active[0]);
        }
        this.triggerEvent("afterShowIframe", id);
    }
    
    showDirectoryPreview(model: DirectoryPreviewModel) {
        let $container = this.filesVerticalSplitter.$right;
        this.clearPreview();
        $container.append(this.templateManager.createTemplate(directoryPreviewTemplate).renderToJQ(model));
    }
    
    hideDirectoryPreview(selectedItemsCount: number = 0) {
        let $container = this.filesVerticalSplitter.$right;
        let text = "";
        if (selectedItemsCount == 0) {
            text = this.i18n("plugin.notes2.window.notes2.preview.empty");
        }
        else {
            text = this.i18n("plugin.notes2.window.notes2.preview.multi", selectedItemsCount);
        }
        $container.find(".empty-info").find(".inner-2").text(text);
        $container.find(".directory-preview").remove();
    }
    
    //=========================
    //        OTHER
    //=========================
    
    focus() {
        this.switchToPanel(this.getFocusedElementOrDefault(), true);
    }
    
    refreshFocus() {
        let fe = this.getFocusedElement();
        if (fe == FocusedElement.FILES_LIST) {
            if ($(document.activeElement).closest(".files-list-container").get(0) != this.active.$container.get(0)) {
                this.active.$container.focus();
            }
        }
        else if (fe == null) {
            this.sidebar.$container.focus();
        }
    }
    
    getFocusedElementFromEl($ae: JQuery): FocusedElement {
        if ($ae.closest(".sidebar-container").length > 0) {
            return FocusedElement.SIDEBAR;
        }
        if ($ae.closest(".preview-container").length > 0) {
            return FocusedElement.PREVIEW;
        }
        if ($ae.closest(".section-files").length > 0) {
            return FocusedElement.FILES_LIST;
        }
        return null;
    }
    
    getFocusedElement(): FocusedElement {
        return this.getFocusedElementFromEl($(<HTMLElement>document.activeElement));
    }
    
    getFocusedElementOrDefault(): FocusedElement {
        let fe = this.getFocusedElement();
        return fe == null ? (this.lastFocusedElement == null ? FocusedElement.SIDEBAR : this.lastFocusedElement) : fe;
    }
    
    onKeydown(event: KeyboardEvent): void {
        if (event.keyCode == webUtils.KEY_CODES.r && event.ctrlKey) {
            event.preventDefault();
            this.triggerEvent("refresh");
        }
        if (event.keyCode == webUtils.KEY_CODES.tab && !(event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            let fe = this.getFocusedElementOrDefault();
            if (event.shiftKey) {
                if (fe == FocusedElement.SIDEBAR) {
                    this.switchToPanel(FocusedElement.PREVIEW, true);
                }
                else if (fe == FocusedElement.FILES_LIST) {
                    this.switchToPanel(FocusedElement.SIDEBAR, true);
                }
                else if (fe == FocusedElement.PREVIEW) {
                    this.switchToPanel(FocusedElement.FILES_LIST, true);
                }
            }
            else {
                if (fe == FocusedElement.SIDEBAR) {
                    this.switchToPanel(FocusedElement.FILES_LIST, true);
                }
                else if (fe == FocusedElement.FILES_LIST) {
                    this.switchToPanel(FocusedElement.PREVIEW, true);
                }
                else if (fe == FocusedElement.PREVIEW) {
                    this.switchToPanel(FocusedElement.SIDEBAR, true);
                }
            }
        }
        else if (document.activeElement == document.body) {
            if (this.lastFocusedElement == FocusedElement.SIDEBAR) {
                this.sidebar.onKeydown(event);
                this.sidebar.$container.focus();
            }
            else if (this.lastFocusedElement == FocusedElement.FILES_LIST) {
                this.active.onKeydown(event);
                this.active.$container.focus();
            }
        }
        else if ((event.ctrlKey || event.metaKey) && (event.keyCode == webUtils.KEY_CODES.c || event.keyCode == webUtils.KEY_CODES.v || event.keyCode == webUtils.KEY_CODES.x) && $(event.target).closest(".section-files").length == 0) {
            this.active.onKeydown(event);
        }
    }
    
    switchToPanel(fe: FocusedElement, showHighlight: boolean) {
        this.$main.find(".focus-hightlight").remove();
        let $highlight = $('<div class="focus-hightlight"></div>');
        let currentFe = this.getFocusedElement();
        
        if (fe == FocusedElement.PREVIEW) {
            this.triggerEvent("activatePreview");
            let iframe = <HTMLIFrameElement>this.$main.find(".iframe-container.active iframe")[0];
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.focus();
                try {
                    let viewInstance = (<any>iframe.contentWindow).privmxViewRequire("Starter").Starter.viewInstance;
                    if (viewInstance.focus) {
                        viewInstance.focus();
                    }
                }
                catch (e) {
                    Logger.error("Cannot call focus method in view");
                }
            }
            else {
                this.$main.find(".preview-container").focus();
            }
        }
        else if (currentFe != fe) {
            if (fe == FocusedElement.SIDEBAR) {
                this.sidebar.$container.focus();
            }
            else if (fe == FocusedElement.FILES_LIST) {
                this.active.$container.focus();
            }
        }
        if (showHighlight) {
            if (fe == FocusedElement.PREVIEW) {
                this.filesVerticalSplitter.$right.append($highlight);
            }
            else if (fe == FocusedElement.SIDEBAR) {
                this.$main.find(".sidebar-container").append($highlight);
            }
            else if (fe == FocusedElement.FILES_LIST) {
                this.filesVerticalSplitter.$left.append($highlight);
            }
        }
        setTimeout(() => {
            $highlight.remove();
        }, 500);
    }
    
    switchPanelFromPreview(shiftKey: boolean) {
        if (shiftKey) {
            this.switchToPanel(FocusedElement.FILES_LIST, true);
        }
        else {
            this.switchToPanel(FocusedElement.SIDEBAR, true);
        }
    }
    
    grabFocus(highlight: boolean = true): void {
        this.switchToPanel(this.getFocusedElementOrDefault(), highlight);
    }
    
    changeIsSearchOn(isOn: boolean): void {
        this.isSearchOn = isOn;
        this.sidebar.$container.toggleClass("search-on", isOn);
        this.personsComponent.refreshAvatars();
    }
    
    updateSetting(settingName: string, settingValue: boolean): void {
        if (settingName == "show-file-preview") {
            this.updateShowFilePreview(settingValue);
        }
    }
    
    updateShowFilePreview(showFilePreview: boolean): void {
        this.filesVerticalSplitter.$component.toggleClass("show-file-preview", showFilePreview);
        this.filesVerticalSplitter.$component.toggleClass("hide-file-preview", !showFilePreview);
    }
    
    setPreviewTrashedInfo(trashedInfoModelStr: string): void {
        let trashedInfoModel: TrashedInfoModel = trashedInfoModelStr ? JSON.parse(trashedInfoModelStr) : null;
        let $trashedInfo = this.$trashedInfo;
        if (trashedInfoModel) {
            let who = trashedInfoModel.who;
            let when = trashedInfoModel.when ? this.helper.calendarDate(trashedInfoModel.when) : null;
            let from = trashedInfoModel.fullSectionName;
            let full = !!who;
            $trashedInfo.html(this.helper.i18n(
                "plugin.notes2.window.notes2.trashedInfo." + (full ? "full" : "onlySection"),
                this.helper.escapeHtml(from),
                this.helper.escapeHtml(who),
                this.helper.escapeHtml(when)
            ));
        }
        else {
            $trashedInfo.empty();
        }
    }

    /////////////////////////////
    //// REMOTE SECTIONS ////////
    /////////////////////////////


    expandRemoteSectionsList(host: string, hostHash: string): void {
        if (this.isRemoteHostVisible(hostHash)) {
            this.toggleRemoteHost(hostHash, false);
            return;
        }
        this.sidebar.showHostLoading(hostHash, false);
        Q().then(() => {
            if (! this.remoteServers) {
                this.remoteServers = {};
            }
            if (hostHash in this.remoteServers) {
                return;
            }
            let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");

            if (! this.remoteListsExists(hostHash)) {
                return Q().then(() => {
                    $hostElement.parent().append($("<div class='remote-sections' data-host-id='" + hostHash + "'></div>"));
                    $hostElement.parent().append($("<div class='remote-conversations' data-host-id='" + hostHash + "'></div>"));
        
                    let hostModel: HostEntryModel = {
                        host: host,
                        sectionsList: this.addComponent("remoteSectionsList-" + hostHash, new component.remotesectionlist.RemoteSectionListView(this, {
                            extList: {template: null}
                        })),
                        conv2List: this.addComponent("remoteConv2List-" + hostHash, new component.remoteconv2list.RemoteConv2ListView(this, {
                            personsView: this.personsComponent,
                            extList: {template: null}
                        }))
                    };
                    hostModel.sectionsList.sections.$container = $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']");
                    hostModel.conv2List.conversations.$container = $hostElement.parent().find(".remote-conversations[data-host-id='" + hostHash + "']");
                    
                    this.sidebar.remoteSectionLists[hostHash] = hostModel.sectionsList;
                    this.sidebar.remoteConv2Lists[hostHash] = hostModel.conv2List;
        
                    this.remoteServers[hostHash] = hostModel;
                    return Q.all([
                        hostModel.sectionsList.triggerInit(),
                        hostModel.conv2List.triggerInit()
                    ])        
                })
            }

        })
        .then(() => {
            this.toggleRemoteHost(hostHash, true);
        })
    }

    toggleRemoteHost(hostHash: string, visible: boolean) {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']").toggleClass("hide", !visible);
        $hostElement.parent().find(".remote-conversations[data-host-id='" + hostHash + "']").toggleClass("hide", !visible);
        this.sidebar.hostList.toggleHostElementIsExpanded(hostHash, visible);
    }

    isRemoteHostVisible(hostHash: string): boolean {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        return ! $hostElement.find(".fa.expanded").hasClass("hide");
    }
    
    remoteListsExists(hostHash: string): boolean {
        let $hostElement = this.$main.find(".host-element[data-host-id='" + hostHash + "']");
        let remoteSectionsExists = $hostElement.parent().find(".remote-sections[data-host-id='" + hostHash + "']").length > 0;
        return remoteSectionsExists;
    }

    hideLoading(): void {
        this.loading.onFinishedLoading();
    }

}
