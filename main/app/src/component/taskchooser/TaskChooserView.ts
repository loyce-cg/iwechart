import { ComponentView } from "../base/ComponentView";
import { ExtListView } from "../extlist/ExtListView";
import { func as mainTemplate } from "./template/main.html";
import { func as itemTemplate } from "./template/item-template.html";
import * as Types from "../../Types";
import * as $ from "jquery";
import * as Q from "q";
import { Model, TaskModel } from "./TaskChooserController";
import { UI } from "../../web-utils";
import { TaskTooltipView } from "../tasktooltip/TaskTooltipView";
import { PersonsView } from "../persons/web";

export class TaskChooserView extends ComponentView {
    
    $main: JQuery;
    $container: JQuery;
    $filterInput: JQuery;
    $resultsCount: JQuery;
    tasksExtList: ExtListView<TaskModel>;
    personsComponent: PersonsView;
    taskTooltip: TaskTooltipView;
    mainTemplate: Types.webUtils.MailTemplate<Model>;
    popup: boolean;
    onDocumentMouseDownBound: (e: MouseEvent) => void;
    
    constructor(
        parent: Types.app.ViewParent
    ) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.tasksExtList = this.addComponent("tasks", new ExtListView(this, {
            template: itemTemplate,
            onAfterListRender: () => {
                this.refreshResultsCount();
            },
        }));
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.mainTemplate.helper));
        this.taskTooltip = this.addComponent("tasktooltip", new TaskTooltipView(this));
        this.taskTooltip.refreshAvatars = () => {
            this.personsComponent.refreshAvatars();
        };
        this.onDocumentMouseDownBound = this.onDocumentMouseDown.bind(this);
    }
    
    init(model: Model): Q.Promise<void> {
        this.popup = model.popup;
        this.$main = this.mainTemplate.renderToJQ(model);
        this.$container.append(this.$main);
        this.$main.find(".scrollable-content").pfScroll();
        this.$filterInput = this.$main.find(".filter-input");
        this.$resultsCount = this.$main.find("[data-content=results-count]");
        this.tasksExtList.$container = this.$container.find(".scrollable-content").children(".pf-content");
        this.taskTooltip.$container = this.$container;
        
        this.$filterInput.on("input", this.onFilterInputChange.bind(this));
        this.$filterInput[0].onblur = () => { this.$filterInput.focus(); };
        this.$filterInput.on("keydown", <any>((e: KeyboardEvent) => {
            if (e.key == "ArrowUp" || e.key == "ArrowDown") {
                e.preventDefault();
            }
        }));
        this.$container.on("click", "[data-action=choose]", this.onChooseClick.bind(this));
        this.$container.on("click", "[data-action=cancel]", this.onCancelClick.bind(this));
        this.$container.on("click", "[data-action=new-task]", this.onNewTaskClick.bind(this));
        this.$container.on("click", "[data-task-id]", this.onTaskClick.bind(this));
        this.$container.on("dblclick", "[data-task-id]", this.onTaskDoubleClick.bind(this));
        this.$container.on("keydown", this.onKeyDown.bind(this));
        
        this.$filterInput.focus();
        let el = this.$filterInput[0] as HTMLInputElement;
        let val = el.value;
        el.value = "";
        el.value = val;
        
        return Q().then(() => {
            this.personsComponent.$main = this.$container;
            return this.personsComponent.triggerInit();
        }).then(() => {
            return Q.all([
                this.tasksExtList.triggerInit(),
                this.taskTooltip.triggerInit(),
            ]).thenResolve(null);
        });
    }
    
    onFilterInputChange(): void {
        this.triggerEvent("setFilter", this.$filterInput.val());
    }
    
    onChooseClick(): void {
        this.triggerEvent("choose");
    }
    
    onCancelClick(): void {
        this.triggerEvent("cancel");
    }
    
    onNewTaskClick(): void {
        this.triggerEvent("newTask");
    }
    
    onTaskClick(e: MouseEvent): void {
        let taskId = $(e.currentTarget).data("task-id");
        this.triggerEvent("activateTask", taskId);
    }
    
    onTaskDoubleClick(e: MouseEvent): void {
        let taskId = $(e.currentTarget).data("task-id");
        this.triggerEvent("activateTask", taskId, true);
    }
    
    onDocumentMouseDown(e: MouseEvent): void {
        if ($.contains(this.$main[0], <any>e.target)) {
            return;
        }
        this.hidePopup();
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.key == "ArrowUp") {
            this.triggerEvent("selectPrev");
        }
        else if (e.key == "ArrowDown") {
            this.triggerEvent("selectNext");
        }
        else if (e.key == "Enter") {
            if (!this.$main.find("[data-action=choose]").prop("disabled")) {
                this.triggerEvent("choose");
            }
        }
        else if (e.key == "Escape") {
            this.triggerEvent("cancel");
        }
    }
    
    setChooseEnabled(enabled: boolean): void {
        this.$main.find("[data-action=choose]").prop("disabled", !enabled);
    }
    
    refreshResultsCount(): void {
        this.$resultsCount.text(this.tasksExtList.$container.find(".task").length);
    }
    
    scrollToSelectedItem(): void {
        let $el = this.$main.find(".task.active");
        let $parent = $el.parent();
        if ($el.length > 0 && $parent.length > 0) {
            UI.scrollViewIfNeeded($parent[0], $el[0]);
        }
    }
    
    showPopup(): void {
        this.$main.addClass("visible");
        $(document).on("mousedown", <any>this.onDocumentMouseDownBound);
    }
    
    hidePopup(): void {
        this.$main.removeClass("visible");
        $(document).off("mousedown", <any>this.onDocumentMouseDownBound);
    }
    
    movePopup(x: number, y: number, w: number, h: number): void {
        this.$main.css({
            left: x + "px",
            top: y + "px",
            width: w + "px",
            height: h + "px",
        })
    }
    
}