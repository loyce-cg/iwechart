import {Starter} from "./Starter";

export class LinuxStarter extends Starter {
    
    run() {
        super.run();
        this.startApp();
    }
}
