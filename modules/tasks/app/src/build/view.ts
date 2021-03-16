import { MainWindowView } from "../window/main/MainWindowView";
import { TasksWindowView } from "../window/tasks/TasksWindowView";
import { TaskGroupFormWindowView } from "../window/taskGroupForm/TaskGroupFormWindowView";
import { TaskWindowView } from "../window/task/TaskWindowView";
import { TaskGroupSelectorWindowView } from "../window/taskGroupSelector/TaskGroupSelectorWindowView";
import { TaskGroupsPanelView } from "../component/taskGroupsPanel/TaskGroupsPanelView";
import * as Web from "pmc-web";
import { TaskPanelView } from "../component/taskPanel/TaskPanelView";
import { FastListCreator } from "../main/FastListCreator";
import { IconPickerData } from "../component/iconPicker/IconPickerData";
import { DetachTaskGroupWindowView } from "../window/detachTaskGroup/DetachTaskGroupWindowView";
import { IconPickerWindowView } from "../window/iconPicker/IconPickerWindowView";

Web.Starter.objectFactory.register(DetachTaskGroupWindowView);
Web.Starter.objectFactory.register(IconPickerWindowView);
Web.Starter.objectFactory.register(MainWindowView);
Web.Starter.objectFactory.register(TasksWindowView);
Web.Starter.objectFactory.register(TaskGroupFormWindowView);
Web.Starter.objectFactory.register(TaskWindowView);
Web.Starter.objectFactory.register(TaskGroupSelectorWindowView);

Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.sectionsummary.SectionSummaryWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowView") {
        let kvdb = new TaskGroupsPanelView(event.instance, event.instance.personsComponent, true);
        kvdb.$container = Web.JQuery('<div class="tasks-component taskgroupspanel-container"></div>');
        event.instance.registerModule("tasks", kvdb);
    }
}, "tasks", "ethernal");

Web.Starter.addEventListener("request-task-panel-view", event => {
    let view = new TaskPanelView((<any>event).parent, (<any>event).parent.personsComponent);
    (<any>event).parent.registerPreview((<any>event).name, view);
}, "tasks", "ethernal");

Web.Starter.addEventListener("request-fast-list-creator", event => {
    let view = new FastListCreator();
    ((<any>event).parent).registerFastListCreator((<any>event).name, view);
}, "tasks", "ethernal");

Web.Starter.addEventListener("request-icon-picker-data", event => {
    let data = { items: IconPickerData.items, colors: IconPickerData.colors };
    ((<any>event).parent).registerIconPickerData((<any>event).name, data);
}, "tasks", "ethernal");
