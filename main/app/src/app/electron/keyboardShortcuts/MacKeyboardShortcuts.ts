import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { Shortcut } from "../../common/KeyboardShortcuts";

export class MacKeyboardShortcuts extends KeyboardShortcuts {
    
    /**********************************
    ************ Resolvers ************
    **********************************/
    useNativeAcceleratorOption(): boolean {
        return false;
    }
    
    getLabelExtra(shortcut: Shortcut): string {
        return `    (${super.getUserFriendlyAccelerator(shortcut)})`;
    }
    
    getUserFriendlyKey(key: string): string {
        if (key == "Super") {
            return "⌘";
        }
        if (key == "CmdOrCtrl" || key == "CommandOrControl") {
            return "⌘";
        }
        return key;
    }
    
}
