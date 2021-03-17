import {Inject, Dependencies} from "../../../utils/Decorators";
import { ContextHistory } from "../contexthistory/ContextHistory";
import { ContainerWindowController } from "../../../window/container/ContainerWindowController";
import { BaseWindowManager } from "../../BaseWindowManager";
import { BaseWindowController } from "../../../window/base/main";
import * as RootLogger from "simplito-logger";
import { ContextType, Context } from "../contexthistory/Context";
let Logger = RootLogger.get("common.Router");

export class Router {
    constructor(
        private manager: BaseWindowManager<BaseWindowController>, 
        private contextHistory: ContextHistory
    ) {}
    
    public navigateTo(moduleName: string, contextType: ContextType, contextId: string, hostHash: string): void {
        let wndToOpen = this._getMainWindow(this.manager);
        if (wndToOpen) {
            const context = Context.create({
                moduleName, contextType, contextId, hostHash
            });
            this.contextHistory.append(context);
            wndToOpen.redirectToAppWindow(moduleName, context);

        }
    }

    public goNext(): void {
        try {
            if (! this.contextHistory.hasNext()) {
                return;
            } 
            const context = this.contextHistory.getNext();

            const wnd = this._getMainWindow(this.manager);
            if (wnd) {
                wnd.redirectToAppWindowFromHistory(context);
            }
            this.contextHistory.dispatchContextHistoryChangeEvent();
        }
        catch (e) {}
    }

    public goPrev(): void {
        try {
            if (! this.contextHistory.hasPrev()) {
                return;
            } 
            const context = this.contextHistory.getPrev();
            const wnd = this._getMainWindow(this.manager);
            if (wnd) {
                wnd.redirectToAppWindowFromHistory(context);
            }
            this.contextHistory.dispatchContextHistoryChangeEvent();
        }
        catch (e) {}
    }

    private _getMainWindow(manager: BaseWindowManager<BaseWindowController>): ContainerWindowController {
        try {
            const mainWnd = manager.getMainWindow();
            return <ContainerWindowController>mainWnd.controller;      
        }
        catch (e) {
            Logger.error("_getMainWindow failed");
        }
    }
}