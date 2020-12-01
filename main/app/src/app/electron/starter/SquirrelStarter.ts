import {Starter} from "./Starter";

export class SquirrelStarter extends Starter {
    
    getAutoUpdaterFeedURL(): string {
        throw new Error("not implemented");
    }
    
    handleStartupEvent(): boolean {
        this.logger.log("debug", "handleStartupEvent", process.argv);
        let squirrelCommand = process.argv[1];
        switch(squirrelCommand) {
            case '--squirrel-install':
                this.onSquirrelInstall();
                return true;
            case '--squirrel-updated':
                this.onSquirrelUpdated();
                return true;
            case '--squirrel-uninstall':
                this.onSquirrelUninstall();
                return true;
            case '--squirrel-obsolete':
                this.onSquirrelObsolete();
                return true;
            case '--squirrel-firstrun':
                this.onSquirrelFirstRun();
                return false;
        }
        return false;
    }
    
    run(): void {
        super.run();

        if (!this.handleStartupEvent()) {
            this.startApp();
            // this.electron.autoUpdater.setFeedURL({url: this.getAutoUpdaterFeedURL()});
        }
    }
    
    onSquirrelInstall(): void {
        this.app.quit();
    }
    
    onSquirrelUpdated(): void {
        this.app.quit();
    }
    
    onSquirrelUninstall(): void {
        this.app.quit();
    }
    
    onSquirrelObsolete(): void {
        this.app.quit();
    }
    
    onSquirrelFirstRun(): void {
    }
}
