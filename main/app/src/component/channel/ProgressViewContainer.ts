import {ProgressView} from "./ProgressView";
import {ProgressButton} from "./ProgressButton";
import {ProgressNotifier} from "./ProgressNotifier";
import {webUtils} from "../../Types";

export class ProgressViewContainer extends ProgressView {
    
    children: Function[];
    
    constructor(view: webUtils.ProgressManager) {
        super(view);
        this.children = [];
    }
    
    onMessage(type: string, ...args: any[]): void {
        for (let i = 0; i < this.children.length; i++) {
            this.children[i].apply(null, arguments);
        }
        ProgressView.prototype.onMessage.apply(this, arguments);
    }
    
    onFinish(...args: any[]): void {
        ProgressView.prototype.onFinish.apply(this, arguments);
    }
    
    newChannel(fnc: Function): number {
        let index = this.children.length;
        this.children.push(fnc);
        return index;
    }
    
    destroyChannel(id: number): void {
        this.children[id] = null;
    }
    
    addButton($btn: JQuery): ProgressViewContainer {
        if ($btn.length > 0) {
            new ProgressButton(this, $btn);
        }
        return this;
    }
    
    addNotifier($container: JQuery, notifier: webUtils.ProgressNotifier): ProgressViewContainer {
        new ProgressNotifier(this, $container, notifier);
        return this;
    }
}

