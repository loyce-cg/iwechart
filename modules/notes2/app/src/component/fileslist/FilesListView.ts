import {component, webUtils, window as wnd, JQuery as $, Q} from "pmc-web";
import {FileEntry, Model} from "./FilesListController";
import {func as fileEntryTemplate} from "./template/file-entry.html";
import {func as filesListTemplate} from "./template/files-list.html";
import {func as filesActionsTemplate} from "./template/files-actions.html";
import {func as filesListEmptyTemplate} from "./template/files-list-empty.html";
import {func as actionsMenuTemplate} from "./template/actions-menu.html";
import {ViewMode, FilesConst, SelectionChangeMode} from "../../main/Common";

export interface ActionItemModel {
    id?: string;
    labelKey?: string;
    icon?: string;
    hidden?: boolean;
    isSeparator?: boolean;
}

export interface ActionsModel {
    items: ActionItemModel[];
}

export class FilesListView extends component.base.ComponentView {
    
    static DOUBLE_CLICK_TIME = 400;
    
    parent: wnd.base.BaseWindowView<any>;
    id: string;
    isAll: boolean;
    isLocal: boolean;
    isTrash: boolean;
    files: component.extlist.ExtListView<FileEntry>;
    $container: JQuery;
    $filesList: JQuery;
    lastClickTid: NodeJS.Timer;
    lastClickId: string;
    $filesActions: JQuery;
    lastIndex: number;
    $filesHeader: JQuery;
    dropdown: component.dropdown.Dropdown<ActionsModel>;
    editable: boolean;
    isDeletedUserSection: boolean;
    order: number;
    notifications: component.notification.NotificationView;
    taskTooltip: component.tasktooltip.TaskTooltipView;
    taskChooser: component.taskchooser.TaskChooserView;
    basicTooltip: component.tooltip.TooltipView;
    locksTooltip: component.userslisttooltip.UsersListTooltipView;

    viewMode: ViewMode = "tiles";
    $settingsMenu: JQuery;
    userCanWrite: boolean = true;
    selectedFileIds: string[] = [];
    asFileChooser: boolean = false;
    systemLabel: string;
    model: Model;
    
    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent);
        this.order = 20;
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.taskTooltip = this.addComponent("tasktooltip", new component.tasktooltip.TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); };
        // this.taskChooser = this.addComponent("taskchooser", new component.taskchooser.TaskChooserView(this));
        this.basicTooltip = this.addComponent("basicTooltip", new component.tooltip.TooltipView(this));
        this.locksTooltip = this.addComponent("locksTooltip", new component.userslisttooltip.UsersListTooltipView(this));
        this.locksTooltip.refreshAvatars = () => { this.personsComponent.refreshAvatars(); }
        this.files = this.addComponent("files", new component.extlist.ExtListView(this, {
            template: fileEntryTemplate,
            emptyTemplate: filesListEmptyTemplate,
            onAfterListRender: () => {
                this.personsComponent.refreshAvatars();
                this.updateSplitFileNames();
                this.addSelectedItemClasses();
                this.updateSettingsMenu();
            }
        }));
        this.files.addEventListener("ext-list-change", this.onAfterListRender.bind(this));
    }

    initViewAfterSessionSet(hostHash: string): void {
        Q().then(() => {
            this.taskChooser = this.addComponent("taskchooser-" + hostHash , new component.taskchooser.TaskChooserView(this));
            this.taskChooser.$container = this.$container;
            return this.taskChooser.triggerInit()
        })
        .then(() => {
            // console.log("taskChooser initialized in view")
        })
    }
    
    init(model: Model) {
        // console.log("filesListView init")
        this.model = model;
        this.selectedFileIds = JSON.parse(model.selectedIdsStr);
        return Q().then(() => {
            this.id = model.id;
            this.isAll = model.isAll;
            this.isLocal = model.isLocal;
            this.isTrash = model.isTrash;
            this.editable = model.editable;
            this.isDeletedUserSection = model.isDeletedUserSection;
            this.viewMode = model.viewMode;
            this.asFileChooser = model.asFileChooser;
            this.systemLabel = model.systemLabel;
            this.$container.attr("tabindex", "-1");
            this.$container.on("keydown", this.onKeydown.bind(this));
            this.$container.on("click", ".file-entry[data-id]", this.onFileEntryClick.bind(this));
            this.$container.on("click", "[data-action=new-note]", this.onNewNoteClick.bind(this));
            this.$container.on("click", "[data-action=open-chat]", this.onOpenChatClick.bind(this));
            this.$container.on("click", "[data-action=open-tasks]", this.onOpenTasksClick.bind(this));
            this.$container.on("click", "[data-action=refresh]", this.onFileActionClick.bind(this));
            this.$container.on("click", "[data-action=toggle-view-mode]", this.onToggleViewModeClick.bind(this));
            this.$container.on("click", "[data-action=mark-all-as-read]", this.onMarkAllAsReadClick.bind(this));
            this.$container.on("click", "[data-action=empty-trash]", this.onEmptyTrashClick.bind(this));
            this.$container.on("click", "[data-action=export-files]", this.onExportAllFilesClick.bind(this));
            this.$container.on("click", "[data-action=add-dir-to-playlist]", this.onAddDirToPlaylistClick.bind(this));
            this.$container.on("click", ".actions-menu [data-action-id]", this.onActionsMenuClick.bind(this));
            this.$container.on("click", "[data-task-id]", this.onTaskClick.bind(this));
            this.$container.on("click", "[data-action=open-settings]", this.onOpenSettingsClick.bind(this));
            this.$container.on("click", "[data-setting]", this.onSettingClick.bind(this));
            this.$container.on("click", ".context-menu-backdrop2", this.onCloseSettingsClick.bind(this));
            this.$container.on("click", "[data-action=add-person]", this.onAddPersonClick.bind(this));
            this.$container.on("click", "[data-action=remove-person]", this.onRemovePersonClick.bind(this));
            // this.personsComponent.$main = this.$container;
            // return this.personsComponent.triggerInit();
            
        })
        .then(() => {
            this.notifications.$container = this.$container;
            return this.notifications.triggerInit();
        })
        .then(() => {
            this.taskTooltip.$container = this.$container;
            return this.taskTooltip.triggerInit();
        })
        // .then(() => {
        //     this.taskChooser.$container = this.$container;
        //     return this.taskChooser.triggerInit();
        // })
        .then(() => {
            let convTemplate = this.templateManager.createTemplate(component.template.conversation);
            this.$container.append(this.templateManager.createTemplate(filesListTemplate).renderToJQ(model, convTemplate));
            this.files.$container = this.$container.find(".files-container tbody");
            this.$filesList = this.$container.find(".files-list");
            this.parent.makeCustomScroll(this.$filesList.find(".files-container"));
            this.$filesHeader = this.$container.find(".files-header");
            this.$filesActions = this.$container.find(".files-actions-container");
            this.$filesActions.on("click", ".action-item[action-id]", this.onFileActionClick.bind(this));
            if (! model.asFileChooser) {
                this.$filesActions.append(this.templateManager.createTemplate(filesActionsTemplate).renderToJQ(model));
            }
            this.onClipboardChange(model.clipboard);
            this.refreshPath(model.currentPath);
            this.updateViewMode(this.viewMode);
            this.$settingsMenu = this.$container.find(".context-menu-settings");
            this.parent.elementEllipsis(this.$container.find(".current-path"), model.currentPath, true);
            return this.files.triggerInit();
        })
        .then(() => {
            this.basicTooltip.$container = this.$container;
            this.basicTooltip.isEnabled = (e: MouseEvent) => {
                return !this.$filesActions.find("[action-id=delete]").hasClass("selection-fully-deletable");
            };
            return this.basicTooltip.triggerInit();
        })
        .then(() => {
            this.locksTooltip.$container = this.$container;
            return this.locksTooltip.triggerInit();
        })
        .then(() => {
            if ((<any>window).ResizeObserver) {
                let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                    if (this.$settingsMenu && this.$settingsMenu.hasClass("visible")) {
                        this.$settingsMenu.removeClass("visible");
                    }
                });
                resizeObserver.observe(this.$filesList[0]);
            }
        })
        .then(() => {
            this.personsComponent.refreshAvatars();
            // console.log("filesListView init done");
        })
    }
    
    updatePersonPresence(hashmail: string, present: boolean): void {
        // this.$filesHeader.find("[data-person-hashmail='" + hashmail + "']").toggleClass("present", present);
        if (!this.model) {
            return;
        }
        let person = this.model.persons.filter(x => x.hashmail == hashmail)[0];
        if (!person) {
            return;
        }
        person.present = present;
        this.refreshConvHeader();
    }

    onActivate(): void {
        this.onResize();
    }
    
    onDeactivate(): void {
    }
    
    onAfterListRender(): void {
        this.updateButtonsState();
        this.triggerEvent("updateCanWrite");
    }
    
    updateCanWrite(canWrite: boolean): void {
        this.userCanWrite = canWrite;
        this.updateButtonsState();
    }
    
    updateButtonsState(): void {
        let userCanWrite = this.userCanWrite;
        let $active = this.files.$container.find(".file-entry.selected");
        let empty = this.files.$container.children(".file-entry").length == 0;
        let multi = $active.length > 1;
        let type = $active.data("type");
        let id = $active.data("id");
        let openable = !multi;
        let deletable = this.areAllElements("deletable", $active);
        let renamable = !multi && $active.data("renamable");
        let hasHistory = !multi && $active.data("hashistory");
        let printable = !multi && $active.data("printable");
        let canSaveAsPdf = !multi && $active.data("cansaveaspdf");
        let copiable = (multi || openable) && !($active.data("isparentdir"));
        let cutable = deletable;
        let sendable = !multi && type == "file";
        let isElectron = (<any>window).electronRequire;
        let exportable = !this.isLocal && (isElectron ? (multi || id != "parent") : (!multi && type == "file"));
        let attachableToTask = !multi && type == "file";
        this.$filesActions.find("[action-id=open]").prop("disabled", !userCanWrite || !openable || empty || this.isDeletedUserSection);
        this.$filesActions.find("[action-id=delete]").prop("disabled", !userCanWrite || !deletable || empty || this.isDeletedUserSection);
        this.$filesActions.find("[action-id=rename]").prop("disabled", !userCanWrite || !renamable || this.id == "trash" || empty || this.isDeletedUserSection);
        this.$filesActions.find("[action-id=copy]").prop("disabled", !userCanWrite || !copiable || empty);
        this.$filesActions.find("[action-id=cut]").prop("disabled", !userCanWrite || !cutable || empty || this.isDeletedUserSection);
        this.$filesActions.find("[action-id=history]").prop("disabled", !userCanWrite || !hasHistory || empty);
        this.$filesActions.find("[action-id=print]").prop("disabled", !userCanWrite || !printable || empty);
        this.$filesActions.find("[action-id=saveAsPdf]").prop("disabled", !userCanWrite || !canSaveAsPdf || empty);
        this.$filesActions.find("[action-id=send]").prop("disabled", !userCanWrite || !sendable || empty);
        this.$filesActions.find("[action-id=export]").prop("disabled", !userCanWrite || !exportable || empty);
        this.$filesActions.find("[action-id=openExternal]").prop("disabled", !userCanWrite || multi || empty || this.isDeletedUserSection);
        this.$filesActions.find("[action-id=attach-to-task]").prop("disabled", !userCanWrite || !attachableToTask);
        this.$container.find("[data-action=new-note]").prop("disabled", !userCanWrite || this.isDeletedUserSection);
        
        let withTooltip = id == "parent" ? false: !deletable;
        let $delBtn = this.$filesActions.find("[action-id=delete]");
        $delBtn.parent().toggleClass("selection-not-fully-deletable", withTooltip);
        $delBtn.toggleClass("selection-fully-deletable", !withTooltip);
        if (!$delBtn.data("orig-title-text")) {
            $delBtn.data("orig-title-text", $delBtn.attr("title"));
        }
        $delBtn.attr("title", !withTooltip ? $delBtn.data("orig-title-text") : "");
        this.scrollViewIfNeeded();
    }
    
    areAllElements(action: string, $elements: JQuery): boolean {
        for (let i = $elements.length - 1; i >= 0; --i) {
            if (!$elements.eq(i).data(action)) {
                return false;
            }
        }
        return true;
    }
    
    onFileEntryClick(e: MouseEvent) {
        let $entry = <JQuery>$(e.target).closest("[data-id]");
        let id = $entry.data("id");
        if (e.ctrlKey) {
            this.triggerEvent("ctrlClickFile", id);
        }
        else if (e.shiftKey) {
            let idsToSelect: string[] = [];
            let $active = this.$filesList.find(".active");
            let $items = $active.parent().children();
            let idx1 = $items.index($active);
            let idx2 = $items.index($entry);
            if (idx1 > idx2) {
                let tmp = idx1;
                idx1 = idx2;
                idx2 = tmp;
            }
            for (let idx = idx1; idx <= idx2; ++idx) {
                idsToSelect.push($items.eq(idx).data("id"));
            }
            this.triggerEvent("selectEntries", JSON.stringify(idsToSelect), id);
        }
        else {
            this.triggerEvent("setActiveFile", id);
        }
        if (this.lastClickTid && this.lastClickId == id) {
            clearTimeout(this.lastClickTid);
            this.lastClickTid = null;
            this.lastClickId = null;
            this.triggerEvent("fileAction", "openExternal");
        }
        else {
            this.lastClickId = id;
            this.lastClickTid = setTimeout(() => {
                this.lastClickTid = null;
                this.lastClickId = null;
                //Single click - do nothing, active already selected
            }, FilesListView.DOUBLE_CLICK_TIME);
        }
    }
    
    onResize(): void {
        if (!this.$filesList) {
            return;
        }
        this.$filesList.toggleClass("narrow", this.$filesList.outerWidth() < 300);
        // this.$filesList.toggleClass("very-narrow", this.$filesList.outerWidth() < 200);
        if (! this.asFileChooser) {
            this.$filesList.children(".files-container").css("bottom", this.$filesList.children(".files-actions-container").outerHeight() + "px");
        }
        else {
            this.$filesList.children(".files-container").css("bottom", "0");
        }
    }
    
    onFileActionClick(e: MouseEvent): void {
        let id = $(e.target).closest("[action-id]").attr("action-id");
        this.triggerEvent("fileAction", id);
    }
    
    onToggleViewModeClick(): void {
        this.updateViewMode(this.viewMode == "table" ? "tiles" : "table");
        this.triggerEvent("viewModeChanged", this.viewMode);
    }
    
    onMarkAllAsReadClick(e: MouseEvent): void {
        e.stopPropagation();
        if ((<HTMLElement>e.currentTarget).classList.contains("disabled")) {
            return;
        }
        this.triggerEvent("markAllAsRead");
        this.$settingsMenu.removeClass("visible");
    }
    
    onExportAllFilesClick(e: MouseEvent): void {
        e.stopPropagation();
        if ((<HTMLElement>e.currentTarget).classList.contains("disabled")) {
            return;
        }
        this.triggerEvent("fileAction", "exportFiles");
        this.$settingsMenu.removeClass("visible");
    }
    
    onEmptyTrashClick(e: MouseEvent): void {
        e.stopPropagation();
        if ((<HTMLElement>e.currentTarget).classList.contains("disabled")) {
            return;
        }
        this.triggerEvent("fileAction", "empty-trash");
        this.$settingsMenu.removeClass("visible");
    }
    
    onAddDirToPlaylistClick(e: MouseEvent): void {
        e.stopPropagation();
        if ((<HTMLElement>e.currentTarget).classList.contains("disabled")) {
            return;
        }
        this.triggerEvent("addDirToPlaylist");
        this.$settingsMenu.removeClass("visible");
    }
    
    updateViewMode(viewMode: ViewMode) {
        this.viewMode = viewMode;
        this.$filesList.toggleClass("view-mode-table", viewMode == "table");
        this.$filesList.toggleClass("view-mode-tiles", viewMode == "tiles");
        this.$container.find("[data-action=toggle-view-mode] i.fa").toggleClass("fa-align-justify", viewMode == "tiles");
        this.$container.find("[data-action=toggle-view-mode] i.fa").toggleClass("fa-th", viewMode == "table");
        this.updateSplitFileNames();
    }
    
    updateSplitFileNames() {
        let firstLen = 14;
        let lastLen = 8;
        this.$filesList.find(".file-name-text").each((_, el) => {
            let $el = $(el);
            if ($el.children().length == 0) {
                let text = $el.text().trim();
                let a = text.substr(0, firstLen);
                let b = text.substr(firstLen, Math.max(0, text.length - firstLen - lastLen));
                let c = text.substr(a.length + b.length);
                if (b.length <= 3) {
                    a += b;
                    b = "";
                }
                let html = '<span class="first">' + this.parent.helper.escapeHtml(a) + '</span>';
                html += '<span class="middle">' + this.parent.helper.escapeHtml(b) + '</span>';
                html += '<span class="dots">' + (b.length == 0 ? "" : "...") + '</span>';
                html += '<span class="last">' + this.parent.helper.escapeHtml(c) + '</span>';
                $el.html(html);
                $el.attr("title", text);
            }
        });
    }
    
    updateSettingsMenu(): void {
        let $entries = this.$container.find(".file-entry");
        let $items = this.$container.find(".context-menu-settings").find(".context-menu-settings-content").children("li");
        $items.filter("[data-action=empty-trash]").toggleClass("disabled", $entries.length == 0);
        $items.filter("[data-action=mark-all-as-read]").toggleClass("disabled", $entries.filter(".unread").length == 0);
        $items.filter("[data-action=export-files]").toggleClass("disabled", $entries.length == 0);
        $items.filter("[data-action=add-dir-to-playlist]").toggleClass("disabled", $entries.find(".fa-music").length == 0);
    }
    
    getRowSize(): number {
        let $trs = this.$filesList.find("tr");
        let rowSize = $trs.length;
        $trs.each((idx, el) => {
            if (idx > 0 && $(el).position().left < 10) {
                rowSize = idx;
                return false;
            }
        });
        return Math.max(1, rowSize);
    }
    
    onClipboardChange(hasElement: boolean): void {
        this.$filesActions.find(".action-item[action-id='paste']").prop("disabled", !hasElement);
    }
    
    onMoveCursorUp() {
        this.triggerEvent("moveCursorUp");
    }
    
    onMoveCursorDown() {
        this.triggerEvent("moveCursorDown");
    }
    
    scrollViewIfNeeded() {
        let $elem = this.files.$container.find(".file-entry.active");
        if ($elem.length == 0) {
            return;
        }
        let parent = $elem.closest(".files-container .pf-content")[0];
        let parentBB = parent.getBoundingClientRect();
        let ele = $elem[0];
        let eleBB = ele.getBoundingClientRect();
        if (eleBB.top < parentBB.top) {
            parent.scrollTop += eleBB.top - parentBB.top;
        }
        else if (eleBB.bottom > parentBB.bottom) {
            parent.scrollTop += eleBB.bottom - parentBB.bottom;
        }
    }
    
    onOpenChatClick(): void {
        this.triggerEvent("openChat");
    }
    
    onOpenTasksClick(): void {
        this.triggerEvent("openTasks");
    }
    
    onNewNoteClick(): void {
        if (!this.editable) {
            this.triggerEventInTheSameTick("menuAction", "upload");
            return;
        }
        let model: ActionsModel = {
            items: [
                {
                    id: "new-text-note-window",
                    labelKey: "plugin.notes2.component.filesList.newTextNote.title",
                    icon: "fa fa-font"
                },
                {
                    id: "new-mindmap-window",
                    labelKey: "plugin.notes2.component.filesList.newMindmap.title",
                    icon: "privmx-icon privmx-icon-mindmap"
                },
                {
                    isSeparator: true,
                },
                {
                    id: "new-directory",
                    labelKey: "plugin.notes2.component.filesList.newDirectory.title",
                    icon: "fa fa-folder-o",
                    hidden: this.isAll
                },
                {
                    isSeparator: true,
                    hidden: this.isLocal,
                },
                {
                    id: "upload",
                    labelKey: this.systemLabel ? "plugin.notes2.component.filesList.actions.upload.osSpecific." + this.systemLabel : "plugin.notes2.component.filesList.actions.upload",
                    icon: "fa fa-upload",
                    hidden: this.isLocal
                }
            ]
        };
        this.dropdown = new component.dropdown.Dropdown({
            model: model,
            template: this.templateManager.createTemplate(actionsMenuTemplate),
            $container: this.$container.find(".button-container"),
            templateManager: this.templateManager
        });
        this.$container.find(".component-dropdown").css("margin-left", "-133px");
        this.$container.find(".component-dropdown").addClass("to-right");
    }
    
    onActionsMenuClick(event: MouseEvent) {
        event.stopPropagation();
        let $trigger = $(event.target).closest("[data-action-id]");
        let id = $trigger.data("action-id");
        if (this.dropdown) {
            this.dropdown.destroy();
            this.dropdown = null;
        }
        this.triggerEventInTheSameTick("menuAction", id);
    }
    
    onOpenSettingsClick(e: MouseEvent): void {
        let $btn = <JQuery>$(e.currentTarget);
        this.$settingsMenu.addClass("visible");
        let x = $btn.offset().left + $btn.outerWidth() / 2 - this.$settingsMenu.find(".context-menu-settings-content").outerWidth();
        let y = $btn.offset().top + $btn.outerHeight();
        this.$settingsMenu.css("left", x).css("top", y);
    }
    
    onCloseSettingsClick(): void {
        this.$settingsMenu.removeClass("visible");
    }

    onSettingClick(e: MouseEvent): void {
        let $el = <JQuery>$(e.currentTarget);
        let setting = $el.data("setting");
        this.triggerEvent("toggleSetting", setting);
    }
    
    refreshPath(path: string) {
        let $header = this.$container.find(".files-header");
        let $path = $header.find(".current-path");
        if (this.isTrash && path && path.indexOf(FilesConst.TRASH_PATH) == 0) {
            path = path.substr(7);
        }
        let showPath = !!path && path != "/";
        $header.toggleClass("with-path", showPath);
        $path.toggleClass("hide", !showPath);
        this.parent.elementEllipsis($path, path, true);
    }
    
    onTaskClick(e: MouseEvent): void {
        if ($.contains(this.taskChooser.$main[0], <any>e.target)) {
            return;
        }
        let $ele = $(e.target);
        let taskId = $ele.closest("[data-task-id]").data("task-id");
        let entryId = $ele.closest("[data-id]").data("id");
        this.taskChooser.movePopup(e.pageX,  e.pageY, 300, 150);
        this.triggerEvent("openTask", entryId, taskId);
    }
    
    onKeydown(e: KeyboardEvent): void {
        if (this.taskChooser.$main.hasClass("visible")) {
            return;
        }
        let rowSize = this.getRowSize();
        let viewMode = this.viewMode;
        let selectionChangeMode = FilesListView.getSelectionChangeMode(e.shiftKey, e.altKey);
        if (e.keyCode === webUtils.KEY_CODES.upArrow) {
            e.preventDefault();
            this.triggerEvent("fileAction", "up", viewMode, rowSize, selectionChangeMode);
        }
        else if (e.keyCode === webUtils.KEY_CODES.downArrow) {
            e.preventDefault();
            this.triggerEvent("fileAction", "down", viewMode, rowSize, selectionChangeMode);
        }
        else if (e.keyCode === webUtils.KEY_CODES.leftArrow) {
            e.preventDefault();
            this.triggerEvent("fileAction", "left", viewMode, rowSize, selectionChangeMode);
        }
        else if (e.keyCode === webUtils.KEY_CODES.rightArrow) {
            e.preventDefault();
            this.triggerEvent("fileAction", "right", viewMode, rowSize, selectionChangeMode);
        }
        else if (e.keyCode === webUtils.KEY_CODES.enter) {
            e.preventDefault();
            this.triggerEvent("fileAction", "openExternal");
        }
        else if (e.keyCode === webUtils.KEY_CODES.backspace) {
            e.preventDefault();
            this.triggerEvent("fileAction", "goToRoot");
        }
        else if (e.keyCode == webUtils.KEY_CODES.c && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.triggerEvent("fileAction", "copy");
        }
        else if (e.keyCode == webUtils.KEY_CODES.v && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.triggerEvent("fileAction", "paste");
        }
        else if (e.keyCode == webUtils.KEY_CODES.x && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.triggerEvent("fileAction", "cut");
        }
        else if (e.keyCode == webUtils.KEY_CODES.f2) {
            e.preventDefault();
            this.triggerEvent("fileAction", "rename");
        }
        else if (e.keyCode == webUtils.KEY_CODES.delete) {
            e.preventDefault();
            this.triggerEvent("fileAction", "delete");
        }
        else if (e.keyCode == webUtils.KEY_CODES.f7) {
            e.preventDefault();
            this.triggerEvent("fileAction", "exportFiles");
        }
        else if (e.keyCode == webUtils.KEY_CODES.f8) {
            e.preventDefault();
            this.triggerEvent("fileAction", "history");
        }
        else if (e.keyCode == webUtils.KEY_CODES.f9) {
            e.preventDefault();
            this.triggerEvent("fileAction", "export");
        }
        else if (e.keyCode == webUtils.KEY_CODES.f5) {
            e.preventDefault();
            this.triggerEvent("fileAction", "refresh");
        }
    }

    updateSetting(name: string, value: boolean) {
        this.$filesList.find("[data-setting='" + name + "']").find("input[type=checkbox]").prop("checked", value);
    }
    
    setSelectedIds(idsStr: string): void {
        this.selectedFileIds = JSON.parse(idsStr);
        this.$filesList.find(".file-entry.selected").removeClass("selected");
        this.addSelectedItemClasses();
    }
    
    addSelectedItemClasses(): void {
        let $entries = this.$filesList.find(".file-entry");
        let entriesById: { [id: string]: JQuery } = {};
        for (let i = $entries.length - 1; i >= 0; --i) {
            let $entry = $entries.eq(i);
            entriesById[$entry.data("id")] = $entry;
        }
        for (let fileId of this.selectedFileIds) {
            let $entry = entriesById[fileId];
            if ($entry) {
                $entry.addClass("selected");
            }
        }
        this.updateButtonsState();
    }
    
    updateCustomSectionName(customSectionName: string): void {
        // let $curr = this.$filesHeader.find(".conversation-element.conversation");
        // let convTemplate = this.templateManager.createTemplate(component.template.conversation);
        // this.model.convModel.customName = customSectionName;
        // $curr.replaceWith(convTemplate.renderToJQ(this.model.convModel));
        // this.personsComponent.refreshAvatars();
    }
    
    refreshConvHeader(): void {
        let convTemplate = this.templateManager.createTemplate(component.template.conversation);
        this.$container.find(".files-header")[0].innerHTML = this.templateManager.createTemplate(filesListTemplate).renderToJQ(this.model, convTemplate)[0].querySelector(".files-header").innerHTML;
        this.personsComponent.refreshAvatars();
    }
    
    onAddPersonClick(e: MouseEvent): void {
        if ($(e.currentTarget).is("button.disabled")) {
            return;
        }
        this.triggerEvent("addPerson");
    }
    
    onRemovePersonClick(e: MouseEvent): void {
        let hashmail = $(e.currentTarget).data("hashmail") || $(e.currentTarget).data("hashmail-image");
        this.triggerEvent("removePerson", hashmail);
    }
    
    static getSelectionChangeMode(shiftKey: boolean, altKey: boolean): SelectionChangeMode {
        if (shiftKey) {
            return altKey ? SelectionChangeMode.SHRINK : SelectionChangeMode.EXTEND;
        }
        return SelectionChangeMode.CHANGE;
    }
    
    updateLockInfoOnActionButtons(locked: boolean, canUnlock: boolean): void {
        let unlockAvail = locked && canUnlock;
        this.$filesActions.find("[action-id=unlock]").toggleClass("hide", !unlockAvail);
        this.$filesActions.find("[action-id=lock]").toggleClass("hide", locked);
    }
}
