import { KeyboardShortcuts as BaseKeyboardShortcuts, StoredShortcut, StoredShortcuts, Shortcut } from "../../common/KeyboardShortcuts";
import { Starter } from "../starter/Starter";
import { ElectronApplication } from "../ElectronApplication";
import * as fs from "fs";
import * as path from "path";
import { globalShortcut } from "electron";

export abstract class KeyboardShortcuts extends BaseKeyboardShortcuts {
    
    protected app: ElectronApplication;
    
    constructor(app: ElectronApplication) {
        super(app);
    }
    
    setShortcut(id: string, accelerator: string, triggerUpdates: boolean = true): boolean {
        let changed = super.setShortcut(id, accelerator, triggerUpdates);
        if (changed && triggerUpdates) {
            this.app.refreshTrayMenu();
        }
        return changed;
    }
    
    setShortcuts(shortcuts: { [id: string]: string}, triggerUpdates: boolean = true): boolean {
        let changed: boolean = super.setShortcuts(shortcuts);
        if (changed && triggerUpdates) {
            this.app.refreshTrayMenu();
        }
        return changed;
    }
    
    
    
    
    
    /**********************************
    ********* Global shortcuts ********
    **********************************/
    bindGlobalShortcut(shortcut: Shortcut): void {
        this.unbindGlobalShortcut(shortcut);
        let accelerator = this.getAccelerator(shortcut);
        if (accelerator) {
            if (<any>globalShortcut.register(accelerator, () => this.handler(shortcut.id))) {
                shortcut.registeredAccelerator = accelerator;
            }
        }
    }
    
    unbindGlobalShortcut(shortcut: Shortcut): void {
        if (shortcut.registeredAccelerator) {
            globalShortcut.unregister(shortcut.registeredAccelerator);
            delete shortcut.registeredAccelerator;
        }
    }
    
    bindGlobalShortcuts(): void {
        this.shortcuts.forEach(x => {
            if (this.isGlobalShortcut(x)) {
                this.bindGlobalShortcut(x);
            }
        });
    }
    
    unbindGlobalShortcuts(): void {
        this.shortcuts.forEach(x => {
            if (this.isGlobalShortcut(x)) {
                this.unbindGlobalShortcut(x);
            }
        });
    }
    
    
    
    
    
    /**********************************
    ************* Storage *************
    **********************************/
    readStoredShortcuts(): void {
        let shortcutsFile = path.resolve(this.app.profile.absolutePath, Starter.BASE_SHORTCUTS_FILE);
        if (fs.existsSync(shortcutsFile)) {
            let _shortcuts = JSON.parse(fs.readFileSync(shortcutsFile, "utf8"));
            let shortcuts: StoredShortcuts;
            if (Array.isArray(_shortcuts)) {
                // Back-compat
                shortcuts = {
                    version: KeyboardShortcuts.VERSION,
                    shortcuts: _shortcuts.map(x => ({ id: `global.${x.actionName}`, accelerator: x.accelerator })),
                };
            }
            else {
                shortcuts = _shortcuts;
            }
            
            if (shortcuts) {
                for (let storedShortcut of shortcuts.shortcuts) {
                    let shortcut = this.find(storedShortcut.id);
                    if (shortcut) {
                        shortcut.accelerator = storedShortcut.accelerator;
                    }
                }
            }
        }
    }
    
    saveShortcuts(): void {
        let shortcuts: StoredShortcuts = {
            version: KeyboardShortcuts.VERSION,
            shortcuts: this.shortcuts.map(x => ({ id: x.id, accelerator: x.accelerator })),
        };
        let shortcutsFile = path.resolve(this.app.profile.absolutePath, Starter.BASE_SHORTCUTS_FILE);
        fs.writeFileSync(shortcutsFile, JSON.stringify(shortcuts));
    }
    
}
