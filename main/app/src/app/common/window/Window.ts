import {Events} from "../../../utils/Events";
import {app} from "../../../Types";

export abstract class Window {
    
    events: Events;
    dockedWindows: {[id: string]: DockedWindow};
    hidden: boolean;
    
    constructor() {
        this.events = new Events();
        this.dockedWindows = {};
    }
    
    isDocked(): boolean {
        return false;
    }
    
    abstract sendIpc(channel: string, data: any): void;
    
    abstract setTitle(title: string): void;
    
    abstract focus(): void;
    
    abstract close(force?: boolean): void;
    
    abstract start(): void;
    
    abstract hideLoadingScreen(): void;
    
    abstract toggleDistractionFreeMode(): void;
    
    abstract toggleDistractionFreeModeFromDocked(route: string[]): void;
    
    on(eventName: string, callback: Function): void {
        this.events.on(eventName, callback);
    }
    
    createDockedWindow(id: number, load: app.WindowLoadOptions, options: app.WindowOptions, controllerId: number, ipcChannelName: string, app: CommonApplication) {
        let docked = new DockedWindow(this, id, load, options, controllerId, ipcChannelName, app);
        this.dockedWindows[id] = docked;
        return docked;
    }
    
    abstract sendFromDocked(route: string[], name: string, data: any): void;
    
    onDockedEvent(sender: any, event: {name: string, route: string[]}): void {
        if (event.route.length == 0) {
            this.events.trigger(event.name);
        }
        event = {name: event.name, route: event.route.slice()};
        let id = event.route.pop();
        if (id in this.dockedWindows) {
            this.dockedWindows[id].onDockedEvent(sender, event);
        }
    }
    
    abstract setDirty(dirty: boolean): void;
    
    abstract setClosable(closable: boolean): void;
    
    abstract getClosable(): boolean;
    
    abstract setIcon(icon: string): void;
    
    abstract getPosition(): app.Position;
    
    abstract setPosition(x: number, y: number): void;
    
    abstract getPositionX(): number;
    
    abstract getPositionY(): number;
    
    abstract setPositionX(x: number): void;
    
    abstract setPositionY(y: number): void;
    
    abstract getSize(): app.Size;
    
    abstract setSize(width: number, height: number): void;
    
    abstract setInnerSize(width: number, height: number): void;
    
    abstract getWidth(): number;
    
    abstract getHeight(): number;
    
    abstract setWidth(width: number): void;
    
    abstract setHeight(height: number): void;
    
    abstract getWindowState(): app.WindowState;
    
    abstract getRestoreState(): app.WindowState;
    
    abstract minimize(): void;
    
    abstract minimizeToggle(): void;
    
    abstract isMinimized(): boolean;
    
    abstract maximize(): void;
    
    abstract maximizeToggle(): void;
    
    abstract isMaximized(): boolean;
    
    abstract show(): void;
    
    abstract hide(): void;
    
    abstract openContextMenu(): void;
    
    abstract isFocused(): boolean;
    
    abstract getResizable(): boolean;
    
    abstract setResizable(resizable: boolean): void;
    
    abstract getParent(): Window;
    
    abstract setZoomLevel(zoomLevel: number): void;
    
    abstract removeSpinner(): void;
    
    updatePreTitleIcon(icon: app.PreTitleIcon): void {   
    }
    updateSpellCheckerLanguages(): void {
    }
    
    getAvailableSpellCheckerLangauges(): string[] {
        return [];
    }

    // destroy(): void {
    //     console.log("window.destroy")
    //     this.events.clear();
    //     this.events.map = {};
    //     console.log("clearing docked windows")
    //     for (let id in this.dockedWindows) {
    //         this.dockedWindows[id].destroy();
    //         this.dockedWindows[id] = null;
    //         delete this.dockedWindows[id];
    //     }
    // }
    
    abstract isAlwaysOnTop(): boolean;
    abstract setAlwaysOnTop(alwaysOnTop: boolean): void;
    
    abstract center(): void;
    
}

import {DockedWindow} from "./DockedWindow";import { CommonApplication } from "..";

