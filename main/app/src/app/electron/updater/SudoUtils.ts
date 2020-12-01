import * as fs from 'fs';
import * as os from "os";
import * as path from 'path';
import * as child from "child_process";
// import { SudoMac } from './SudoMac';
import * as sudoPrompt from "sudo-prompt";
import * as Q from "q";
import { resolve } from 'url';

export class SudoUtils {
    static appName: string = "PrivMX";
    deferredProcess: Q.Deferred<void>;

    runAsSudo(cmd: string, args: string[], logPath?: string): Q.Promise<void> {
        return this.execPromise([cmd, ...args].join(" "), {name: "PrivMX"})
        .then(result => {
            return;
            // process.exit();
        })
        .fail(e => {
            this.onErrorLog(e);
        })
        

    }


    // runAsSudo(cmd: string, args: string[], logPath?: string): Q.Promise<void> {
    //     try {
    //         if (process.platform == "darwin") {
    //             // let sudoObj = new SudoMac();
    //             return this.execPromise([cmd, ...args].join(" "), {name: "PrivMX"})
    //             .then(result => {
    //                 return;
    //                 // process.exit();
    //             })
    //         }
    //         else if (process.platform == "linux") {
    //             return this.runAsSudoLinux(cmd, args, logPath)
    //             .then(result => {
    //                 return;
    //             })
    //         }
    //     }
    //     catch(e) {
    //         console.log(e);
    //         this.onErrorLog(e);
    //     }
    // }

    execPromise(cmd: string, options={}) {
        return Q.Promise((resolve, reject) => {
            sudoPrompt.exec(cmd, options, (err, stdout, stderr) => {
                if (err) { return reject(err); }
                return resolve({stdout, stderr});
            });
        });
    }

    runAsSudoLinux(cmd: string, args: string[], logPath: string): Q.Promise<void> {
        return Q().then(() => {
            this.onLog("runAsSudoLinux call ... logs path: " + logPath);
            this.deferredProcess = Q.defer<void>();
    
            let sudoFlags: string[] = [
                "--disable-internal-agent", "env", "HOME="+process.env.HOME, "DISPLAY="+process.env.DISPLAY, "XAUTHORITY="+process.env.XAUTHORITY
            ];
            let sudoCmd = "pkexec";
            let params = ["--no-sandbox"].concat(args);
    
            let sudoParams = sudoFlags.concat([cmd], params);
            // console.log("display is: ", process.env.DISPLAY);
            // console.log("XAUTH is: ", process.env.XAUTHORITY);
            // console.log("calling: ", sudoCmd, sudoParams);
    
            this.onLog("process to run: " + [sudoCmd, ...sudoParams].join(" "));
    
            const out = fs.openSync(logPath+".sudo", "a");
            const err = fs.openSync(logPath+".sudo", "a");
            let cp = child.spawn(sudoCmd, sudoParams, {stdio: ["ignore", out, err], detached: true, cwd: path.dirname(cmd), env: {HOME: process.env.HOME, DISPLAY: process.env.DISPLAY, XAUTHORITY: process.env.XAUTHORITY}});
            // cp.unref();
            
            cp.on("error", (err) => {
                this.onErrorLog(err);
                this.deferredProcess.reject(err);
            });
    
            cp.on("close", () => {
                this.onLog("Close close close");
                this.deferredProcess.resolve();
            })
    
            this.onLog("runAsSudoLinux - process started.. ");
    
            return this.deferredProcess.promise;
        })
    }

    isDirectoryWritable(fileDir: string): boolean {
        let tmpFile: string = "tmp" + Math.round(Math.random() * 1000) + " " + new Date().getTime().toString();
        let filePath = path.join(fileDir, tmpFile);
        try {
            fs.writeFileSync(filePath, "x");
            fs.unlinkSync(filePath);
            return true;
        }
        catch(e) {
            return false;
        }
    }

    onLog: (data: any) => void;
    onErrorLog: (data: any) => void;
  
}