import {TaskStream} from "./TaskStream";
import {DeferedTask} from "./DeferedTask";
import {AutoTask} from "./AutoTask";
import {Task} from "./Task";

export class ParallelTaskStream extends TaskStream {
    
    lastTaskId: number;
    
    constructor() {
        super();
        this.lastTaskId = 0;
    }
    
    createDeferedTask(name: string, data: any): DeferedTask {
        let task = new DeferedTask(++this.lastTaskId, name, data);
        this.addTask(task);
        return task;
    }
    
    createAutoTask(name: string, data: any, func: Function): AutoTask {
        let task = new AutoTask(++this.lastTaskId, name, data, func);
        this.addTask(task);
        task.start();
        return task;
    }
    
    addTask(task: Task): void {
        this.currentTasks.push(task);
        this.changeEvent.trigger("new-task", task);
        task.getPromise().progress(this.onTaskProgress.bind(this, task))
        .then(this.onTaskSuccess.bind(this, task))
        .fail(this.onTaskFail.bind(this, task));
    }
    
    onTaskProgress(task: Task, data: any): void {
        this.changeEvent.trigger("task-progress", task, data);
    }
    
    onTaskSuccess(task: Task, data: any): void {
        this.removeTask(task);
        this.changeEvent.trigger("task-success", task, data);
    }
    
    onTaskFail(task: Task, data: any): void {
        this.removeTask(task);
        this.changeEvent.trigger("task-failure", task, data);
    }
    
    removeTask(task: Task): void {
        for (let i = 0; i < this.currentTasks.length; i++) {
            if (task == this.currentTasks[i]) {
                this.currentTasks.splice(i, 1);
                return;
            }
        }
    }
    
    destroy(): void {
        this.currentTasks = [];
        this.changeEvent.clear();
    }
}

