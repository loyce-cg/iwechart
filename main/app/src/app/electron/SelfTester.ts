import * as RootLogger from "simplito-logger";
const Logger = RootLogger.get("privfs-mail-client.app.electron.ElectronApplication.selfTester");

export class SelfTester {
    
    private static readonly libsNames: string[] = [
        "clipboard-files",
        "sqlite3",
        "screenshot-desktop",
        "he"
    ]
    
    private static readonly libs: {[name: string]: any} = {};
    
    public static run(): void {
        for (let lib of SelfTester.libsNames) {
            try {
                SelfTester.libs[lib] = require(lib);
            }
            catch (e) {
                Logger.error("Fatal error: Missing "+ lib +" lib", e);
                process.exit(1)
            }
        }
    }
}