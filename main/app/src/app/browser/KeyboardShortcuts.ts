import { KeyboardShortcuts as BaseKeyboardShortcuts, Shortcut } from "../common/KeyboardShortcuts";
import { WebApplication } from "../../build/core";

export class KeyboardShortcuts extends BaseKeyboardShortcuts {
    
    protected app: WebApplication;
    
    constructor(app: WebApplication) {
        super(app);
    }
    
    
    
    
    
    /**********************************
    ********* Global shortcuts ********
    **********************************/
    bindGlobalShortcut(shortcut: Shortcut): void {
    }
    
    unbindGlobalShortcut(shortcut: Shortcut): void {
    }
    
    bindGlobalShortcuts(): void {
    }
    
    unbindGlobalShortcuts(): void {
    }
    
    
    
    
    
    /**********************************
    ************* Storage *************
    **********************************/
    readStoredShortcuts(): void {
    }
    
    saveShortcuts(): void {
    }
    
}
