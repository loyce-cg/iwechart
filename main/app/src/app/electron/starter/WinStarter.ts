import {SquirrelStarter} from "./SquirrelStarter";
import path = require("path");
import childProcess = require("child_process");
import spawn = childProcess.spawn;

export class WinStarter extends SquirrelStarter {
    
    getAutoUpdaterFeedURL(): string {
        var arch = process.arch === 'x64' ? '64bit' : '32bit';
        return "https://privmx.com/desktop/windows/updates/" + arch;
    }
    
    onSquirrelInstall(): void {
        this.installShortcutsAndQuit();
    }
    
    onSquirrelUpdated(): void {
        this.installShortcutsAndQuit();
    }
    
    onSquirrelUninstall(): void {
        this.uninstallShortcutsAndQuit();
    }
    
    installShortcutsAndQuit(): void {
        this.installShortcuts(() => {
            this.app.quit();
        });
    }
    
    uninstallShortcutsAndQuit(): void {
        this.uninstallShortcuts(() => {
            this.app.quit();
        });
    }
    
    installShortcuts(cb: () => void): void {
        let target = this.getShortcutsTarget();
        let updateExe = this.getUpdateExePath();
        spawn(updateExe, ["--createShortcut", target]).on("exit", cb);
    }
    
    uninstallShortcuts(cb: () => void): void {
        let target = this.getShortcutsTarget();
        let updateExe = this.getUpdateExePath();
        spawn(updateExe, ["--removeShortcut", target]).on("exit", cb);
    }
    
    getShortcutsTarget(): string {
        return path.basename(process.execPath);
    }
    
    getUpdateExePath(): string {
        return path.resolve(path.dirname(process.execPath), "..", "update.exe");
    }
}
