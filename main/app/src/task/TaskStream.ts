import {Event} from "../utils/Event";
import {Task} from "./Task";

export class TaskStream {
    
    changeEvent: Event<string, Task, any>;
    currentTasks: Task[];
    
    constructor() {
        this.changeEvent = new Event<string, Task, any>();
        this.currentTasks = [];
    }
    
    getCurrentTasks(): Task[] {
        return this.currentTasks;
    }
}

