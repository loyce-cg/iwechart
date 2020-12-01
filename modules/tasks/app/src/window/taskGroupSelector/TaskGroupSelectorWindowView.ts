import * as web from "pmc-web";
import { func as mainTemplate }  from "./template/main.html";
import { func as taskGroupTemplate } from "./template/taskgroup.html";
import { func as taskGroupEmptyTemplate } from "./template/taskgroup-empty.html";
import { Model, TaskGroupModel } from "./TaskGroupSelectorWindowController";
import $ = web.JQuery;

export class TaskGroupSelectorWindowView extends web.window.base.BaseWindowView<Model> {
    
    taskGroupsExtList: web.component.extlist.ExtListView<TaskGroupModel>;
    
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.taskGroupsExtList = this.addComponent("taskGroupsExtList", new web.component.extlist.ExtListView(this, {
            template: taskGroupTemplate,
            emptyTemplate: taskGroupEmptyTemplate,
        }));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.setModel(model);
        this.$main.on("click", ".taskgroup", this.onTaskGroupClick.bind(this));
        this.$main.on("click", "[data-action=save]", this.onSaveClick.bind(this));
        this.$main.on("click", "[data-action=cancel]", this.onCancelClick.bind(this));
        
        (<any>this.$main.find(".scrollable-content")).pfScroll();
        
        this.taskGroupsExtList.$container = this.$main.find(".extlist-container");
        return this.taskGroupsExtList.triggerInit();
    }
    
    setModel(model: Model): void {
    }
    
    save(): void {
        this.triggerEvent("save");
    }
    
    cancel(): void {
        this.triggerEvent("close");
    }
    
    onLinkClick(event: MouseEvent): void {
        event.preventDefault();
        this.triggerEventInTheSameTick("openUrl", (<HTMLAnchorElement>event.currentTarget).href);
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onSaveClick(): void {
        this.save();
    }
    
    onCancelClick(): void {
        this.cancel();
    }
    
    onTaskGroupClick(e: MouseEvent): void {
        let id = $(e.currentTarget).data("taskgroup-id");
        this.triggerEvent("toggleSelected", id);
    }

}