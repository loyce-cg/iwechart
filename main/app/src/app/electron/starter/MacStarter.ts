import {SquirrelStarter} from "./SquirrelStarter";

export class MacStarter extends SquirrelStarter {
    
    getAutoUpdaterFeedURL(): string {
        return "https://privmx.com/desktop/osx/updates";
    }
}
