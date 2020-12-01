import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {ComponentView} from "../../component/base/ComponentView";
import {StatusBarView} from "../../component/statusbar/StatusBarView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Lang} from "../../utils/Lang";
import {Model} from "./TaskChooserWindowController";
import * as Q from "q";
import {app} from "../../Types";
import { TaskChooserView } from "../../component/taskchooser/web";

@WindowView
export class TaskChooserWindowView extends BaseWindowView<Model> {
    
    $taskChooserComponentContainer: JQuery;
    taskChooser: TaskChooserView;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.taskChooser = this.addComponent("taskChooser", new TaskChooserView(this));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.$taskChooserComponentContainer = this.$main.find(".task-chooser-component-container");
        this.taskChooser.$container = this.$taskChooserComponentContainer;
        
        return Q().then(() => {
            return this.taskChooser.triggerInit();
        });
    }
    
}
