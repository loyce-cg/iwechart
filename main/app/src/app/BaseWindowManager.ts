import {CloseEvent, WindowStateListener, ChangeState} from "./Types";
import {Window} from "./common/window/Window";
import {BaseWindowController} from "../window/base/BaseWindowController";
import * as RootLogger from "simplito-logger";
import { CssVariables } from "./common/customization/CssParser";
import { CustomizationData } from "./common/customization/CustomizationData";
import { ElectronWindow } from "./electron/window/ElectronWindow";
import * as Q from "q";

let Logger = RootLogger.get("privfs-mail-client.app.BaseWindowManager");

export interface WindowChild<T extends BaseWindowController> {
    manager: BaseWindowManager<T>,
    lastChange?: ChangeState
}

export class BaseWindowManager<T extends BaseWindowController> {
    
    static readonly STATE_IDLE: string = "idle";
    static readonly STATE_DIRTY: string = "dirty";
    static readonly STATE_CLOSING: string = "closing";
    static readonly STATE_FINISHED: string = "finished";
    static readonly STATE_CLOSE_CANCELLED: string = "close_cancelled";
    
    static readonly CHECK_INTERVAL: number = 100;
    static readonly KILL_TIMEOUT: number = 5000;
    
    registeredSingletons: {[name: string]: BaseWindowManager<T>} = {};
    registeredWindows: {[uid: string]: BaseWindowManager<T>} = {};

    
    uid: string;
    nextChildNum: number = -1;
    parent: BaseWindowManager<T>;
    state: ChangeState;
    dockedId: number;
    children: {[windowId: string]: BaseWindowManager<T>};
    closingChildrenUIDs: string[];
    stateListeners: WindowStateListener[] = [];
    childrenListener: WindowStateListener = {
        onStateChange: this.onChildStateChanged.bind(this)
    }
    
    controller: BaseWindowController;
    window: Window;
    singletonName?: string;
    mainCloseTimer: any;
    childrenCloseTimer: any;
    killAppWindowsTimer: any;
    windowsToClose: {[uid: string]: BaseWindowManager<T>} = {};
    beforeClosingFinished: boolean = false;
    afterChildWindowsCloseFinished: boolean = false;
    onCloseFinished: boolean = false;
    killWindowsDefer: Q.Deferred<void>;
    
    
    constructor(controller: BaseWindowController, parent: BaseWindowManager<T>) {
        this.children = {};
        this.controller = controller;
        if (this.controller) {
            this.controller.manager = this;
        }
        this.window = controller ? controller.nwin : null;
        this.parent = parent;
        this.uid = this.parent ? this.parent.getNextChildUID() : "/0";
        
        this.state = {
            time: new Date().getTime(),
            state: BaseWindowManager.STATE_IDLE,
            id: this.uid
        }
    }
    
    openChild(child: BaseWindowManager<T>, singletonName?: string, dockedId?: number): boolean {
        this.dockedId = dockedId;
        if (singletonName) {
            if (!this.isSingletonRegistered(singletonName)) {
                this.registerSingleton(singletonName, child);
            }
            else {
                return false;
            }
        }
        child.registerStateListener(this.childrenListener);
        child.parent = this;
        this.children[child.uid] = child;
        this.registerWindow(child.uid, child);
        return true;
    }
    
    onToolbarCloseClick(): void {
        this.close();
    }
    
    getTopParent(): BaseWindowManager<T> {
        if (this.parent) {
            return this.parent.getTopParent();
        }
        return this;
    }
    
    getFocusedWindow(): BaseWindowManager<T> {
        let topParent = this.getTopParent();
        if (topParent.isFocused()) {
            return topParent;
        }
        else {
            return this.getFocusedChild();
        }
    }
    
    getFocusedChild(): BaseWindowManager<T> {
        let focused: BaseWindowManager<T> = null;
        for (let childId in this.children) {
            let child = this.children[childId];
            if (child) {
                if (child.isFocused()) {
                    focused = child;
                    break;
                }
                else {
                    focused = child.getFocusedChild();
                }
            }
            else {
                focused = null;
            }
            if (focused) {
                break;
            }
        }
        return focused;
    }
    
    isMainWindow(): boolean {
        // return this.getControllerName() == "ContainerWindowController";
        return this.controller && this.controller.isMainAppWindow;
    }

    getMainWindow(): BaseWindowManager<T> {
        let topParent = this.getTopParent();
        let mainWindow: BaseWindowManager<T> = null;

        for (let uid in topParent.registeredWindows) {
            if (topParent.registeredWindows[uid].controller && topParent.registeredWindows[uid].controller.isMainAppWindow) {
                mainWindow = topParent.registeredWindows[uid];
            }
        }
        return mainWindow;
    }
    
    hasNwin(window: BaseWindowManager<T>): boolean {
        return window.controller && window.controller.nwin != null;
    }
    
    isFocused(): boolean {
        if (this.hasNwin(this)) {
            return this.controller.nwin.isFocused();
        }
        return false;
    }
    
    isSingletonRegistered(singletonName: string) {
        let topParent = this.getTopParent();
        return (singletonName in topParent.registeredSingletons);
    }
    
    registerSingleton(singletonName: string, manager: BaseWindowManager<T>) {
        let topParent = this.getTopParent();
        if (!(singletonName in topParent.registeredSingletons)) {
            manager.singletonName = singletonName;
            topParent.registeredSingletons[singletonName] = manager;
        }
    }
    
    unregisterSingleton(singletonName: string) {
        let topParent = this.getTopParent();
        if (singletonName in topParent.registeredSingletons) {
            delete topParent.registeredSingletons[singletonName];
        }
    }
    
    getSingleton(singletonName: string) {
        let topParent = this.getTopParent();
        if (singletonName in topParent.registeredSingletons) {
            return topParent.registeredSingletons[singletonName];
        }
        return null;
    }


    registerWindow(uid: string, manager: BaseWindowManager<T>) {
        let topParent = this.getTopParent();
        if (!(uid in topParent.registeredWindows)) {
            topParent.registeredWindows[uid] = manager;
        }
    }
    
    unregisterWindow(uid: string) {
        let topParent = this.getTopParent();
        if (uid in topParent.registeredWindows) {
            delete topParent.registeredWindows[uid];
        }
    }
    
    getWindowByUid(uid: string) {
        let topParent = this.getTopParent();
        if (uid in topParent.registeredWindows) {
            return topParent.registeredWindows[uid];
        }
        return null;
    }
    isOpenedByName(_name: string) {
    }
    
    close(force?: boolean) {
        let prevented = false;

        if (this.isWindowsTreeDirty() && !force) {
            return;
        }
        let event: CloseEvent = {
            prevented: prevented,
            type: "close",
            isPrevented: (): boolean => {
                return prevented;
            },
            preventDefault: () => {
                prevented = true;
            }
        };
        this.processClosing(event, force);
    }
    
    closeChildren(parent: BaseWindowManager<T>, force?: boolean): void {
        let prevented = false;
        let event: CloseEvent = {
            prevented: prevented,
            type: "close",
            isPrevented: (): boolean => {
                return prevented;
            },
            preventDefault: () => {
                prevented = true;
            }
        };
        //check this window state
        if (parent.getActiveChildrenCount() > 0) {
            this.closingChildrenUIDs = [];
            // console.log("closing children..");
            parent.closeInner(event, force);
        }
    }
    
    scheduleClose(event: CloseEvent, force?: boolean): void {
        // console.log("scheduleClose", this.getControllerName(), this.uid);
        if(this.state && this.state.state != BaseWindowManager.STATE_CLOSE_CANCELLED && !this.onCloseFinished) {
            clearTimeout(this.mainCloseTimer);
            this.mainCloseTimer = setTimeout(() => {
                this.processClosing(event, force);
            }, BaseWindowManager.CHECK_INTERVAL);
        }
    }
    
    getControllerName(): string {
        if (this.controller) {
            return (<any>this.controller).constructor.name;
        }
        else {
            return "no controller";
        }
    }
    
    processClosing(event: CloseEvent, force?: boolean): void {
        
    //    console.log("process closing ", this.getControllerName(), this.state.state);
        let state = this.state;
        this.scheduleClose(event, force);
        state = this.state;
        if (!this.beforeClosingFinished && state && state.state == BaseWindowManager.STATE_IDLE) {
            if (this.controller) {
                try {
                    // console.log("processClosing beforeClose", this.getControllerName(), this.uid);
                    this.controller.beforeClose(force);
                } catch (e) {}
            }
            this.beforeClosingFinished = true;
        }
        
        state = this.state;
        if (!this.afterChildWindowsCloseFinished && state && state.state == BaseWindowManager.STATE_IDLE) {
            //check this window state
            // console.log("processClosing checking children", this.getControllerName(), this.uid);

            if (this.getActiveChildrenCount() > 0) {
                // console.log('there are', this.getActiveChildrenCount(), "active children");
                this.closeInner(event, force);
                return;
            }

            if (this.controller) {
                try {
                    // console.log("processClosing afterChildrenClose", this.getControllerName(), this.uid);

                    this.controller.afterChildWindowsClose(force);
                } catch (e) {}
            }
            this.afterChildWindowsCloseFinished = true;
        }
        
        state = this.state;
        if (!this.onCloseFinished && state && state.state == BaseWindowManager.STATE_IDLE) {
            if (this.controller) {
                try {
                    if (this.singletonName) {
                        this.unregisterSingleton(this.singletonName);
                    }
                    if (this.controller && this.controller.nwin && (<ElectronWindow>this.controller.nwin).window) {
                        (<ElectronWindow>this.controller.nwin).window.setClosable(true);
                    }
                    // console.log("processClosing close", this.getControllerName(), this.uid);

                    this.closeThisWindow();
                } catch (e) {}
            }
            if(this.parent) {
                this.parent.destroyChild(this.uid);
            }
        }
        
        if(this.parent) {
            if (this.parent.checkForTimeout(this.uid)) {
                this.parent.destroyChild(this.uid);
            }
        }
        this.scheduleClose(event, force);
    }

    closeThisWindow() {
        let parent = this.parent;
        let uid = this.uid;
        this.controller.onClose();
        this.onCloseFinished = true;
        clearTimeout(this.mainCloseTimer);
        this.stateListeners = null;
        this.childrenListener = null;
        this.controller.app.removeFromObjectMap(this.controller.id);

        if (this.singletonName) {
            if (this.isSingletonRegistered(this.singletonName)) {
                this.unregisterSingleton(this.singletonName);
            }
        }
        this.controller.destroy();
        this.destroy();
        if(parent) {
            parent.destroyChild(uid);
        }

    }
    
    closeInner(event: CloseEvent, force?: boolean) {
        if (event.isPrevented() && !force) {
            return;
        }
        if (!this.closingChildrenUIDs) {
            this.closingChildrenUIDs = [];
        }
        for (let item in this.children) {
            if (this.closingChildrenUIDs.indexOf(item) == -1) {
                this.closingChildrenUIDs.push(item);
            }
        }

        this.closingChildrenUIDs.forEach(item => {
            this.checkAndCloseChildren(item, event, force);
        });
        if (this.getActiveClosingChildrenCount() > 0) {
            clearTimeout(this.childrenCloseTimer);
            this.childrenCloseTimer = setTimeout(() => {
                this.refreshState();
                this.closeInner(event, force);
            }, BaseWindowManager.CHECK_INTERVAL);
        }
    }
    
    cancelClosing(excludeUid: string = null, propagateUp: boolean = true): void {
        try {
            let exclude = excludeUid ? excludeUid : this.uid;
            clearTimeout(this.mainCloseTimer);
            clearTimeout(this.childrenCloseTimer);
            clearTimeout(this.killAppWindowsTimer);
            for(let item in this.children) {
                if (this.children[item]) {
                    if (this.children[item].uid != excludeUid) {
                        this.children[item].cancelClosing(exclude, false);
                    }
                }
            }
            
            let state = this.getState();
            if (state && (state.state == BaseWindowManager.STATE_CLOSING || state.state == BaseWindowManager.STATE_DIRTY)) {
                this.stateChanged(BaseWindowManager.STATE_CLOSE_CANCELLED);
            }
            
            this.afterChildWindowsCloseFinished = false;
            this.beforeClosingFinished = false;
            this.onCloseFinished = false;
            
            if (this.parent && propagateUp) {
                this.parent.cancelClosing(exclude, propagateUp);
            }
        }
        catch (e) {
            Logger.error("error on cancelClose", e);
        }
    }
    
    
    destroyChild(uid: string) {
        if(uid in this.children) {
            this.children[uid].destroy();
            this.children[uid] = null;
            delete this.children[uid];
        }
    }
    
    destroy(): void {
        if (this.controller) {
            if (this.controller.nwin) {
                this.controller.nwin.close(true);
            }
            this.controller.nwin = null;
            this.controller.destroy();
            this.controller = null;
        }
    }
    
    ////////////////
    /// Util methods
    ////////////////
    
    isWindowsTreeDirty(): boolean {
        let dirty: boolean = false;
        for (let childUid in this.children) {
            let childDirty = this.children[childUid].isWindowsTreeDirty();
            if (childDirty) {
                dirty = true;
                return dirty;
            }
        }
        if (!dirty) {
            dirty = this.state.state == BaseWindowManager.STATE_DIRTY;// || this.state.state == BaseWindowManager.STATE_CLOSING;
        }
        return dirty;
    }

    isWindowsTreeWaitForClosing(): boolean {
        let dirty: boolean = false;
        for (let childUid in this.children) {
            let childDirty = this.children[childUid].isWindowsTreeWaitForClosing();
            if (childDirty) {
                dirty = true;
                return dirty;
            }
        }
        if (!dirty) {
            dirty = this.state.state == BaseWindowManager.STATE_CLOSING;
        }
        return dirty;
    }    
    
    checkAndCloseChildren(uid: string, _event: CloseEvent, force?: boolean) {
        let child = this.children[uid];
        if (child) {
            let status = child.state;
            if(status && status.state == BaseWindowManager.STATE_FINISHED) {
                this.children[uid] = null;
            }
            else {
                child.close(force);
            }
        } else {
            let closingIndex = this.closingChildrenUIDs.indexOf(uid);
            if (closingIndex) {
                this.closingChildrenUIDs.splice(closingIndex,1);
            }
        }
    }
    
    checkForTimeout(uid: string): boolean {
            let child = this.children[uid];
            let nowTime = new Date().getTime();
            if (child && child.state.state != BaseWindowManager.STATE_DIRTY && child.state.time < nowTime - BaseWindowManager.KILL_TIMEOUT) {
                return true;
            }
            return false;
    }

    getActiveChildrenCount(): number {
        let count: number = 0;
        for (let item in this.children) {
            if (this.children[item]) {
                count++;
            }
        }
        return count;
    }
    
    getActiveClosingChildrenCount(): number {
        let count: number = 0;
        for (let item in this.closingChildrenUIDs) {
            if (this.children[item]) {
                count++;
            }
        }
        return count;
    }
    
        
    getNextChildUID(): string {
        return this.uid + "/" + (++this.nextChildNum).toString();
    }
    
    // children state control methods
    stateChanged(state: string) {
        let stateObj: ChangeState = {
            id: this.uid,
            state: state,
            time: (new Date()).getTime()
        }
        this.stateListeners.forEach(listener => {
            listener.onStateChange(stateObj);
        });
    }
    
    registerStateListener(listener: WindowStateListener): void {
        if (listener) {
            this.stateListeners.push(listener);
        }
    }
    
    onChildStateChanged(state: ChangeState): void {
        this.children[state.id].state = state;
        
        if (state.state == BaseWindowManager.STATE_CLOSE_CANCELLED) {
            // resetujemy state po cancel
            setTimeout(() => {
                this.children[state.id].state.state = BaseWindowManager.STATE_IDLE;
            }, BaseWindowManager.CHECK_INTERVAL * 2);
        }
    }
    
    getState(): ChangeState {
        if (this.parent && this.parent.children[this.uid] && this.parent.children[this.uid].state) {
            return this.parent.children[this.uid].state;
        }
        return null;
    }
    
    refreshState(): void {
        if (this.parent && this.parent.children[this.uid] && this.parent.children[this.uid].state) {
            this.parent.children[this.uid].state.time = new Date().getTime();
        }
    }
    
    propagateCustomizedTheme(theme: CustomizationData): void {
        if (this.controller) {
            this.controller.setCustomizedTheme(theme);
        }
        for (let childId in this.children) {
            this.children[childId].propagateCustomizedTheme(theme);
        }
    }

    
    compareUids(a: string, b: string): number {
        if (a.localeCompare(b) == 0) {
            return 0;
        }
        else {
            const aArr = a.split("/");
            const bArr = b.split("/");
            let minLength = Math.min(a.length, b.length);
            for (let i = 0; i < minLength; i++) {
                let aNum = Number(aArr[i]);
                let bNum = Number(bArr[i]);
                if (aNum > bNum) {
                    return 1;
                }
                if (aNum == bNum) {
                    continue;
                }
                if (aNum < bNum) {
                    return -1;
                }
                if (aArr.length > bArr.length) {
                    return 1;
                }
                if (aArr.length == bArr.length) {
                    return 0;
                }
                if (aArr.length < bArr.length) {
                    return -1;
                }

            }
        }
    }
    
    
    getOpenedWindowsCount(): number {
        let c = 0;
        let top = this.getTopParent();
        for (let uid in top.registeredWindows) {
            if (top.registeredWindows[uid] != null) {
                c++;
            }
        }
        return c;
    }

    getMyAndAllChildrenUids(parent: BaseWindowManager<T>): string[] {
        let ret: string[] = [];

        if (parent.children) {
            for (let uid in parent.children) {
                ret = ret.concat(parent.children[uid].getMyAndAllChildrenUids(parent.children[uid]));
            }
        }
        ret.push(parent.uid);
        return ret;
    }

    closeUserWindows(windowsList?: string[]): void {
        let list = windowsList || this.getClosableWindows();
        list.forEach(x => {
            let wnd = this.getWindowByUid(x);
            if (! this.isWindowsTreeDirty()) {
                wnd.close();
            }
        })
    }    

    killAppWindows(): Q.Promise<void> {
        let defer = Q.defer<void>();
        let top = this.getTopParent();
        // if (top.isWindowsTreeDirty()) {
        //     top.cancelClosing();
        //     defer.reject("cancel-logout");
        // }
        // else {
            this.closeUserWindows();
            this.killAppWindowsTimer = setTimeout(() => {
                if (this.isWindowsTreeDirty() || this.isWindowsTreeWaitForClosing() || this.getClosableWindows().length > 0) {
                    defer.resolve(this.killAppWindows());
                }
                else {
                    defer.resolve();
                }
            }, 500);
        // }

        
        return defer.promise;
    }

    getClosableWindows(): string[] {
        let top = this.getTopParent();
        let main = this.getMainWindow();
        let list = this.getMyAndAllChildrenUids(this.getTopParent());
        
        let filtered: string[] = [];
        list.sort((a, b) => this.compareUids(b, a));
    
        list.forEach(x => {
            if (x != main.uid && x != top.uid && x.indexOf(main.uid + "/") != 0 && this.compareUids(main.uid, x) == -1) {
                filtered.push(x);
            }
        })             
        return filtered;
    }
}