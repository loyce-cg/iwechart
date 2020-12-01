import {webUtils} from "../../Types";

export class ProgressView {
    
    view: webUtils.ProgressManager;
    id: number;
    
    constructor(view: webUtils.ProgressManager) {
        this.view = view;
        this.id = view.newChannel(this.onMessage.bind(this));
    }
    
    onMessage(type: string, ...argss: any[]): void {
        let args = Array.prototype.slice.call(arguments, 1);
        if (type == "start") {
            this.onStart.apply(this, args);
        }
        else if (type == "progress") {
            this.onProgress.apply(this, args);
        }
        else if (type == "finish") {
            this.onFinish.apply(this, args);
        }
    }
    
    onStart(...args: any[]): void {
    }
    
    onProgress(...args: any[]): void {
    }
    
    onFinish(...args: any[]): void {
        this.view.destroyChannel(this.id);
    }
}

