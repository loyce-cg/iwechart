import {ComponentView} from "./ComponentView";
import {ComponentController} from "./ComponentController";

export interface CreateExResult<T, U> {
    view: T;
    ipcChannelName: string;
    initPromise: Q.Promise<void>
}

export class ComponentInitializer {
    
    static init<T extends ComponentView, U extends ComponentController>(view: T, ipcChannelName: string): CreateExResult<T, U> {
        view.ipcChannelName = ipcChannelName;
        return {
            view: view,
            ipcChannelName: ipcChannelName,
            initPromise: view.triggerInit()
        };
    }
    
    static initAndSetContainer<T extends ComponentView&{$container: JQuery}, U extends ComponentController>(view: T, ipcChannelName: string, $container: JQuery): CreateExResult<T, U> {
        view.$container = $container;
        return ComponentInitializer.init(view, ipcChannelName);
    }
}
