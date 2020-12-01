import {ComponentController} from "../../component/base/ComponentController";
import {BaseWindowController} from "./BaseWindowController";
import {CommonApplication} from "../../app/common/CommonApplication";
import {IOC} from "../../mail/IOC";
import {ComponentFactory} from "../../component/main";

export class WindowComponentController<T extends BaseWindowController> extends ComponentController {
    
    parent: T;
    app: CommonApplication;
    ioc: IOC;
    componentFactory: ComponentFactory;
    errorCallback: (e: any) => void;
    logErrorCallback: (e: any) => void;
    logError: (e: any) => void;
    onError: (e: any) => Q.IWhenable<any>;
    onErrorCustom: (text: string, e: any) => Q.IWhenable<any>;
    prepareErrorMessage: (e: any, preFn?: (error: {code: number, message: string}) => {code: number, message: string}) => string;
    addTask: (text: string, blockUI: boolean, taskFunction: () => Q.IWhenable<any>) => Q.Promise<void>;
    addTaskEx: (text: string, blockUI: boolean, taskFunction: () => Q.IWhenable<any>) => Q.Promise<void>;
    addTaskExWithProgress: (text: string, blockUI: boolean, channelId: number, taskFunction: (progress: (data?: any) => void) => Q.IWhenable<any>) => Q.Promise<void>;
    i18n: (key: string, ...args: any[]) => string;
    onViewOpenUrl: (url: string) => void;
    
    constructor(parent: T) {
        super(parent);
        this.ipcMode = true;
        this.app = this.parent.app;
        this.ioc = this.app.ioc;
        this.componentFactory = this.ioc;
        this.errorCallback = this.parent.errorCallback;
        this.logErrorCallback = this.parent.logErrorCallback;
        this.logError = this.parent.logError.bind(this.parent);
        this.onError = this.parent.onError.bind(this.parent);
        this.onErrorCustom = this.parent.onErrorCustom.bind(this.parent);
        this.prepareErrorMessage = this.parent.prepareErrorMessage.bind(this.parent);
        this.addTask = this.parent.addTask.bind(this.parent);
        this.addTaskEx = this.parent.addTaskEx.bind(this.parent);
        this.addTaskExWithProgress = this.parent.addTaskExWithProgress.bind(this.parent);
        this.i18n = this.parent.i18n.bind(this.parent);
        this.onViewOpenUrl = this.parent.onViewOpenUrl.bind(this.parent);
    }
}
