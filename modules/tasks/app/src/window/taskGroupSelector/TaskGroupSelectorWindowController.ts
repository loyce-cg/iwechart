import { window, component, utils, Q, mail } from "pmc-mail";
import { Types } from "pmc-mail";
import { TasksPlugin } from "../../main/TasksPlugin";
import { ProjectId } from "../../main/Types";
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";

export interface Result {
    taskGroupIds: string[];
}

export interface TaskGroupModel {
    id: string;
    name: string;
    isSelected: boolean;
    iconStr: string;
}

export interface Model {
}

@Dependencies(["extlist"])
export class TaskGroupSelectorWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.taskGroupSelector.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    deferred: Q.Deferred<Result> = Q.defer();
    tasksPlugin: TasksPlugin;
    mutableTaskGroupsCollection: utils.collection.MutableCollection<TaskGroupModel>;
    sortedTaskGroupsCollection: utils.collection.SortedCollection<TaskGroupModel>;
    activeTaskGroupsCollection: utils.collection.WithMultiActiveCollection<TaskGroupModel>;
    transformTaskGroupsCollection: utils.collection.TransformCollection<TaskGroupModel, TaskGroupModel>;
    taskGroupsExtList: component.extlist.ExtListController<TaskGroupModel>;
    
    constructor(parentWindow: Types.app.WindowParent, public session: mail.session.Session, public projectId: ProjectId, public defaultSelectedTaskGroupIds: string[]) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.modal = true;
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.taskGroupSelector.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        this.openWindowOptions.width = 300;
        this.openWindowOptions.height = 400;

        this.tasksPlugin = this.app.getComponent("tasks-plugin");

        this.mutableTaskGroupsCollection = this.addComponent("mutableTaskGroupsCollection", new utils.collection.MutableCollection());
        this.sortedTaskGroupsCollection = this.addComponent("sortedTaskGroupsCollection", new utils.collection.SortedCollection(this.mutableTaskGroupsCollection, this.taskGroupComparator.bind(this)));
        this.activeTaskGroupsCollection = this.addComponent("activeTaskGroupsCollection", new utils.collection.WithMultiActiveCollection(this.sortedTaskGroupsCollection));
        this.transformTaskGroupsCollection = this.addComponent("transformTaskGroupsCollection", new utils.collection.TransformCollection(this.activeTaskGroupsCollection, this.transformTaskGroupModel.bind(this)));
        this.taskGroupsExtList = this.addComponent("taskGroupsExtList", this.componentFactory.createComponent("extlist", [this, this.transformTaskGroupsCollection]));
        this.taskGroupsExtList.ipcMode = true;
        let project = this.tasksPlugin.projects[this.session.hostHash][this.projectId];

        if (project) {
            let tgs = project.getTaskGroupIds()
            .map(x => this.tasksPlugin.taskGroups[this.session.hostHash][x])
            .filter(x => x != null)
            .map(x => <TaskGroupModel>{ id: x.getId(), name: x.getName(), isSelected: false, iconStr: x.getIcon() });
            this.mutableTaskGroupsCollection.addAll(tgs);
            for (let tgId of this.defaultSelectedTaskGroupIds) {
                this.activeTaskGroupsCollection.setSelected(this.activeTaskGroupsCollection.getBy("id", tgId));
                this.activeTaskGroupsCollection.triggerUpdateAt(this.activeTaskGroupsCollection.indexOfBy(x => x.id == tgId));
            }
        }
    }

    transformTaskGroupModel(tgm: TaskGroupModel, idx: number): TaskGroupModel {
        tgm.isSelected = this.activeTaskGroupsCollection.isSelected(idx);
        return tgm;
    }

    taskGroupComparator(a: TaskGroupModel, b: TaskGroupModel): number {
        return a.name.localeCompare(b.name);
    }

    setSelected(idx: number, isSelected: boolean): void {
        let el = this.activeTaskGroupsCollection.get(idx);
        if (isSelected) {
            this.activeTaskGroupsCollection.setSelected(el);
        }
        else {
            this.activeTaskGroupsCollection.deselect(el);
        }
        this.activeTaskGroupsCollection.triggerUpdateAt(idx);
    }
    
    isSelected(idx: number) {
        return this.activeTaskGroupsCollection.isSelected(idx);
    }
    
    getPromise(): Q.Promise<Result> {
        return this.deferred.promise;
    }
    
    getModel(): Model {
        return {
        };
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewSave(): void {
        let activeIds: string[] = this.activeTaskGroupsCollection.getSelectedIndexes().filter(x => x >= 0).map(x => this.activeTaskGroupsCollection.get(x).id);
        this.deferred.resolve({ taskGroupIds: activeIds });
        this.close();
    }
    
    onViewToggleSelected(id: string): void {
        let idx = this.activeTaskGroupsCollection.indexOfBy(x => x.id == id);
        if (idx >= 0) {
            this.setSelected(idx, !this.isSelected(idx));
        }
    }
    
}
