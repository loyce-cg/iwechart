import { component, JQuery as $, Q, Types, webUtils, Starter } from "pmc-web";
import { Model, InternalModel, TaskOutOfSync } from "./TaskPanelController";
import { func as mainTemplate } from "./template/main.html";
import { func as taskTemplate } from "./template/task.html";
import { func as customSelectTaskStatusTemplate } from "./template/customSelectTaskStatus.html";
import { func as iconTemplate } from "../../window/taskGroupForm/template/icon.html";
import { TaskId, AttachmentId } from "../../main/Types";
import { CUSTOM_SELECT_CUSTOM_TEMPLATE_TASK_STATUS } from "./Types";

interface InitialData {
    [key: string]: any;
    status: string;
    project: string;
    taskGroups: string;
    assignedTo: string;
    description: string;
    comment: string;
    attachments: string;
    startDateStr: string;
    endDateStr: string;
}

export class TaskPanelView extends component.base.ComponentView {
    
    $container: JQuery;
    $taskLabel: JQuery;
    $taskName: JQuery;
    $taskListsBadges: JQuery;
    $assignedToList: JQuery;
    $taskScrollable: JQuery;
    $leftScrollable: JQuery;
    $rightScrollable: JQuery;
    $main: JQuery;
    internalModel: InternalModel;
    taskId: TaskId;
    obtainedTaskId: TaskId = null;
    descriptionEditor: webUtils.ContentEditableEditor;
    commentEditor: webUtils.ContentEditableEditor;
    
    customSelectProject: component.customselect.CustomSelectView;
    customSelectTaskGroup: component.customselect.CustomSelectView;
    customSelectAssignedTo: component.customselect.CustomSelectView;
    customSelectType: component.customselect.CustomSelectView;
    customSelectStatus: component.customselect.CustomSelectView;
    customSelectPriority: component.customselect.CustomSelectView;
    dateTimePicker: any;
    dateTimePicker2: any;
    
    // personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    notifications: component.notification.NotificationView;
    taskTooltip: component.tasktooltip.TaskTooltipView;
    sectionTooltip: component.sectiontooltip.SectionTooltipView;
    encryptionEffectTaskText: component.encryptioneffect.EncryptionEffectView;
    encryptionEffectCommentText: component.encryptioneffect.EncryptionEffectView;
    initializedDeferred: Q.Deferred<void> = Q.defer();
    usersRenderedHandler = () => {};
    
    scrolledToComments: boolean = false;
    hasNewComment: boolean = false;
    helper: webUtils.MailClientViewHelper;
    
    dirty: boolean = false;
    dirtyPropsStr: string = "[]";
    initialData: InitialData;
    editStartTarget: string = null;
    pasteSeemsFileSource: "description" | "comment" = null;
    clearCommentOnUpdate: boolean = false;
    
    constructor(parent: Types.app.ViewParent, public personsComponent: component.persons.PersonsView) {
        super(parent);
        let p = <any>parent;
        // this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, p.helper));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        this.notifications = this.addComponent("notifications", new component.notification.NotificationView(this, {xs: true}));
        this.taskTooltip = this.addComponent("tasktooltip", new component.tasktooltip.TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => { if (this.personsComponent) { this.personsComponent.refreshAvatars(); } };
        this.sectionTooltip = this.addComponent("sectiontooltip", new component.sectiontooltip.SectionTooltipView(this));
        this.encryptionEffectTaskText = this.addComponent("encryptionEffectTaskText", new component.encryptioneffect.EncryptionEffectView(this));
        this.encryptionEffectCommentText = this.addComponent("encryptionEffectCommentText", new component.encryptioneffect.EncryptionEffectView(this));
        this.onUsersRendered(() => {
            if (this.personsComponent) {
                this.personsComponent.refreshAvatars();
            }
            return <any>null;
        });
        Starter.dispatchEvent({
            type: "request-date-time-picker-view",
            parent: this,
            name: "dateTimePicker",
        });
        Starter.dispatchEvent({
            type: "request-date-time-picker-view",
            parent: this,
            name: "dateTimePicker2",
        });
    }
    
    init(model: Model): any {
        this.setModel(model);
        
        let tpl = this.templateManager.createTemplate(mainTemplate);
        this.$main = tpl.renderToJQ(this.internalModel);
        this.updateHistoryHeight();
        this.helper = tpl.helper;
        this.$container.empty().append(this.$main);
        this.renderOverlayButtons();
        
        this.$taskLabel = this.$main.find(".task-label");
        this.$taskName = this.$main.find(".task-name");
        this.$taskListsBadges = this.$main.find(".task-lists-badges");
        this.$assignedToList = this.$main.find("ul.assigned-to");
        this.$taskScrollable = this.$main.find(".scrollable-content");
        this.$leftScrollable = this.$main.find(".scrollable-content-left");
        this.$rightScrollable = this.$main.find(".scrollable-content-right");
        
        this.$main.on("click", "button.edit-save", () => this.onSaveEditClick(true));
        this.$main.on("click", "button.edit-cancel", this.onCancelEditClick.bind(this));
        this.$main.on("click", "button.edit,[data-action='edit']", this.onEditClick.bind(this));
        this.$main.on("click", "button.delete,[data-action='delete']", this.onDeleteClick.bind(this));
        this.$main.on("click", ".toggle-marked-as-read,[data-action='toggle-marked-as-read']", this.onToggleMarkedAsReadClick.bind(this));
        this.$main.on("click", "button.restore-from-trash,[data-action='restore-from-trash']", this.onRestoreFromTrashClick.bind(this));
        this.$main.on("click", "[data-action=task-history-revert]", this.onRevertClick.bind(this));
        this.$main.on("click", "[data-action=task-history-more]", this.onMoreClick.bind(this));
        this.$main.on("click", "[data-trigger=\"add-comment\"]", this.onAddCommentClick.bind(this));
        this.$main.on("click", ".add-attachment,[data-action='add-attachment']", this.onAddAttachmentClick.bind(this));
        this.$main.on("click", ".add-calendar,[data-action='add-calendar']", this.onAddCalendarClick.bind(this));
        this.$main.on("click", "li.calendar-start", this.onCalendar1Click.bind(this));
        this.$main.on("click", "li.calendar-end", this.onCalendar2Click.bind(this));
        this.$main.on("click", ".remove-from-calendar", this.onRemoveFromCalendarClick.bind(this));
        this.$main.on("click", ".calendar-enable-hours", this.onCalendarWholeDaysClick.bind(this));
        this.$main.on("click", "span[data-did]", this.onOpenAttachmentClick.bind(this));
        this.$main.on("click", "i[data-did]", this.onDeleteAttachmentClick.bind(this));
        this.$main.on("input", "#task-description", this.onTaskDescriptionInput.bind(this));
        this.$main.on("paste", "#task-description", this.onTaskDescriptionInput.bind(this));
        this.$main.on("input", "#new-comment-text", this.onTaskCommentInput.bind(this));
        this.$main.on("keydown", this.onKeyDown.bind(this));
        this.$main.on("change", "#enter-saves-task", this.onEnterSavesTaskChange.bind(this));
        this.$main.on("change", "#enter-adds-comment", this.onEnterAddsCommentChange.bind(this));
        this.$main.on("click", ".component-custom-select-main.disabled", this.onDisabledCustomSelectClick.bind(this));
        this.$main.on("click", ".make-editable[data-editable-target]", this.onMakeEditableClick.bind(this));
        this.$main.on("dblclick", "#task-description-ro", this.onMakeEditableClick.bind(this));
        this.$container.on("click", ".message-quote-toggle", this.onMessageQuoteToggleClick.bind(this));
        this.$main.on("click", ".message-text-from-user .task-label", this.onTaskLabelClick.bind(this));
        $(window).on("resize", () => {
            this.updateHistoryHeight();
        });
        
        this.customSelectProject = this.addComponent("customSelectProject", new component.customselect.CustomSelectView(this, {})).onChange(this.onProjectSelectChange.bind(this));
        this.customSelectTaskGroup = this.addComponent("customSelectTaskGroup", new component.customselect.CustomSelectView(this, {})).onChange(this.onTaskGroupSelectChange.bind(this));
        this.customSelectAssignedTo = this.addComponent("customSelectAssignedTo", new component.customselect.CustomSelectView(this, {})).onChange(this.onAssignedToSelectChange.bind(this));
        this.customSelectType = this.addComponent("customSelectType", new component.customselect.CustomSelectView(this, {})).onChange(this.onTypeSelectChange.bind(this));
        this.customSelectStatus = this.addComponent("customSelectStatus", new component.customselect.CustomSelectView(this, {
            customItemTemplates: {
                [CUSTOM_SELECT_CUSTOM_TEMPLATE_TASK_STATUS]: this.templateManager.createTemplate(customSelectTaskStatusTemplate),
            },
        })).onChange(this.onStatusSelectChange.bind(this));
        this.customSelectPriority = this.addComponent("customSelectPriority", new component.customselect.CustomSelectView(this, {})).onChange(this.onPrioritySelectChange.bind(this));
        this.customSelectProject.refreshAvatars = this.refreshAvatars.bind(this);
        this.customSelectTaskGroup.refreshAvatars = this.refreshAvatars.bind(this);
        this.customSelectAssignedTo.refreshAvatars = this.refreshAvatars.bind(this);
        this.customSelectType.refreshAvatars = this.refreshAvatars.bind(this);
        this.customSelectStatus.refreshAvatars = this.refreshAvatars.bind(this);
        this.customSelectPriority.refreshAvatars = this.refreshAvatars.bind(this);
        
        // this.personsComponent.$main = this.$main;
        this.personTooltip.init(this.$main);
        
        this.setHorizontalLayout(model.horizontalLayout);
        
        if (this.internalModel.docked && (<any>window).ResizeObserver) {
            let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                if (this.internalModel.editable) {
                    return;
                }
                let entry = entries[0];
                if (entry) {
                    let h = entry.contentRect.height;
                    this.updateDescriptionMaxHeight(h);
                }
            });
            resizeObserver.observe(this.$container[0]);
        }
        
        this.notifications.$container = this.$main.find(".notifications-container-wrapper");
        this.dateTimePicker.$container = this.$main.find(".date-time-picker-container");
        this.dateTimePicker2.$container = this.$main.find(".date-time-picker2-container");
        return <any>Q.all(<any>[
            this.customSelectProject.triggerInit(),
            this.customSelectTaskGroup.triggerInit(),
            this.customSelectAssignedTo.triggerInit(),
            this.customSelectType.triggerInit(),
            this.customSelectStatus.triggerInit(),
            this.customSelectPriority.triggerInit(),
            // this.personsComponent.triggerInit(),
            this.notifications.triggerInit(),
            this.dateTimePicker.triggerInit(),
            this.dateTimePicker2.triggerInit(),
        ])
        .then(() => {
            if (this.internalModel.hasTask) {
                this.update();
            }
            this.usersRenderedHandler();
            this.$main.find("#task-description").focus();
            setTimeout(() => {
                this.$main.find("#task-description").focus();
            }, 15);
            return Q.resolve();
        })
        .then(() => {
            this.taskTooltip.$container = this.$main;
            return this.taskTooltip.triggerInit();
        })
        .then(() => {
            this.sectionTooltip.refreshAvatars = this.refreshAvatars.bind(this);
            this.sectionTooltip.$container = this.$main;
            return this.sectionTooltip.triggerInit();
        })
        .then(() => {
            this.setEncryptionEffectElements();
            return Q.all([
                this.encryptionEffectTaskText.triggerInit(),
                this.encryptionEffectCommentText.triggerInit(),
            ])
        })
        .then(() => {
            this.initialData = this.getInitialData();
            this.updateDirty();
        });
    }
    
    renderOverlayButtons(): void {
        if (!this.$main || this.$main.length == 0) {
            return;
        }
        let model = this.internalModel;
        let helper = this.templateManager.getHelperByClass(webUtils.MailClientViewHelper);
        let $buttons = this.templateManager.createTemplate(component.template.buttons).renderToJQ({
            enabled: model.taskExists && !model.editable,
            buttons: [
                {
                    action: "edit",
                    enabled: true,
                    icon: null,
                    label: helper.i18n("plugin.tasks.component.taskPanel.floatingButtons.edit")
                },
                {
                    action: "add-attachment",
                    enabled: false,
                    icon: null,
                    label: helper.i18n("plugin.tasks.component.taskPanel.floatingButtons.addAttachment")
                },
                {
                    action: "delete",
                    enabled: !model.newTask,
                    icon: "ico-bin",
                    label: helper.i18n("plugin.tasks.component.taskPanel.floatingButtons.delete")
                },
                {
                    action: "toggle-marked-as-read",
                    enabled: !model.newTask && !model.autoMarkAsRead,
                    icon: null,
                    label: model.isRead ? helper.i18n("plugin.tasks.component.taskPanel.markAsUnread") : helper.i18n("plugin.tasks.component.taskPanel.markAsRead"),
                },
            ]
        }).addClass("buttons");
        this.$main.find(".buttons").replaceWith($buttons);
        webUtils.UI.fadingDiv(this.$main, $buttons, false);
    }
    
    setEncryptionEffectElements(disableButtons: boolean = null): void {
        this.encryptionEffectTaskText.$field = this.$main.find("#task-description");
        this.encryptionEffectTaskText.$button = this.$main.find("button.edit-save");
        this.encryptionEffectCommentText.$field = this.$main.find("#new-comment-text");
        this.encryptionEffectCommentText.$button = this.$main.find("button[data-trigger=add-comment]");
        if (disableButtons) {
            this.encryptionEffectTaskText.$button.prop("disabled", true);
            this.encryptionEffectCommentText.$button.prop("disabled", true);
        }
        else if (disableButtons === false) {
            this.encryptionEffectTaskText.$button.prop("disabled", false);
            this.encryptionEffectCommentText.$button.prop("disabled", false);
        }
    }
    
    registerDateTimePickerView(csName: string, view: any): void {
        if (csName == "dateTimePicker") {
            this.dateTimePicker = this.addComponent("dateTimePicker", view);
        }
        else if (csName == "dateTimePicker2") {
            this.dateTimePicker2 = this.addComponent("dateTimePicker2", view);
        }
    }
    updateDescriptionMaxHeight(h: number) {
        if (!this.internalModel.docked || this.internalModel.editable) {
            return;
        }
        let $descr = this.$main.find(".flex-row.description");
        let $rows = $descr.parent().children(":not(.flex-row.description)");
        let takenH = 0;
        $rows.each((idx, el) => {
            let $el = $(el);
            if (!$el.hasClass("grid-row") || $el.text().trim().length > 0) {
                takenH += $(el).outerHeight(true);
            }
        });
        let availH = Math.max(80, h - takenH);
        $descr.css("max-height", availH + "px");

        let $ad = $rows.filter(".after-description");
        $ad.css("display", $ad.text().trim().length == 0 ? "none" : "grid");
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.key == "Tab") {
            e.preventDefault();
            e.stopPropagation();
            let $focused = this.$main.find(":focus");
            let $focusable = this.$main.find("button.edit-save, button.edit-cancel, .component-custom-select-main, #task-description").filter((idx, el) => {
                let $el = $(el);
                return !$el.hasClass("component-custom-select-main") || (!$el.parent().hasClass("custom-select-type") && !$el.parent().hasClass("custom-select-priority"));
            });
            let focusable: Array<HTMLElement> = [];
            $focusable.each((idx, el) => {
                focusable.push(el);
            });
            let idx = focusable.indexOf($focused[0]);
            if (idx >= 0) {
                idx = (idx + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
                focusable[idx].focus();
            }
        }
        else if (e.key == "Enter") {
            if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                if (!this.internalModel.editable) {
                    this.onAddCommentClick();
                }
                else {
                    this.onSaveEditClick();
                }
            }
        }
        else if (e.key == "s") {
            if (e.ctrlKey || e.metaKey) {
                if (!this.$main.find(".btn.btn-success.edit-save").is("[disabled]")) {
                    e.stopPropagation();
                    if (!this.internalModel.editable) {
                        this.onAddCommentClick();
                    }
                    else {
                        this.onSaveEditClick(false);
                    }
                }
            }
        }
        else if (webUtils.WebUtils.hasCtrlModifier(e) && (e.key == "x" || e.key == "v")) {
            setTimeout(() => {
                this.updateRequiredFields(true);
                this.updateDirty();
            }, 15);
        }
    }
    
    setModel(model: Model) {
        this.internalModel = {
            docked: model.docked,
            newTask: model.newTask,
            isEditTaskWindow: model.isEditTaskWindow,
            canRemoveFromCalendar: model.canRemoveFromCalendar,
            
            hasTask: model.hasTask,
            taskExists: model.taskExists,
            taskId: model.taskId,
            taskDone: model.taskDone,
            taskName: model.taskName,
            taskLabelClass: model.taskLabelClass,
            taskDescription: model.taskDescription,
            taskType: model.taskType,
            taskStatus: model.taskStatus,
            taskPriority: model.taskPriority,
            taskAttachments: JSON.parse(model.taskAttachmentsStr),
            taskAssignedTo: JSON.parse(model.taskAssignedToStr),
            taskAssignedToArray: JSON.parse(model.taskAssignedToArrayStr),
            taskHistory: JSON.parse(model.taskHistoryStr),
            taskGroupIds: JSON.parse(model.taskGroupIdsStr),
            taskGroupNames: JSON.parse(model.taskGroupNamesStr),
            taskGroupsPinned: JSON.parse(model.taskGroupsPinnedStr),
            taskGroupsIcons: JSON.parse(model.taskGroupsIconsStr),
            taskComments: JSON.parse(model.taskCommentsStr),
            taskIsTrashed: model.taskIsTrashed,
            taskStartTimestamp: model.taskStartTimestamp,
            taskEndTimestamp: model.taskEndTimestamp,
            taskWholeDays: model.taskWholeDays,
            projectId: model.projectId,
            projectName: model.projectName,
            projectPrefix: model.projectPrefix,
            projectPublic: model.projectPublic,
            editable: model.editable,
            scrollToComments: model.scrollToComments,
            myAvatar: model.myAvatar,
            enterSavesTask: model.enterSavesTask,
            enterAddsComment: model.enterAddsComment,
            horizontalLayout: model.horizontalLayout,
            
            resolvedTaskHistory: JSON.parse(model.resolvedTaskHistoryStr),
            taskStatuses: JSON.parse(model.taskStatusesStr),
            
            isRead: model.isRead,
            autoMarkAsRead: model.autoMarkAsRead,
            
            hostHash: model.hostHash,
        };
        this.updateAddAttachmentButton();
        this.renderOverlayButtons();
    }
    
    setObtainedTaskId(obtainedTaskId: string) {
        this.obtainedTaskId = obtainedTaskId;
        this.update(null, true);
    }
    
    setAttachments(attachments: Array<AttachmentId>) {
        this.internalModel.taskAttachments = attachments;
        this.update(null, true);
        this.updateDirty();
    }
    
    updateDynamicHeader() {
    }
    
    onTaskDescriptionInput() {
        this.updateDynamicHeader();
        this.updateDirty();
    }
    
    onTaskCommentInput() {
        this.updateDirty();
    }
    
    onUsersRendered(handler: () => {}): void {
        this.usersRenderedHandler = handler;
    }
    
    refreshAvatars(): void {
        if (this.personsComponent) {
            this.personsComponent.refreshAvatars();
        }
    }
    
    onProjectSelectChange(value: string): void {
        this.triggerEvent("dataChanged", "projectId", value);
        this.customSelectProject.$btn.find("canvas").addClass("not-rendered");
        if (this.personsComponent) {
            this.personsComponent.refreshAvatars();
        }
        this.updateRequiredFields(true);
        this.updateDirty();
        this.updateRelatedSection(value);
        this.flashElement(this.customSelectTaskGroup.$main);
        this.flashElement(this.customSelectAssignedTo.$main);
    }
    
    onTaskGroupSelectChange(value: string): void {
        this.triggerEvent("dataChanged", "taskGroupIds", JSON.stringify(value.split(",")));
        this.updateDirty();
    }
    
    onAssignedToSelectChange(value: string): void {
        this.triggerEvent("dataChanged", "assignedTo", value);
        this.customSelectAssignedTo.$btn.find("canvas").addClass("not-rendered");
        this.usersRenderedHandler();
        this.updateDirty();
    }
    
    onTypeSelectChange(value: string): void {
        this.triggerEvent("dataChanged", "type", value);
        this.updateDirty();
    }
    
    onStatusSelectChange(value: string): void {
        this.updateDynamicHeader();
        this.triggerEvent("dataChanged", "status", value);
        this.updateDirty();
    }
    
    onPrioritySelectChange(value: string): void {
        this.triggerEvent("dataChanged", "priority", value);
        this.updateDirty();
    }
    
    setStartDateTime(ts: number): void {
        this.internalModel.taskStartTimestamp = ts;
        this.update(null, true);
        this.updateDirty();
    }
    
    setEndDateTime(ts: number): void {
        this.internalModel.taskEndTimestamp = ts;
        this.update(null, true);
        this.updateDirty();
    }
    
    setWholeDays(wholeDays: boolean): void {
        this.internalModel.taskWholeDays = wholeDays;
        this.update(null, true);
        this.updateDirty();
    }
    
    update(newModel: string = null, dontDisturb: boolean = false, comment: string = null, dataChanged: boolean = false): void {
        let currentComment = this.commentEditor && dataChanged ? this.commentEditor.getValue() : null;
        if (this.clearCommentOnUpdate) {
            this.clearCommentOnUpdate = false;
            currentComment = null;
        }
        let hasNewComment = false;
        let updateInitialData = false;
        if (newModel !== null) {
            let model = JSON.parse(newModel)
            if (model && this.internalModel && this.internalModel.hasTask && this.internalModel.taskExists && this.internalModel.taskId == model.taskId) {
                hasNewComment = JSON.parse(model.taskCommentsStr).length > this.internalModel.taskComments.length;
                if (hasNewComment) {
                    this.hasNewComment = true;
                }
            }
            if (model && this.internalModel && (model.taskId != this.internalModel.taskId || !this.internalModel.editable && model.editable)) {
                updateInitialData = true;
            }
            this.setModel(model);
        }
        
        this.$main.toggleClass("no-task", !this.internalModel.taskExists);
        this.$main.toggleClass("trashed", this.internalModel.taskIsTrashed);
        
        if (this.internalModel.hasTask) {
            this.$main.addClass("has-task");
            this.$main.removeClass("has-multiple-tasks");
        }
        else {
            this.$main.removeClass("has-task");
            if (this.internalModel.taskId === false) {
                this.$main.addClass("has-multiple-tasks");
            } else {
                this.$main.removeClass("has-multiple-tasks");
            }
        }
        
        this.clearStatusClasses(this.$taskLabel);
        this.$taskLabel.addClass(this.internalModel.taskLabelClass + "-color");
        if (typeof(this.internalModel.taskId) == "string") {
            this.$taskLabel.text("#" + this.internalModel.taskId.substr(0, 5));
        }
        if (this.internalModel.taskDone) {
            this.$taskLabel.addClass("done");
        }
        else {
            this.$taskLabel.removeClass("done");
        }
        this.$taskName.text(this.internalModel.editable ? this.internalModel.taskName : this.internalModel.taskStatus);
        this.clearStatusClasses(this.$taskName);
        if (!this.internalModel.editable) {
            this.$taskName.addClass(this.internalModel.taskLabelClass + "-color");
        }
        
        let html = "";
        let tpl = this.templateManager.createTemplate(iconTemplate);
        for (let id in this.internalModel.taskGroupNames) {
            let name = this.internalModel.taskGroupNames[id];
            let pinned = this.internalModel.taskGroupsPinned.indexOf(this.internalModel.taskGroupIds[id]) >= 0;
            let icon = this.internalModel.taskGroupsIcons[id];
            let iconStr = icon ? tpl.render(icon) : "";
            html += '<li><span class="taskgroup-label ' + (pinned?"pinned":"") + '" data-taskgroup-id="' + this.internalModel.taskGroupIds[id] + '" title="' + name + '"><span>' + iconStr + '</span><span>' + name + '</span></span></li>';
        }
        this.$taskListsBadges.html(html);
        
        let $tpl = this.templateManager.createTemplate(taskTemplate).renderToJQ(this.internalModel);
        if (dontDisturb) {
            let oldComment = this.getEditorValue(this.commentEditor);
            this.$taskScrollable.find("div.history.comments").html($tpl.find("div.history.comments>.history-grid>.pf-content").html());
            this.$taskScrollable.find(".flex-row.attachments").html($tpl.find(".flex-row.attachments").html());
            this.$taskScrollable.find(".flex-row.calendar").html($tpl.find(".flex-row.calendar").html());
            this.commentEditor = new webUtils.ContentEditableEditor(this.$main.find("#new-comment-text"), {
                disallowTab: true,
                onRequestTaskPicker: (...args: any[]) => {
                    (<any>this.parent).onTaskPickerResult(this.commentEditor.onTaskPickerResult.bind(this.commentEditor));
                    return (<any>this.parent).onRequestTaskPicker(...args);
                },
                onRequestFilePicker: (...args: any[]) => {
                    (<any>this.parent).onFilePickerResult(this.commentEditor.onFilePickerResult.bind(this.commentEditor));
                    return (<any>this.parent).onRequestFilePicker(...args);
                },
                relatedHostHash: this.getCurrentHostHash(),
                relatedSectionId: this.getCurrentSectionId(),
            });
            if (oldComment != null) {
                this.commentEditor.setValue(oldComment);
            }
        }
        else {
            if (!this.$taskScrollable.is(".pf-content")) {
                let $tmp = this.$taskScrollable.children(".pf-content");
                if ($tmp.length > 0) {
                    this.$taskScrollable = $tmp;
                }
            }
            this.$taskScrollable.empty().append($tpl);
            this.$leftScrollable = this.$main.find(".scrollable-content-left");
            this.$rightScrollable = this.$main.find(".scrollable-content-right");
            this.setHorizontalLayout(this.internalModel.horizontalLayout);
            this.customSelectProject.setContainer(this.$main.find(".custom-select-project"));
            this.customSelectTaskGroup.setContainer(this.$main.find(".custom-select-taskgroup"));
            this.customSelectAssignedTo.setContainer(this.$main.find(".custom-select-assignedto"));
            this.customSelectType.setContainer(this.$main.find(".custom-select-type"));
            this.customSelectStatus.setContainer(this.$main.find(".custom-select-status"));
            this.customSelectPriority.setContainer(this.$main.find(".custom-select-priority"));
            this.descriptionEditor = new webUtils.ContentEditableEditor(this.$main.find("#task-description"), {
                disallowTab: true,
                onInput: () => {
                    this.updateRequiredFields(true);
                    this.updateDirty();
                },
                onChange: () => {
                    this.updateRequiredFields(true);
                    this.updateDirty();
                },
                // onPasteSeemsEmpty: this.onPasteSeemsEmpty.bind(this),
                // onPasteSeemsFile: (paths, originalText) => {
                //     this.pasteSeemsFileSource = "description";
                //     this.onPasteSeemsFile(paths, originalText);
                // },
                onRequestTaskPicker: (...args: any[]) => {
                    (<any>this.parent).onTaskPickerResult(this.descriptionEditor.onTaskPickerResult.bind(this.descriptionEditor));
                    return (<any>this.parent).onRequestTaskPicker(...args);
                },
                onRequestFilePicker: (...args: any[]) => {
                    (<any>this.parent).onFilePickerResult(this.descriptionEditor.onFilePickerResult.bind(this.descriptionEditor));
                    return (<any>this.parent).onRequestFilePicker(...args);
                },
                relatedHostHash: this.getCurrentHostHash(),
                relatedSectionId: this.getCurrentSectionId(),
            });
            this.commentEditor = new webUtils.ContentEditableEditor(this.$main.find("#new-comment-text"), {
                disallowTab: true,
                onInput: () => {
                    this.updateDirty();
                },
                onChange: () => {
                    this.updateDirty();
                },
                // onPasteSeemsEmpty: this.onPasteSeemsEmpty.bind(this),
                // onPasteSeemsFile: (paths, originalText) => {
                //     this.pasteSeemsFileSource = "comment";
                //     this.onPasteSeemsFile(paths, originalText);
                // },
                onRequestTaskPicker: (...args: any[]) => {
                    (<any>this.parent).onTaskPickerResult(this.commentEditor.onTaskPickerResult.bind(this.commentEditor));
                    return (<any>this.parent).onRequestTaskPicker(...args);
                },
                onRequestFilePicker: (...args: any[]) => {
                    (<any>this.parent).onFilePickerResult(this.commentEditor.onFilePickerResult.bind(this.commentEditor));
                    return (<any>this.parent).onRequestFilePicker(...args);
                },
                relatedHostHash: this.getCurrentHostHash(),
                relatedSectionId: this.getCurrentSectionId(),
            });
            this.descriptionEditor.setValue(webUtils.ContentEditableEditor.safeHtml2(this.internalModel.taskDescription, true));
            // let $p = this.descriptionEditor.$elem.parent();
            // this.descriptionEditor.$elem.remove();
            // $p.prepend(this.descriptionEditor.$elem)
            if (!this.internalModel.editable && currentComment) {
                this.commentEditor.setValue(currentComment);
            }
        }
        
        if (this.internalModel.taskId != this.taskId) {
            this.taskId = <any>this.internalModel.taskId;
            this.$taskScrollable.scrollTop(0);
        }
        
        let hasComments = this.internalModel.taskComments && this.internalModel.taskComments.length > 0;
        let hasAttachments = this.internalModel.taskAttachments && this.internalModel.taskAttachments.length > 0;
        let hasCalendar = !!this.internalModel.taskStartTimestamp;
        let hasAssignedTo = this.internalModel.taskAssignedToArray.length > 0;
        this.$main.toggleClass("has-comments", hasComments);
        this.$main.toggleClass("no-comments", !hasComments);
        this.$main.toggleClass("has-attachments", hasAttachments);
        this.$main.toggleClass("no-attachments", !hasAttachments);
        this.$main.toggleClass("has-calendar", hasCalendar);
        this.$main.toggleClass("no-calendar", !hasCalendar);
        this.$main.toggleClass("has-assigned-to", hasAssignedTo);
        this.$main.toggleClass("no-assigned-to", !hasAssignedTo);
        
        html = "";
        for (let person of this.internalModel.taskAssignedToArray) {
            html += '<li class="person"><canvas class="not-rendered icon" data-auto-refresh="true" data-auto-size="true" data-hashmail-image="' + person.avatar + '" data-tooltip-trigger="' + person.id + '"></canvas><span>' + person.name + '</span></li>';
        }
        this.$assignedToList.html(html);
        this.$assignedToList.toggleClass("multi", this.internalModel.taskAssignedToArray.length > 1);
        
        this.updateEditableState(updateInitialData);
        this.usersRenderedHandler();
        this.updateDynamicHeader();
        if (this.hasNewComment || hasNewComment || ((this.internalModel.scrollToComments || this.internalModel.horizontalLayout) && (!this.scrolledToComments || this.internalModel.docked))) {
            this.scrollToComments();
            this.scrolledToComments = true;
            if (!hasNewComment) {
                this.hasNewComment = false;
            }
        }
        this.updateAddAttachmentButton();
        this.updateHistoryHeight();
        this.updateDescriptionMaxHeight(this.$container.height());
        if (this.personsComponent) {
            this.personsComponent.refreshAvatars();
        }
        
        if (updateInitialData && this.internalModel.editable) {
            this.initialData = this.getInitialData();
        }
        
        if (this.editStartTarget) {
            let target = this.editStartTarget;
            this.editStartTarget = null;
            if (target == "status") {
                this.openCustomSelect(this.customSelectStatus);
            }
            else if (target == "project") {
                this.openCustomSelect(this.customSelectProject);
            }
            else if (target == "taskGroups") {
                this.openCustomSelect(this.customSelectTaskGroup);
            }
            else if (target == "assignedTo") {
                this.openCustomSelect(this.customSelectAssignedTo);
            }
            else if (target == "attachments") {
                // Nothing
            }
            else if (target == "startTimestamp") {
                this.dateTimePicker.show(this.$container.find(".calendar-start"), this.$main, this.internalModel.taskStartTimestamp, this.internalModel.taskWholeDays);
            }
            else if (target == "endTimestamp") {
                this.dateTimePicker2.show(this.$container.find(".calendar-end"), this.$main, this.internalModel.taskEndTimestamp, this.internalModel.taskWholeDays);
            }
            else if (target == "description") {
                let $el = this.$container.find("#task-description");
                $el.focus();
                let sel = window.document.getSelection();
                sel.removeAllRanges();
                let range = window.document.createRange();
                range.selectNodeContents($el[0]);
                range.collapse(false);
                sel.addRange(range);
            }
        }
        if (comment) {
            this.commentEditor.setValue(comment);
            this.setEncryptionEffectElements(false);
        }
        this.updateRelatedSection(this.internalModel.projectId);
    }
    
    openCustomSelect(cs: component.customselect.CustomSelectView): void {
        cs.toggleOpen();
        if (this.personTooltip.$avatarPlaceholder) {
            this.personTooltip.$avatarPlaceholder.detach();
        }
    }
    
    clearStatusClasses($el: JQuery) {
        if (!$el[0] || !$el[0].classList) {
            return;
        }
        let lst = $el[0].classList;
        let toRm: string[] = [];
        for (let i = lst.length - 1; i >= 0; --i) {
            let cls = lst[i];
            if (cls.indexOf("task-status-") == 0) {
                toRm.push(cls);
            }
        }
        for (let cls of toRm) {
            $el.removeClass(cls);
        }
    }
    
    updateEditableState(updateInitialData: boolean = true): void {
        if (this.internalModel.editable) {
            this.$main.addClass("editable");
            this.$main.removeClass("readonly");
            this.$main.find("#task-description").prop("contenteditable", true);
            if (updateInitialData || !this.initialData) {
                this.initialData = this.getInitialData();
            }
        }
        else {
            this.$main.removeClass("editable");
            this.$main.addClass("readonly");
            this.$main.find("#task-description").prop("contenteditable", false);
        }
    }
    
    onEditClick(): void {
        this.triggerEvent("editClick", this.getEditorValue(this.commentEditor));
    }
    
    onCancelEditClick(): void {
        this.triggerEvent("cancelEditClick");
    }
    
    onSaveEditClick(closeAfterSaving: boolean = true): void {
        this.updateRequiredFields();
        let comment = null;
        comment = this.getEditorValue(this.commentEditor);
        this.setEncryptionEffectElements(true);
        this.clearCommentOnUpdate = true;
        this.triggerEvent("saveEditClick", this.getEditorValue(this.descriptionEditor), comment, closeAfterSaving);
        this.dirty = false;
    }
    
    onDeleteClick(): void {
        this.triggerEvent("deleteClick");
    }
    
    onToggleMarkedAsReadClick(): void {
        this.triggerEvent("toggleMarkedAsRead");
    }
    
    onRestoreFromTrashClick(): void {
        this.triggerEvent("restoreFromTrash");
    }
    
    onRevertClick(e: MouseEvent): void {
        let $el = $(e.currentTarget).parent();
        this.triggerEvent("revertClick", $el.data("history-id"));
    }
    
    onMoreClick(e: MouseEvent): void {
        let $el = $(e.currentTarget).parent();
        $el.find("div.more").toggleClass("hidden");
    }
    
    onAddCommentClick(): void {
        let text = this.getEditorValue(this.commentEditor);
        if (!text || text.trim().length == 0) {
            return;
        }
        this.setEncryptionEffectElements(true);
        this.triggerEvent("addComment", text);
        this.clearCommentOnUpdate = true;
        this.commentEditor.setValue("");
    }
    
    onAddAttachmentClick(): void {
        this.triggerEvent("addAttachment");
    }
    
    onAddCalendarClick(e: MouseEvent): void {
        let mode = $(e.currentTarget).data("mode") || "timeframe";
        if (this.internalModel.editable) {
            this.triggerEvent("addCalendar", mode);
        }
    }
    
    onCalendar1Click(e: MouseEvent): void {
        if (this.internalModel.editable) {
            this.dateTimePicker.show($(e.currentTarget), this.$main, this.internalModel.taskStartTimestamp, this.internalModel.taskWholeDays);
        }
    }
    
    onCalendar2Click(e: MouseEvent): void {
        if (this.internalModel.editable) {
            this.dateTimePicker2.show(this.$container.find(".calendar-end"), this.$main, this.internalModel.taskEndTimestamp, this.internalModel.taskWholeDays);
        }
    }
    
    onRemoveFromCalendarClick(e: MouseEvent): void {
        e.stopImmediatePropagation();
        this.triggerEvent("removeFromCalendar");
    }
    
    onCalendarWholeDaysClick(e: MouseEvent): void {
        let wholeDays = !(<HTMLElement>e.currentTarget).classList.contains("off");
        this.triggerEvent("toggleWholeDays", wholeDays);
        this.setWholeDays(wholeDays);
    }
    
    onOpenAttachmentClick(e: MouseEvent): void {
        let isHistoryEntry = $(e.currentTarget).closest(".history.comments").length > 0;
        if ((<HTMLElement>e.currentTarget).classList.contains("trashed") || (<HTMLElement>e.currentTarget).parentElement.classList.contains("trashed")) {
            return;
        }
        this.triggerEvent("openAttachment", $(e.currentTarget).data("did"), !isHistoryEntry);
    }
    
    onDeleteAttachmentClick(e: MouseEvent): void {
        let did = $(e.currentTarget).data("did");
        this.triggerEvent("delAttachment", did);
        this.internalModel.taskAttachments = this.internalModel.taskAttachments.filter(it => JSON.parse(it).did != did);
    }
    
    removeAttachment(did: string) {
        this.$container.find("i.fa-trash[data-did=" + did + "]").parents("li").first().remove();
        this.updateDirty();
    }
    
    scrollToComments(): void {
        let interval: any;
        let n = 20;
        let func = () => {
            if (n-- < 0) {
                clearInterval(interval);
            }
            let $cnt = this.$container.find(".scrollable-content-right .history-grid").children(".pf-content");
            let $scrollable = this.internalModel.horizontalLayout
                ? ($cnt.length > 0 ? $cnt : this.$container.find(".scrollable-content-right").children(".pf-content"))
                : (this.internalModel.docked ? this.$main.children(".scrollable-content.pf-scrollable").children(".pf-content") : this.$taskScrollable.children(".pf-content"));

            if (this.internalModel.horizontalLayout && this.internalModel.docked) {
                let $scrollable2 = this.$container.find(".scrollable-content-right").children(".pf-content");
                if ($scrollable2.length > 0) {
                    $scrollable2.scrollTop($scrollable2[0].scrollHeight);
                }
            }
            if ($scrollable.length > 0) {
                $scrollable.scrollTop($scrollable[0].scrollHeight);
                clearInterval(interval);
            }
        }
        interval = setInterval(func, 25);
        func();
    }
    
    updatePinnedBadges(listId: string, pinned: boolean) {
        this.$container.find(".taskgroup-label[data-taskgroup-id='" + listId+ "']").toggleClass("pinned", pinned);
    }
    
    updateAttIsTrashed(attIsTrashedStr: string): void {
        let attIsTrashed = JSON.parse(attIsTrashedStr);
        for (let did in attIsTrashed) {
            this.$container.find(".history.comments .link[data-did='" + did + "']").toggleClass("trashed", attIsTrashed);
            this.$container.find(".flex-row.attachments .link[data-did='" + did + "']").parent().toggleClass("trashed", attIsTrashed);
        }
    }
    
    onEnterSavesTaskChange(): void {
        this.setEnterSavesTask(this.$container.find("#enter-saves-task").prop("checked"));
    }
    
    onEnterAddsCommentChange(): void {
        this.setEnterAddsComment(this.$container.find("#enter-adds-comment").prop("checked"));
    }
    
    onDisabledCustomSelectClick(e: MouseEvent): void {
        let $cs = <JQuery>$(e.currentTarget);
        if ($cs.parent().is(".custom-select-taskgroup")) {
            this.$main.find(".custom-select-project").addClass("invalid");
        }
    }
    
    onMakeEditableClick(e: MouseEvent): void {
        if (this.internalModel.editable) {
            return;
        }
        let $el = $(e.currentTarget);
        let target = $el.is("#task-description-ro") ? "description" : $el.data("editable-target");
        if (!target) {
            return;
        }
        this.editStartTarget = target;
        this.triggerEvent("editClick", this.getEditorValue(this.commentEditor));
    }
    
    setEnterSavesTask(value: boolean) {
        if (this.internalModel.enterSavesTask != value) {
            this.internalModel.enterSavesTask = value;
            let $cb = this.$container.find("#enter-saves-task");
            if ($cb.prop("checked") != value) {
                $cb.prop("checked", value);
            }
            this.triggerEvent("setEnterSavesTask", value);
        }
    }
    
    setEnterAddsComment(value: boolean) {
        if (this.internalModel.enterAddsComment != value) {
            this.internalModel.enterAddsComment = value;
            let $cb = this.$container.find("#enter-adds-comment");
            if ($cb.prop("checked") != value) {
                $cb.prop("checked", value);
            }
            this.triggerEvent("setEnterAddsComment", value);
        }
    }
    
    updateRequiredFields(onlyHideInvalidMarker: boolean = false): void {
        if (this.descriptionEditor) {
            let invalid = this.getEditorValueLength(this.descriptionEditor) == 0;
            if (!onlyHideInvalidMarker || !invalid) {
                this.$main.find("#task-description").toggleClass("invalid", invalid);
            }
        }
        
        if (this.customSelectProject) {
            let val = this.customSelectProject.$dropDown.find(".selected");
            let invalid = val.length == 0;
            if (!onlyHideInvalidMarker || !invalid) {
                this.$main.find(".custom-select-project").toggleClass("invalid", invalid);
            }
        }
    }
    
    getEditorValue(editor: webUtils.ContentEditableEditor): string {
        let s = editor && editor.$elem ? editor.getValue() : "";
        s = s.replace(/^(<br\s*\/?>|\s)*/g, "").replace(/(<br\s*\/?>|\s)*$/g, "").trim();
        return s;
    }
    
    getEditorValueLength(editor: webUtils.ContentEditableEditor): number {
        let s = this.getEditorValue(editor);
        return s.replace(/&nbsp;/g, "").replace(/\<br\>/g, "").trim().length;
    }
    
    setHorizontalLayout(horizontal: boolean): void {
        this.internalModel.horizontalLayout = horizontal;
        this.$main.find(".layout-container").toggleClass("flex-row", horizontal);
        this.$main.toggleClass("horizontal-layout", horizontal);
        if (horizontal) {
            (<any>this.$container.find(".scrollable-content")).pfScroll().turnOff();
            (<any>this.$container.find(".scrollable-content-left")).pfScroll().turnOn();
            if (this.internalModel.isEditTaskWindow && this.internalModel.editable && !this.internalModel.docked) {
                (<any>this.$container.find(".scrollable-content-right")).pfScroll().turnOff();
                (<any>this.$container.find(".scrollable-content-right").find(".history-grid")).pfScroll().turnOn();
            }
            else if (this.internalModel.docked) {
                let $el = this.$container.find(".scrollable-content-right").find(".history-grid");
                if (!$el.hasClass("pf-scroll")) {
                    $el.data("pfScroll", null);
                }
                (<any>this.$container.find(".scrollable-content-right")).pfScroll().turnOn();
                (<any>this.$container.find(".scrollable-content-right").find(".history-grid")).pfScroll().turnOn();
            }
            else {
                (<any>this.$container.find(".scrollable-content-right")).pfScroll().turnOn();
                (<any>this.$container.find(".scrollable-content-right").find(".history-grid")).pfScroll().turnOff();
                let $grid = this.$container.find(".scrollable-content-right").find(".history-grid");
                this.breakOutInnerPfScroll();
            }
        }
        else {
            (<any>this.$container.find(".scrollable-content")).pfScroll().turnOn();
            (<any>this.$container.find(".scrollable-content-left")).pfScroll().turnOff();
            (<any>this.$container.find(".scrollable-content-right")).pfScroll().turnOff();
            (<any>this.$container.find(".scrollable-content-right").find(".history-grid")).pfScroll().turnOff();
            this.breakOutInnerPfScroll();
        }
    }
    
    breakOutInnerPfScroll() {
        let $grid = this.$container.find(".scrollable-content-right").find(".history-grid");
        if ($grid.children(".pf-content").length > 0) {
            let $cnt = $grid.children(".pf-content").children();
            $grid.empty();
            $grid.append($cnt);
            $grid.removeClass("pf-scrollable");
        }
    }
    
    setIsEditTaskWindow(isEditTaskWindow: boolean) {
        this.internalModel.isEditTaskWindow = isEditTaskWindow;
        this.$container.toggleClass("edit-task-window", isEditTaskWindow);
    }
    
    updateAddAttachmentButton(): void {
        if (!this.customSelectProject) {
            return;
        }
        let $btn = this.$container.find("button.add-attachment");
        $btn.prop("disabled", this.customSelectProject.items.filter(x => x.type == "item" && x.selected).length == 0);
    }
    
    visualAddAttachment(attInfoStr: string): void {
        this.internalModel.taskAttachments.push(JSON.parse(attInfoStr));
        this.update(null, true);
        this.updateDirty();
    }
    
    onMessageQuoteToggleClick(e: MouseEvent) {
        let $toggle = $(e.target).closest(".message-quote-toggle");
        let visible = $toggle.next().is(":visible");
        $toggle.find("span").html(this.helper.i18n("plugin.tasks.component.taskPanel.quote." + (visible ? "show" : "hide")));
        $toggle.find("i").attr("class", visible ? "fa fa-caret-right" : "fa fa-caret-down");
        $toggle.next().toggle();
    }
    
    onTaskLabelClick(e: MouseEvent): void {
        let $e = $(e.currentTarget);
        let taskId = $e.data("task-id") + "";
        if (taskId) {
            this.triggerEvent("openTask", taskId);
        }
    }
    
    getInitialData(): InitialData {
        return this.customSelectStatus.$container && this.customSelectStatus.$container.find(".item.selected").toArray().map(el => $(el).data("val"))[0] != undefined ? {
            status: this.customSelectStatus.$container.find(".item.selected").toArray().map(el => $(el).data("val"))[0],
            project: this.customSelectProject.$container.find(".item.selected").toArray().map(el => $(el).data("val"))[0],
            taskGroups: JSON.stringify(this.customSelectTaskGroup.$container.find(".item.selected").toArray().map(el => $(el).data("val")).sort()),
            assignedTo: JSON.stringify(this.customSelectAssignedTo.$container.find(".item.selected").toArray().map(el => $(el).data("val")).sort()),
            description: this.getEditorValue(this.descriptionEditor),
            comment: this.getEditorValue(this.commentEditor),
            attachments: JSON.stringify(this.$container.find("div.attachments li.attachment>span.link").toArray().map(it => $(it).data("did")).sort()),
            startDateStr: this.$container.find(".calendar-start").text().trim(),
            endDateStr: this.$container.find(".calendar-end").text().trim(),
        } : null;
    }
    
    setDirty(dirty: boolean): void {
        this.dirty = dirty;
        this.initialData = null;
    }
    
    updateDirty(): void {
        if (!this.initialData) {
            this.initialData = this.getInitialData();
            this.$container.find("button.edit-save").prop("disabled", !this.dirty);
            return;
        }
        let prevDirty = this.dirty;
        let prevDirtyPropsStr = this.dirtyPropsStr;
        this.dirty = false;
        let newData = this.getInitialData();
        let differentPropNames: string[] = [];
        for (let k in newData) {
            if (newData[k] != this.initialData[k]) {
                this.dirty = true;
                differentPropNames.push(k);
            }
        }
        this.$container.find("button.edit-save").prop("disabled", !this.dirty);
        if (this.dirty != prevDirty) {
            this.triggerEvent("dirtyChanged", this.dirty, JSON.stringify(differentPropNames));
        }
        else if (this.dirtyPropsStr != JSON.stringify(differentPropNames)) {
            this.triggerEvent("dirtyPropsChanged", this.dirty, JSON.stringify(differentPropNames));
        }
    }
    
    updateHistoryHeight(): void {
        if (this.internalModel.docked) {
            return;
        }
        let $history = this.$main.find(".history.history-grid");
        let $form = this.$main.find(".comment-form");
        let formHeight = $form.outerHeight(true);
        let $cnt = $history.children();
        if ($cnt.length == 0) {
            return;
        }
        $cnt.css("max-height", 1);
        let scrollHeight = $cnt[0].scrollHeight;
        $cnt.css("max-height", "");
        let availHeight = $history.parent().height();
        let delta = Math.max(formHeight, availHeight - 5 - scrollHeight);
        $history.css("height", "calc(100% - " + delta + "px)");
    }
    
    setOutOfSync(outOfSync: boolean, extraStr: string): void {
        let extra: TaskOutOfSync = JSON.parse(extraStr);
        this.$main.toggleClass("trashed", extra.isTrashed);
        this.$main.toggleClass("out-of-sync", outOfSync);
    }
    
    restoreTexts(description: string, comment: string): void {
        this.setEncryptionEffectElements(false);
        this.encryptionEffectTaskText.$field.text(description);
        this.encryptionEffectCommentText.$field.text(comment);
        this.encryptionEffectTaskText.$button.prop("disabled", !(description && description.trim().length > 0));
        this.encryptionEffectCommentText.$button.prop("disabled", !(comment && comment.trim().length > 0));
    }
    
    updateTaskGroupBadge(id: string, name: string, icon: string, pinned: boolean) {
        let $els = this.$main.find(".taskgroup-label[data-taskgroup-id=" + id + "]");
        $els.each((_, el) => {
            let tpl = this.templateManager.createTemplate(iconTemplate);
            let iconStr = icon ? tpl.render(icon) : "";
            
            let $el = $(el);
            $el.toggleClass("pinned", pinned);
            $el.children().eq(0).html(iconStr);
            $el.children().eq(1).text(name);
            $el.attr("title", name);
        });
    }
    
    updateTaskBadge(id: string, labelClass: string) {
        let $els = this.$main.find(".task-label[data-task-id=" + id + "]");
        $els.each((_, el) => {
            let $el = $(el);
            let classes: string[] = [];
            for (let i = 0; i < el.classList.length; ++i) {
                if (el.classList[i].indexOf("task-status-") == 0) {
                    classes.push(el.classList[i]);
                }
            }
            for (let cls of classes) {
                if ($el.hasClass(cls)) {
                    $el.removeClass(cls);
                }
            }
            $el.addClass(labelClass);
        })
    }
    
    onPasteSeemsEmpty(): void {
        this.pasteSeemsFileSource = null;
        this.triggerEvent("paste", null);
    }
    
    onPasteSeemsFile(paths: string[], originalText: string): void {
        this.triggerEvent("paste", originalText);
    }
    
    pastePlainText(text: string): void {
        let editor = this.pasteSeemsFileSource == "comment" ? this.commentEditor : (this.pasteSeemsFileSource == "description" ? this.descriptionEditor : null);
        this.pasteSeemsFileSource = null;
        if (editor) {
            editor.pastePlainText(text);
        }
    }
    
    updateAttachmentNames(attachmentNamesStr: string): void {
        let attachmentNames: { [did: string]: string } = JSON.parse(attachmentNamesStr);
        let $atts = this.$main.find("li.attachment span.link[data-did]");
        $atts.each((_, el) => {
            let $el = $(el);
            let did = $el.data("did");
            if (attachmentNames[did]) {
                $el.text(attachmentNames[did]);
            }
        });
    }
    
    setAutoMarkAsRead(autoMarkAsRead: boolean): void {
        if (this.internalModel) {
            this.internalModel.autoMarkAsRead = autoMarkAsRead;
            this.updateAutoMarkAsRead();
            this.renderOverlayButtons();
        }
    }
    
    updateAutoMarkAsRead(): void {
        if (this.$main && this.internalModel) {
            this.$main.toggleClass("auto-mark-as-read", this.internalModel.autoMarkAsRead);
        }
    }
    
    setIsRead(isRead: boolean) {
        if (!this.internalModel || this.internalModel.isRead == isRead) {
            return;
        }
        let helper = this.templateManager.getHelperByClass(webUtils.MailClientViewHelper);
        let model = this.internalModel;
        model.isRead = isRead;
        this.$main.find(".link.toggle-marked-as-read").find(".text-content").text(model.isRead ? helper.i18n("plugin.tasks.component.taskPanel.markAsUnread") : helper.i18n("plugin.tasks.component.taskPanel.markAsRead"));
        this.renderOverlayButtons();
    }
    
    getCurrentSectionId(): string {
        let el = this.customSelectProject.items.filter(it => it.type == "item" && it.selected)[0] as component.customselect.CustomSelectItem | null;
        if (el) {
            return el.value;
        }
        return null;
    }
    
    getCurrentHostHash(): string {
        return this.internalModel ? this.internalModel.hostHash : null;
    }
    
    updateRelatedSection(sectionId: string): void {
        if (this.commentEditor) {
            this.commentEditor.options.relatedSectionId = this.getCurrentHostHash();
            this.commentEditor.options.relatedSectionId = sectionId;
        }
        if (this.descriptionEditor) {
            this.descriptionEditor.options.relatedSectionId = this.getCurrentHostHash();
            this.descriptionEditor.options.relatedSectionId = sectionId;
        }
    }
    
    flashElement($el: JQuery): void {
        if (!$el) {
            return;
        }
        $el.fadeOut(150).fadeIn(300);
    }
    
    setHostHash(hostHash: string): void {
        if (this.internalModel) {
            this.internalModel.hostHash = hostHash;
        }
    }
    
}