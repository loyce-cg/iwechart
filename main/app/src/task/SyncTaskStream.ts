import {TaskStream} from "./TaskStream";
import {DeferedTask} from "./DeferedTask";
import {AutoTask} from "./AutoTask";
import {Task} from "./Task";

export class SyncTaskStream extends TaskStream {
    
    currentTask: AutoTask;
    tasks: AutoTask[];
    lastTaskId: number;
    
    constructor() {
        super();
        delete this.currentTasks;
        this.lastTaskId = 0;
        this.tasks = [];
    }
    
    getCurrentTasks(): Task[] {
        return this.currentTask ? [this.currentTask] : [];
    }
    
    createTask(name: string, data: any, func: Function): AutoTask {
        let task = new AutoTask(++this.lastTaskId, name, data, func);
        if (this.currentTask == null) {
            this.currentTask = task;
            this.startCurrentTask();
        }
        else {
            this.tasks.push(task);
        }
        return task;
    }
    
    startCurrentTask() {
        if (this.currentTask == null) {
            return;
        }
        this.currentTask.start();
        this.currentTask.getPromise().progress(this.onTaskProgress.bind(this, this.currentTask))
        .then(this.onTaskSuccess.bind(this, this.currentTask))
        .fail(this.onTaskFail.bind(this, this.currentTask));
        this.changeEvent.trigger("new-task", this.currentTask);
    }
    
    onTaskProgress(task: Task, data: any): void {
        this.changeEvent.trigger("task-progress", task, data);
    }
    
    onTaskSuccess(task: Task, data: any): void {
        this.chooseNextTask();
        this.changeEvent.trigger("task-success", task, data);
        this.startCurrentTask();
    }
    
    onTaskFail(task: Task, data: any): void {
        this.chooseNextTask();
        this.changeEvent.trigger("task-failure", task, data);
        this.startCurrentTask();
    }
    
    chooseNextTask(): void {
        if (this.tasks.length == 0) {
            this.currentTask = null;
        }
        else {
            let task = this.tasks.shift();
            task.startDate = new Date();
            this.currentTask = task;
        }
    }
    
    destroy(): void {
        this.tasks = [];
        this.currentTask = null;
        this.changeEvent.clear();
    }
}

