import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {TransformCollection} from "../../utils/collection/TransformCollection";
import {ExtListController} from "../extlist/ExtListController";
import * as Types from "../../Types";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {ComponentFactory} from "../main";
import {FilteredCollection} from "../../utils/collection/FilteredCollection";
import { MutableCollection, SortedCollection } from "../../utils/collection";
import { CommonApplication } from "../../app/common";
import * as Q from "q";
import { TaskTooltipController } from "../tasktooltip/TaskTooltipController";
import { SectionManager } from "../../mail/section/SectionManager";
import { PersonsController } from "../persons/main";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export interface TaskChooserOptions {
    createTaskButton?: boolean;
    onlyFromSectionIds?: string[];
    onlyTaskIds?: string[];
    includeTrashed?: boolean;
    popup?: boolean;
    session: Session;
    taskIdFilter?: (taskId: string) => boolean;
    initialSearchText?: string;
}

export interface Model {
    createTaskButton: boolean;
    popup: boolean;
    searchText: string;
}

export interface Task {
    getId(): string;
    getName(): string;
    getDescription(): string;
    getStatus(): string;
    getModifiedDateTime(): number;
    getProjectId(): string;
    getIsTrashed(): boolean;
}

export interface TaskModel {
    id: string;
    title: string;
    status: string;
}

export interface TaskChooserCloseEvent {
    type: "task-chooser-close";
    taskId: string;
    requestNewTask: boolean;
}

export interface TaskChooserCloseResult {
    taskId: string;
    requestNewTask: boolean;
}

@Dependencies(["extlist"])
export class TaskChooserController extends ComponentController {
    
    static textsPrefix: string = "component.taskChooser.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    
    tasksCollection: MutableCollection<Task>;
    filteredTasksCollection: FilteredCollection<Task>;
    sortedTasksCollection: SortedCollection<Task>;
    activeTasksCollection: WithActiveCollection<Task>;
    transformCollection: TransformCollection<TaskModel, Task>;
    tasksExtList: ExtListController<TaskModel>;
    personsComponent: PersonsController;
    taskTooltip: TaskTooltipController;
    tasksPlugin: any;
    filter: string = "";
    afterViewLoaded: Q.Deferred<void> = Q.defer();
    closedDeferred: Q.Deferred<TaskChooserCloseResult> = null;
    
    constructor(
        parent: Types.app.IpcContainer,
        public app: CommonApplication,
        public options: TaskChooserOptions
    ) {
        super(parent);
        this.ipcMode = true;
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        // console.log("taskChooser - options: ", this.options);
        if (!this.options) {
            this.options = {session: this.app.sessionManager.getLocalSession()};
        }
        
        if (this.options.initialSearchText) {
            this.filter = this.options.initialSearchText;
        }
        
        this.resolveSections();
        // console.log("taskChooser - after resolving sections")
        
        let tasks: Task[] = [];
        // console.log("session", this.options.session);
        if (this.tasksPlugin.tasks && this.tasksPlugin.tasks[this.options.session.hostHash]) {
            for (let taskId in this.tasksPlugin.tasks[this.options.session.hostHash]) {
                tasks.push(this.tasksPlugin.tasks[this.options.session.hostHash][taskId]);
            }
    
        }
        // console.log("taskchooser - after adding session tasks");
        
        this.tasksCollection = new MutableCollection(tasks);
        // console.log("taskchooser - 1");
        this.filteredTasksCollection = new FilteredCollection(this.tasksCollection, this.filterTask.bind(this));
        this.sortedTasksCollection = new SortedCollection(this.filteredTasksCollection, (a, b) => b.getModifiedDateTime() - a.getModifiedDateTime());
        this.activeTasksCollection = new WithActiveCollection(this.sortedTasksCollection);
        this.transformCollection = new TransformCollection(this.activeTasksCollection, this.convertTask.bind(this));
        this.tasksExtList = this.addComponent("tasks", this.componentFactory.createComponent("extlist", [this, this.transformCollection]));
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        
        // console.log("taskchooser - 2");


        this.taskTooltip = this.addComponent("tasktooltip", this.componentFactory.createComponent("tasktooltip", [this]));
        this.taskTooltip.getContent = (taskId: string): string => {
            return this.tasksPlugin.getTaskTooltipContent(this.options.session, taskId);
        };
        // console.log("taskchooser - 4");

        this.activeTasksCollection.setActive(this.activeTasksCollection.get(0));
        
        this.registerChangeEvent(this.activeTasksCollection.changeEvent, this.onActiveCollectionChange.bind(this));
        // console.log("taskchooser - 5 constructor done");

    }
    
    init(): Q.Promise<void> {
        return Q().then(() => {
            // console.log("taskchooser - init 1");

            this.onActiveCollectionChange(null);
            // console.log("taskchooser - init 2");

        });
    }
    
    getModel(): Model {
        // console.log("taskchooser - get model");

        return {
            createTaskButton: this.options.createTaskButton,
            popup: this.options.popup,
            searchText: this.options.initialSearchText || "",
        };
    }
    
    onViewLoad(): void {
        // console.log("taskchooser - onViewLoad");

        this.afterViewLoaded.resolve();
    }
    
    filterTask(task: Task): boolean {
        if (this.options.onlyFromSectionIds) {
            let sectionId = task.getProjectId();
            if (this.options.onlyFromSectionIds.indexOf(sectionId) < 0) {
                return false;
            }
        }
        if (this.options.onlyTaskIds) {
            if (this.options.onlyTaskIds.indexOf(task.getId()) < 0) {
                return false;
            }
        }
        if (this.options.taskIdFilter) {
            if (!this.options.taskIdFilter(task.getId())) {
                return false;
            }
        }
        if (!this.options.includeTrashed && task.getIsTrashed()) {
            return false;
        }
        if (this.filter.length == 0) {
            return true;
        }
        if (this.filter[0] == "#") {
            return task.getId().indexOf(this.filter.substr(1)) == 0;
        }
        return task.getDescription().toLocaleLowerCase().indexOf(this.filter) >= 0;
    }
    
    convertTask(task: Task): TaskModel {
        return {
            id: task.getId(),
            title: task.getName().split("</privmx-ced-meta-data>").pop(),
            status: task.getStatus(),
        };
    }
    
    onActiveCollectionChange(e: Types.utils.collection.CollectionEvent<Task>): void {
        if (e && e.type != "active") {
            return;
        }
        let active = this.activeTasksCollection.getActive();
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setChooseEnabled", !!active);
        });
    }
    
    refreshTasks(): void {
        this.filteredTasksCollection.refresh();
    }
    
    chooseActive(): void {
        let active = this.activeTasksCollection.getActive();
        this.closeChooser(active ? active.getId() : null, false);
    }
    
    onViewSetFilter(filter: string): void {
        this.filter = filter.toLocaleLowerCase();
        this.filteredTasksCollection.refresh();
        if (!this.activeTasksCollection.getActive() && !this.activeTasksCollection.isEmpty()) {
            let el = this.activeTasksCollection.get(0);
            this.activeTasksCollection.setActive(el);
        }
    }
    
    onViewChoose(): void {
        this.chooseActive();
    }
    
    onViewCancel(): void {
        this.closeChooser(null, false);
    }
    
    onViewNewTask(): void {
        this.closeChooser(null, true);
    }
    
    closeChooser(taskId: string, requestNewTask: boolean): void {
        this.dispatchEvent<TaskChooserCloseEvent>({
            type: "task-chooser-close",
            taskId: taskId,
            requestNewTask: requestNewTask,
        });
        if (this.closedDeferred) {
            this.closedDeferred.resolve({ taskId, requestNewTask });
            this.closedDeferred = null;
        }
        this.hidePopup();
    }
    
    onViewActivateTask(taskId: string, choose: boolean = false): void {
        let task = this.activeTasksCollection.find(t => t.getId() == taskId);
        if (task) {
            this.activeTasksCollection.setActive(task);
        }
        else {
            this.activeTasksCollection.setActive(this.activeTasksCollection.get(0));
        }
        if (choose) {
            this.chooseActive();
        }
    }
    
    onViewSelectNext(): void {
        this.moveSelection(1);
    }
    
    onViewSelectPrev(): void {
        this.moveSelection(-1);
    }
    
    moveSelection(delta: number): void {
        let currentActiveIndex = this.activeTasksCollection.getActiveIndex();
        let newActiveIndex = currentActiveIndex + delta;
        let newActiveItem = this.activeTasksCollection.get(newActiveIndex);
        if (newActiveItem) {
            this.activeTasksCollection.setActive(newActiveItem);
            this.callViewMethod("scrollToSelectedItem");
        }
    }
    
    showPopup(): Q.Promise<TaskChooserCloseResult> {
        if (!this.options.popup) {
            return Q().thenReject();
        }
        this.callViewMethod("showPopup");
        this.closedDeferred = Q.defer();
        return this.closedDeferred.promise;
    }
    
    hidePopup(): void {
        if (this.showPopup) {
            this.callViewMethod("hidePopup");
        }
    }
    
    resolveSections(): void {
        if (!this.options.onlyFromSectionIds) {
            return;
        }
        for (let sectionId of this.options.onlyFromSectionIds) {
            let section = this.options.session.sectionManager.sectionsCollection.find(x => x.getId() == sectionId);
            if (section && section.isUserGroup()) {
                this.options.onlyFromSectionIds = null;
                break;
            }
        }
    }
    
}