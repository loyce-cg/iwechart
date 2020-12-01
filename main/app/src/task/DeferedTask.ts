import {Task} from "./Task";

export class DeferedTask extends Task {
    
    constructor(id: number, name: string, data: any) {
        super(id, name, data);
        this.startDate = this.createDate;
    }
    
    progress(data?: any): void {
        if (this.isFinished()) {
            return;
        }
        this.currentProgress = data;
        this.defered.notify(data);
    }
    
    endWithSuccess(data?: any): void {
        if (this.isFinished()) {
            return;
        }
        this.result = true;
        this.resultData = data;
        this.defered.resolve(data);
    }
    
    endWithError(data?: any): void {
        if (this.isFinished()) {
            return;
        }
        this.result = false;
        this.resultData = data;
        this.defered.reject(data);
    }
}

