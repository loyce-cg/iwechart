import * as web from "pmc-web";
import { func as mainTemplate }  from "./template/main.html";
import { Model } from "./TaskWindowController";
import $ = web.JQuery;
import { TaskPanelView } from "../../component/taskPanel/TaskPanelView";
import Q = web.Q;
export class TaskWindowView extends web.window.base.BaseWindowView<Model> {
    
    $name: JQuery;
    $description: JQuery;
    $taskGroupId: JQuery;
    $assignedTo: JQuery;
    $type: JQuery;
    $status: JQuery;
    $priority: JQuery;
    taskPanel: TaskPanelView;
    personsComponent: web.component.persons.PersonsView;
        
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new web.component.persons.PersonsView(this, this.helper));
        this.taskPanel = this.addComponent("taskPanel", new TaskPanelView(this, this.personsComponent));
    }
    
    initWindow(model: Model): any {
        return Q().then(() => {
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.taskPanel.$container = this.$main.find(".task-container");
            this.taskPanel.triggerInit();
            this.$main.on("keydown", this.onKeyDown.bind(this));
            this.$main.attr("tabindex", -1);
            this.$main.focus();
        })
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (e.key == "Escape") {
            if ((<any>document)._preventClose) {
                return;
            }
            this.triggerEvent("close");
        }
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
}