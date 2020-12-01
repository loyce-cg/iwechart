import {ComponentController} from "../base/ComponentController";
import {MultiTaskStream} from "../../task/MultiTaskStream";
import {LocaleService} from "../../mail/LocaleService";
import {app} from "../../Types";
import {Inject} from "../../utils/Decorators";
import { i18n } from "./i18n";

export class StatusBarMainController extends ComponentController {
    
    static textsPrefix: string = "component.statusBarMain.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject localeService: LocaleService;
    
    multiTaskStream: MultiTaskStream;
    isSuspended: boolean = false;
    
    constructor(parent: app.IpcContainer, multiTaskStream: MultiTaskStream) {
        super(parent);
        this.ipcMode = true;
        this.multiTaskStream = multiTaskStream;
        this.registerChangeEvent(this.multiTaskStream.changeEvent, this.onChange, "multi");
    }
    
    suspend(): void {
        this.isSuspended = true;
    }
    
    resume():  void {
        this.isSuspended = false;
    }
    
    onChange(): void {
        if (this.isSuspended) {
            return;
        }
        let cTasks = this.multiTaskStream.getCurrentTasks();
        let minDiff: number = null;
        let currentDate = new Date().getTime();
        let important = false;
        let tasks: string[] = [];
        cTasks.forEach(task => {
            let diff = currentDate - task.getStartDate().getTime();
            if (diff < 100) {
                diff = 100 - diff;
                if (minDiff == null || minDiff > diff) {
                    minDiff = diff;
                }
                return;
            }
            important = important || task.name == "sink-polling";
            tasks.push(this.localeService.getTaskName(task.name));
        });
        if (minDiff != null) {
            setTimeout(this.onChange.bind(this), minDiff);
        }
        if (tasks.length == 0) {
            this.callViewMethod("hideTasksInfo");
        }
        else if (tasks.length == 1) {
            this.callViewMethod("showTasksInfo", tasks[0], important);
        }
        else {
            this.callViewMethod("showTasksInfo", this.localeService.i18n("app.task.runningCount", [tasks.length]));
        }
    }
}

