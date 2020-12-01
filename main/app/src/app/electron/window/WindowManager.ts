import {ElectronWindow} from "./ElectronWindow";
import * as Q from "q";
import {app} from "../../../Types";
import {AssetsManager} from "../../../app/common/AssetsManager";
import { BaseWindowController } from "../../../window/base/BaseWindowController";
import { ElectronApplication } from "../ElectronApplication";

export interface ExtWindowOptions extends app.WindowOptions {
    windowHeight?: number,
    windowWidth?: number,
    windowTop?: number,
    windowLeft?: number,
    fullscreen?: boolean,
}


export class WindowManager {
    
    windows: ElectronWindow[];
    screen: Electron.Screen;
    defaultBarPosition: string;

    constructor(
        public onWindowCloseCallback: Function,
        public onWindowChangeFocusCallback: Function,
        public onWindowMaximizeToggleCallback: Function,
        public onGetMenuCallback: Function,
        public statusHolder: {isQuitting(): boolean},
        public assetsManager: AssetsManager,
        public app: ElectronApplication
    ) {
        this.windows = [];
        this.screen = require('electron').screen;
    }
    
    isQuitting() {
        return this.statusHolder.isQuitting();
    }
    
    open(load: app.WindowLoadOptions, options: app.WindowOptions, controller: BaseWindowController, parent: ElectronWindow): ElectronWindow {
        let window = new ElectronWindow(this, load, options, controller.id, controller.getIpcChannelName(), parent, {
            copy: controller.copy.bind(controller),
            cut: controller.cut.bind(controller),
            paste: controller.paste.bind(controller),
        });
        this.windows.push(window);
        
        return window;
    }
    
    onDocked(event: {sender: Electron.WebContents, data: any}, arg: any): void {
        for (let i = 0; i < this.windows.length; i++) {
            if (event.sender == this.windows[i].window.webContents) {
                this.windows[i].onDockedEvent(event, arg);
                break;
            }
        }
    }
    
    onClosed(window: ElectronWindow): void {
        let index = this.windows.indexOf(window);
        if (index != -1) {
            this.windows[index] = null;
            this.windows.splice(index, 1);
        }
        this.onChangeFocus();
        this.onWindowCloseCallback();
    }
    
    onMaximizeToggle(): void {
        this.onWindowMaximizeToggleCallback();
    }
    
    reloadAllWindows(): void {
        for (let i = 0; i < this.windows.length; i++) {
            this.windows[i].window.reload();
        }
    }
    
    center(window: ElectronWindow): void {
        let parent = window && window.parent ? window.parent : null;
        let screenBounds = (parent && parent.window ? this.screen.getDisplayMatching(<Electron.Rectangle>parent.window.getBounds()) : this.screen.getDisplayNearestPoint(this.screen.getCursorScreenPoint())).bounds;
        this.centerInsideRect(window, screenBounds);
    }
    
    centerInsideParent(window: ElectronWindow, parent: ElectronWindow): void {
        if (!parent || !parent.window) {
            return;
        }
        this.centerInsideRect(window, parent.window.getBounds());
    }
    
    centerInsideRect(window: ElectronWindow, rect: Electron.Rectangle) {
        if (!window.window) {
            return;
        }
        let windowBounds = window.window.getBounds();
        window.window.setBounds({
            x: Math.floor(rect.x + (rect.width - windowBounds.width) / 2),
            y: Math.floor(rect.y + (rect.height - windowBounds.height) / 2),
            width: windowBounds.width,
            height: windowBounds.height
        });
    }
    
    setWindowsTitleBarButtonsPosition(position: string) {
        this.defaultBarPosition = position;
        this.windows.forEach(x => {
            x.setWindowsTitleBarButtonsPosition(position);
        });
    }
    
    onChangeFocus() {
        let anyFocused = false;
        for (let i=0;i< this.windows.length; i++) {
            anyFocused = anyFocused || this.windows[i].window.isFocused();
        }
        
        this.onWindowChangeFocusCallback(anyFocused);
    }
    
    onFocus(): void {
        this.app.onPrintCancelled();
    }
    
    getMainWindow(): ElectronWindow {
        if (!this.app.windows.container) {
            return null;
        }
        
        let wnd = <ElectronWindow>this.app.windows.container.nwin;
        return this.windows.indexOf(wnd) >= 0 ? wnd : null;
    }
    
    getMainBrowserWindow(): Electron.BrowserWindow {
        let mainWindow = this.getMainWindow();
        return mainWindow ? mainWindow.window : null;
    }

    getMainAppWindowId(): number {
        let mainWindow = this.getMainWindow();
        return mainWindow ? mainWindow.windowId : null;
    }
    
}
