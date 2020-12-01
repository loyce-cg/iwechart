import { CommonApplication } from ".";

export interface Shortcut {
    id: string;
    accelerator?: string;
    defaultAccelerator: string;
    action?: () => void;
    registeredAccelerator?: string;
}

export interface StoredShortcuts {
    version: string;
    shortcuts: StoredShortcut[];
}

export interface StoredShortcut {
    id: string;
    accelerator: string;
}

export abstract class KeyboardShortcuts {
    
    static readonly VERSION: string = "1.0";
    
    static defaultShortcuts: Shortcut[] = [
        { id: "global.showHide", defaultAccelerator: "Super+Alt+P" },
        { id: "global.newTextNote", defaultAccelerator: "Super+Alt+N" },
        { id: "global.newMindmap", defaultAccelerator: "Super+Alt+M" },
        { id: "global.newTask", defaultAccelerator: "Super+Alt+I" },
        { id: "global.takeScreenshot", defaultAccelerator: "Super+Alt+S" },
        { id: "global.recentFiles", defaultAccelerator: "Super+Alt+L" },
        { id: "closeCurrentWindow", defaultAccelerator: "" },
    ];
    
    protected app: CommonApplication;
    protected shortcuts: Shortcut[];
    
    constructor(app: CommonApplication) {
        this.app = app;
        this.shortcuts = KeyboardShortcuts.defaultShortcuts.slice();
    }
    
    on(id: string, action: () => void): void {
        let shortcut = this.find(id);
        if (shortcut) {
            shortcut.action = action;
        }
    }
    
    getShortcut(id: string): string {
        let shortcut = this.find(id);
        return this.getAccelerator(shortcut);
    }
    
    setShortcut(id: string, accelerator: string, triggerUpdates: boolean = true): boolean {
        let shortcut = this.find(id);
        if (!shortcut) {
            return false;
        }
        if (shortcut.accelerator !== accelerator) {
            if (accelerator === undefined) {
                delete shortcut.accelerator;
                if (this.isGlobalShortcut(shortcut)) {
                    this.unbindGlobalShortcut(shortcut);
                }
            }
            else {
                shortcut.accelerator = accelerator;
                if (this.isGlobalShortcut(shortcut)) {
                    this.bindGlobalShortcut(shortcut);
                }
            }
            return true;
        }
        return false;
    }
    
    getShortcuts(prefix?: string): Shortcut[] {
        if (!prefix) {
            prefix = "";
        }
        return this.shortcuts.filter(x => (<any>x.id).startsWith(prefix));
    }
    
    setShortcuts(shortcuts: { [id: string]: string}, triggerUpdates: boolean = true): boolean {
        let changed: boolean = false;
        for (let id in shortcuts) {
            if (this.setShortcut(id, shortcuts[id], false)) {
                changed = true;
            }
        }
        return changed;
    }
    
    getAccelerators(prefix?: string): { [key: string]: string }{
        let res: { [key: string]: string } = {};
        this.getShortcuts(prefix).forEach(x => res[x.id] = this.getAccelerator(x));
        return res;
    }
    
    getAcceleratorHints(prefix?: string): { [key: string]: string }{
        let res: { [key: string]: string } = {};
        this.getShortcuts(prefix).forEach(x => res[x.id] = this.getUserFriendlyAccelerator(x));
        return res;
    }
    
    find(id: string): Shortcut {
        return this.shortcuts.filter(x => x.id == id)[0];
    }
    
    handler(id: string): void {
        let shortcut = this.find(id);
        if (shortcut && shortcut.action) {
            shortcut.action();
        }
    }
    
    useNativeAcceleratorOption(): boolean {
        return true;
    }
    
    
    
    
    
    /**********************************
    ************ Resolvers ************
    **********************************/
    getAccelerator(shortcut: Shortcut): string {
        if (!shortcut) {
            return null;
        }
        return "accelerator" in shortcut ? shortcut.accelerator : shortcut.defaultAccelerator;
    }
    
    getLabelExtra(shortcut: Shortcut): string {
        return null;
    }
    
    getUserFriendlyAccelerator(shortcut: Shortcut): string {
        let accelerator = this.getAccelerator(shortcut);
        if (!accelerator) {
            return "";
        }
        return accelerator
            .split("+")
            .map(x => x.trim())
            .map(x => this.getUserFriendlyKey(x))
            .join("+");
    }
    
    getUserFriendlyKey(key: string): string {
        return key;
    }
    
    
    
    
    
    /**********************************
    ********* Global shortcuts ********
    **********************************/
    isGlobalShortcut(shortcut: Shortcut): boolean {
        return (<any>shortcut.id).startsWith("global.");
    }
    
    abstract bindGlobalShortcut(shortcut: Shortcut): void;
    abstract unbindGlobalShortcut(shortcut: Shortcut): void;
    abstract bindGlobalShortcuts(): void;
    abstract unbindGlobalShortcuts(): void;
    
    
    
    
    
    /**********************************
    ************* Storage *************
    **********************************/
    abstract readStoredShortcuts(): void;
    abstract saveShortcuts(): void;
    
}
