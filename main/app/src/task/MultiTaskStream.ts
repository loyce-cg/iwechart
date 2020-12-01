import {TaskStream} from "./TaskStream";
import {Task} from "./Task";
import {Lang} from "../utils/Lang";

export class MultiTaskStream extends TaskStream {
    
    streams: TaskStream[];
    onChildStreamEventBinded: () => void;
    
    constructor() {
        super();
        this.streams = [];
        this.onChildStreamEventBinded = this.onChildStreamEvent.bind(this);
    }
    
    getCurrentTasks(): Task[] {
        let tasksLists: Task[][] = [];
        for (let i = 0; i < this.streams.length; i++) {
            tasksLists.push(this.streams[i].getCurrentTasks());
        }
        return Array.prototype.concat.apply([], tasksLists);
    }
    
    addStream(stream: TaskStream) {
        this.streams.push(stream);
        stream.changeEvent.add(this.onChildStreamEventBinded);
        this.changeEvent.trigger("new-stream");
    }
    
    onChildStreamEvent() {
        this.changeEvent.trigger.apply(this.changeEvent, arguments);
    }
    
    removeStream(stream: TaskStream) {
        Lang.removeFromList(this.streams, stream);
        stream.changeEvent.remove(this.onChildStreamEventBinded);
    }
}

