import {Task} from "./Task";
import * as Q from "q";

export class AutoTask extends Task {
    
    func: Function;
    
    constructor(id: number, name: string, data: any, func: Function) {
        super(id, name, data);
        this.func = func;
    }
    
    start(): void {
        this.startDate = new Date();
        Q().then(() => {
            return this.func();
        })
        .progress(data => {
            this.currentProgress = data;
            this.defered.notify(data);
        })
        .then(data => {
            this.result = true;
            this.resultData = data;
            this.defered.resolve(data);
        })
        .fail(data => {
            this.result = false;
            this.resultData = data;
            this.defered.reject(data);
        });
    }
}

