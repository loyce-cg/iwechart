import {ComponentController} from "../base/ComponentController";
import {Event} from "../../utils/Event";
import {SyncTaskStream} from "../../task/SyncTaskStream";
import {AutoTask} from "../../task/AutoTask";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface AutoTaskModel {
    name: string;
    progress: any;
    blockUI: boolean;
}

export class StatusBarController extends ComponentController {
    
    static textsPrefix: string = "component.statusBar.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    syncTaskStream: SyncTaskStream;
    
    constructor(parent: app.IpcContainer, syncTaskStream: SyncTaskStream) {
        super(parent);
        this.ipcMode = true;
        this.syncTaskStream = syncTaskStream;
        this.registerChangeEvent(this.syncTaskStream.changeEvent, this.onChange, "multi");
    }
    
    getModel(): AutoTaskModel {
        if (!this.syncTaskStream.currentTask) {
            return null;
        }
        return {
            name: this.syncTaskStream.currentTask.getName(),
            progress: this.syncTaskStream.currentTask.getCurrentProgress(),
            blockUI: this.syncTaskStream.currentTask.data && this.syncTaskStream.currentTask.data.blockUI
        };
    }
    
    onChange(events: [string, AutoTask, any][]) {
        let onlyProgress: boolean = null;
        let progressData: any = null;
        Event.applyEvents(events, (type, _task, data) => {
            if (type == "task-progress") {
                if (onlyProgress == null) {
                    onlyProgress = true;
                }
                progressData = data;
            }
            else {
                onlyProgress = false;
            }
        });
        if (onlyProgress) {
            this.callViewMethod("setProgress", progressData);
        }
        else {
            this.callViewMethod("render", this.getModel());
        }
    }
}
