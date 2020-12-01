import { CommonApplication } from "../CommonApplication";
import * as Utils from "simplito-utils";
import * as RootLogger from "simplito-logger";
import * as Q from "q";
import { RegisteredApplication, ApplicationBinding, ShellOpenOptions, ShellOpenAction, ShellAppActionOptions, ShellActionType } from "./ShellTypes";
let Logger = RootLogger.get("privfs-mail-client.ShellRegistry");
import * as privfs from "privfs-client";
import { BaseWindowController } from "../../../window/base/BaseWindowController";
import {app, event} from "../../../Types";
import { Lang } from "../../../utils/Lang";
import { Window as AppWindow } from "../window/Window";

export class ShellRegistry {
  
    applicationMap: {[id: string]: RegisteredApplication} = {};
    applicationActionsMap: {[id: string]: ShellAppActionOptions} = {};
    bindings: ApplicationBinding[] = [];
    icons: {
        explicit: {[mimetype: string]: string};
        regex: {[mimetype: string]: string};
        defaultIcon: string;
    } = {explicit: {}, regex: {}, defaultIcon: "fa fa-file-o"};
    
    constructor(public app: CommonApplication) {
    }
    
    resolveApplicationByElement(options: ShellOpenOptions): RegisteredApplication {
        let mimeType = options.element.getMimeType();
        let eles: ApplicationBinding[] = [];
        let action = options.action || ShellOpenAction.OPEN;
        //direct action check
        if (eles.length == 0) {
            eles = this.bindings.filter(binding => {
                return binding.action == action && binding.mimeType == mimeType;
            });
        }
        if (eles.length == 0) {
            eles = this.bindings.filter(binding => {
                return binding.action == action && Utils.endsWith(binding.mimeType, "*") && Utils.startsWith(mimeType, binding.mimeType.substring(0, binding.mimeType.length - 1));
            });
        }
        if (eles.length == 0) {
            eles = this.bindings.filter(binding => {
                return binding.action == action && binding.mimeType == "*";
            });
        }
        //ANY and null action check
        if (eles.length == 0) {
            eles = this.bindings.filter(binding => {
                return (!binding.action || binding.action == ShellOpenAction.ANY) && binding.mimeType == mimeType;
            });
        }
        if (eles.length == 0) {
            eles = this.bindings.filter(binding => {
                return (!binding.action || binding.action == ShellOpenAction.ANY) && Utils.endsWith(binding.mimeType, "*") && Utils.startsWith(mimeType, binding.mimeType.substring(0, binding.mimeType.length - 1));
            });
        }
        if (eles.length == 0) {
            eles = this.bindings.filter(binding => {
                return (!binding.action || binding.action == ShellOpenAction.ANY) && binding.mimeType == "*";
            });
        }
        let app = eles[0];
        return app ? this.applicationMap[app.applicationId] : null;
    }
    
    registerApp(app: RegisteredApplication) {
        if (this.applicationMap && app.id in this.applicationMap) {
            throw new Error("ShellRegistry - Client's id already in use.");
        }
        this.applicationMap[app.id] = app;
    }
    
    registerAppEx(app: RegisteredApplication) {
        this.registerApp({
            id: app.id,
            open: options => {
                return this.openOrGetOpenedWindow(options, app.id, parent => {
                    let opt = Lang.shallowCopy(options);
                    opt.parent = parent;
                    return app.open(opt);
                });
            }
        });
    }
    
    openOrGetOpenedWindow(options: ShellOpenOptions, windowType: string, creator: (parent: app.WindowParentEx) => Q.Promise<BaseWindowController>): Q.Promise<BaseWindowController> {
        if (options.docked) {
            let parent = options.parent || this.app;
            return creator(parent);
        }
        else {
            if (options.action == ShellOpenAction.PRINT) {
                windowType = ".printMode";
            }
            let isOpen = this.app.tryBringWindowToTop(options, windowType);
            if (isOpen) {
                let win = this.app.getOpenedElementsManager().getByElementAndWindowType(options.element, windowType).window;
                try {
                    win.nwin.focus();
                }
                catch (e) {
                    Logger.debug("Error during trying to focus window", e);
                }
                return Q(win);
            }
            else {
                let parent = options.parent || this.app;
                return creator(parent).then(win => {
                    this.app.getOpenedElementsManager().add({
                        element: options.element,
                        window: win,
                        windowId: win.id,
                        windowType: windowType
                    });
                    let def = Q.defer<BaseWindowController>();
                    parent.openChildWindow(win, def);
                    return def.promise;
                });
            }
        }
    }
    
    shellOpen(options: ShellOpenOptions): Q.Promise<BaseWindowController> {
        let application = options.applicationId ? this.applicationMap[options.applicationId] : this.resolveApplicationByElement(options);
        if (application == null) {
            throw new Error("Cannot perform shell open at given parameter");
        }
        this.app.dispatchEvent<event.FileOpenedEvent>({
            type: "file-opened",
            element: options.element,
            applicationId: options.applicationId,
            docked: options.docked,
            action: options.action,
            hostHash: options.session ? options.session.hostHash : this.app.sessionManager.getLocalSession().hostHash,
        });
        return application.open(options);
    }
        
    registerApplicationBinding(binding: ApplicationBinding) {
        this.bindings.push(binding);
    }
    
    registerAppAction(appAction: ShellAppActionOptions): void {
        if (appAction.id in this.applicationActionsMap) {
            throw new Error("ShellRegistry - Application's action already registered.");
        }
        this.applicationActionsMap[appAction.id] = appAction;
    }
    
    getAppAction(actionId: string): ShellAppActionOptions {
        return this.applicationActionsMap[actionId];
    }
    
    callAppAction(actionId: string, filename?: string, parentWindow?: AppWindow): Q.Promise<privfs.lazyBuffer.IContent> {
        //method have to be written in this way couse app.onCall() can call fileChooser which has to be called in the same tick
        try {
            Logger.debug("Calling action", actionId);
            if (actionId in this.applicationActionsMap) {
                Logger.debug("action found");
                let res = this.applicationActionsMap[actionId].onCall(filename, parentWindow);
                return Q().then(() => res);
            }
            else {
                throw new Error("Action '" + actionId + "' does not exist");
            }
        }
        catch (e) {
            return Q.reject(e);
        }
    }
    
    callAppMultiAction(actionId: string, filenames?: string[], parentWindow?: AppWindow): Q.Promise<privfs.lazyBuffer.IContent[]> {
        //method have to be written in this way couse app.onCall() can call fileChooser which has to be called in the same tick
        try {
            Logger.debug("Calling action", actionId);
            if (actionId in this.applicationActionsMap) {
                Logger.debug("action found");
                let res = this.applicationActionsMap[actionId].onCallMulti(filenames, parentWindow);
                return Q().then(() => res);
            }
            else {
                throw new Error("Action '" + actionId + "' does not exist");
            }
        }
        catch (e) {
            return Q.reject(e);
        }
    }
    
    getActions(actionType: ShellActionType): ShellAppActionOptions[] {
        let list: ShellAppActionOptions[] = [];
        for (let id in this.applicationActionsMap) {
            let action = this.applicationActionsMap[id];
            if (action.type == actionType) {
                list.push(action);
            }
        }
        return list;
    }
    
    registerMimetypeIcon(mimeType: string, icon: string): void {
        if (Utils.endsWith(mimeType, "*")) {
            this.icons.regex[mimeType.substring(0, mimeType.length - 1)] = icon;
        }
        else {
            this.icons.explicit[mimeType] = icon;
        }
    }
    
    resolveIcon(mimeType: string): string {
        if (mimeType in this.icons.explicit) {
            return this.icons.explicit[mimeType];
        }
        for (let m in this.icons.regex) {
            if (Utils.startsWith(mimeType, m)) {
                return this.icons.regex[m];
            }
        }
        return this.icons.defaultIcon;
    }
}
