import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { Shortcut } from "../../common/KeyboardShortcuts";

export class WindowsKeyboardShortcuts extends KeyboardShortcuts {
    
    /**********************************
    ************ Resolvers ************
    **********************************/
    getUserFriendlyKey(key: string): string {
        if (key == "Super") {
            return "Win";
        }
        if (key == "CmdOrCtrl" || key == "CommandOrControl") {
            return "Ctrl";
        }
        return key;
    }
    
}
