import {func as mainTemplate} from "./template/main.html";
import {component, webUtils, window as wnd, Q, JQuery as $, Types, Logger as RootLogger} from "pmc-web";
import {Model} from "../notes2/Notes2WindowController";
import {FilesListView} from "../../component/fileslist/FilesListView";
import { HostEntryModel } from "../notes2/Notes2WindowView";
let Logger = RootLogger.get("main.FileChooser");

export enum FocusedElement {
    SIDEBAR,
    FILES_LIST
}


export class FileChooserWindowView extends wnd.base.BaseWindowView<Model> {
    $modulesContainer: JQuery;
    splitter: component.splitter.SplitterView;
    sidebar: component.sidebar.SidebarView;
    $placeholders: JQuery[] = [];
    activeModulesCount: number;
    useAutoResizer: boolean = true;
    
    personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    notifications: component.notification.NotificationView;
    sectionTooltip: component.sectiontooltip.SectionTooltipView;
    
    lastFocusedElement: FocusedElement = FocusedElement.SIDEBAR;
    leftPanelGroups: string[] = ["my-files", /*"other-files",*/ "common-files", "conversations"];
      
    filesLists: {[id: string]: FilesListView};
    $listsContainer: JQuery;;
    active: FilesListView;
    remoteServers: {[hostHash: string]: HostEntryModel};
    
    switchToFilesListAfterActivateFiles: { highlight: boolean } = null;
       
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.filesLists = {};
        if (this.useAutoResizer) {
            this.useAutoResizer = !!(<any>window).ResizeObserver;
        }
        
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
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
        
    initWindow(model: Model) {
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=select]", this.onOkClick.bind(this));
        this.$modulesContainer = this.$main.find(".modules-container");
        // this.bindKeyPresses();
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
            this.splitter = this.addComponent("splitter", new component.splitter.SplitterView(this, {type: "vertical", handlePlacement: "right"}));
            this.splitter.$container = this.$modulesContainer;
            return this.splitter.triggerInit();
        })
        .then(() => {
            this.$listsContainer = $("<div class='lists-container'></div>");
            this.splitter.$right.empty().append(this.$listsContainer);
            this.splitter.$left.addClass("sidebar-container");
            return;
        })
        .then(() => {
            this.sidebar.$container = this.splitter.$left;
            return this.sidebar.triggerInit();
        })
        .then(() => {
            this.$modulesContainer.on("click", ".action-item[action-id=select]", this.onFileSelectClick.bind(this));
            return;
        });
    }
    
    createFilesList(id: string): Q.Promise<void> {
        return Q().then(() => {
            this.filesLists[id] = this.addComponent(id, new FilesListView(this, this.personsComponent));
            let $filesList = $("<div class='notes2-fileslist-component' data-list-id='" + id + "'></div>");
            this.$listsContainer.append($filesList);
            this.filesLists[id].$container = $filesList;
            return this.filesLists[id].triggerInit();
        })
    }
    
    customizeActions($parent: JQuery): void {
        // let $container = $parent.find(".files-actions-container");
        // let $actions = $container.find("div.center");
        // $actions.removeClass("center").addClass("right");
        // $actions.children().each((_i, x) => {
        //     x.remove();
        // });
        // $actions.append($("<button class='action-item btn btn-default btn-sm small gray' action-id='select' title='" + this.i18n("plugin.notes2.window.filechooser.select") + "'><i class='fa fa-check'></i>" + this.i18n("plugin.notes2.window.filechooser.select") + "</button>"));
    }
    
    onFileSelectClick(): void {
        this.triggerEvent("select");
    }
    
    setName(name: string): void {
        this.$main.find(".name .text").html(name);
    }

    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onOkClick(): void {
        this.triggerEvent("select");
    }
    
    
    // bindKeyPresses(): void {
    //     $(document).on("keydown", e => {
    //         if (e.keyCode == KEY_CODES.enter) {
    //             e.preventDefault();
    //             this.onOkClick();
    //         } else
    //         if (e.keyCode == KEY_CODES.escape) {
    //             e.preventDefault();
    //             this.onCloseClick();
    //         }
    //     });
    // }
    
    
    
    /////////////////
    // other
    /////////////////
    focus() {
        let focusedOrDefault = this.getFocusedElementOrDefault();
        
        // this.switchToPanel(this.getFocusedElementOrDefault(), true);
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

        if ($ae.closest(".lists-container").length > 0) {
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
        if (event.keyCode == webUtils.KEY_CODES.tab && !(event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            let fe = this.getFocusedElementOrDefault();
            if (event.shiftKey) {
                if (fe == FocusedElement.SIDEBAR) {
                    this.switchToPanel(FocusedElement.FILES_LIST, true);
                }
                else if (fe == FocusedElement.FILES_LIST) {
                    this.switchToPanel(FocusedElement.SIDEBAR, true);
                }
            }
            else {
                if (fe == FocusedElement.SIDEBAR) {
                    this.switchToPanel(FocusedElement.FILES_LIST, true);
                }
                else if (fe == FocusedElement.FILES_LIST) {
                    this.switchToPanel(FocusedElement.SIDEBAR, true);
                }
            }
        }
        else if (event.keyCode == webUtils.KEY_CODES.escape) {
            this.onCloseClick();
        }
        else if (document.activeElement == document.body) {
            if (this.lastFocusedElement == FocusedElement.SIDEBAR) {
                this.sidebar.onKeydown(event);
                this.sidebar.$container.focus();
            }
            else if (this.lastFocusedElement == FocusedElement.FILES_LIST) {
                (<any>this.active).onKeydown(event);
                this.active.$container.focus();
            }
        }
        else if ((event.ctrlKey || event.metaKey) && (event.keyCode == webUtils.KEY_CODES.c || event.keyCode == webUtils.KEY_CODES.v || event.keyCode == webUtils.KEY_CODES.x) && $(event.target).closest(".section-files").length == 0) {
            if (this.lastFocusedElement != FocusedElement.FILES_LIST) {
                (<any>this.active).onKeydown(event);
            }
        }
    }
    
    switchToPanel(fe: FocusedElement, showHighlight: boolean) {
        this.$main.find(".focus-hightlight").remove();
        let $highlight = $('<div class="focus-hightlight"></div>');
        let currentFe = this.getFocusedElement();

        if (currentFe != fe) {
            if (fe == FocusedElement.SIDEBAR) {
                this.sidebar.$container.focus();
            }
            else if (fe == FocusedElement.FILES_LIST) {
                this.splitter.$right.focus();
                this.active.$container.focus();
            }
        }
        if (showHighlight) {
            if (fe == FocusedElement.SIDEBAR) {
                this.splitter.$left.append($highlight);
            }
            else if (fe == FocusedElement.FILES_LIST) {
                this.splitter.$right.append($highlight);
            }
        }
        setTimeout(() => {
            $highlight.remove();
        }, 500);
    }
    
    switchFocusToFilesList(showHighlight: boolean): void {
        if (!this.active) {
            this.switchToFilesListAfterActivateFiles = { highlight: showHighlight };
            return;
        }
        this.switchToPanel(FocusedElement.FILES_LIST, showHighlight);
    }
    
    switchFocusToSidebar(showHighlight: boolean): void {
        this.switchToPanel(FocusedElement.SIDEBAR, showHighlight);
    }
    
    activateFiles(id: string) {
        if (!(id in this.filesLists)) {
            this.$modulesContainer.find(".lists-container").children().each((_i, x) => {
                $(x).toggleClass("vhidden", true);
            });
            return this.createFilesList(id)
            .then(() => {
                this.customizeActions(this.filesLists[id].$container);
                this.active = this.filesLists[id];
                this.refreshFocus();
                if (this.switchToFilesListAfterActivateFiles) {
                    this.switchToPanel(FocusedElement.FILES_LIST, this.switchToFilesListAfterActivateFiles.highlight);
                }
            })
        }
        else {
            this.customizeActions(this.filesLists[id].$container);
            this.$modulesContainer.find(".lists-container").children().each((_i, x) => {
                let $x = $(x);
                $x.toggleClass("vhidden", $x.data("list-id") != id);
            });
            this.active = this.filesLists[id];

            this.refreshFocus();
            if (this.switchToFilesListAfterActivateFiles) {
                this.switchToPanel(FocusedElement.FILES_LIST, this.switchToFilesListAfterActivateFiles.highlight);
            }
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
}
