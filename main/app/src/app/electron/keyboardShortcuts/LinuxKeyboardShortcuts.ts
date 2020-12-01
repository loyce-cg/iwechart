import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { Shortcut } from "../../common/KeyboardShortcuts";

export class LinuxKeyboardShortcuts extends KeyboardShortcuts {
    
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
        if (key == "CmdOrCtrl" || key == "CommandOrControl") {
            return "Ctrl";
        }
        return key;
    }
    
}
