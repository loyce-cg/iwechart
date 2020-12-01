import * as fs from "fs";
import * as pathUtils from "path";
import { app, utils, Q, mail, privfs } from "pmc-mail";
import { DirStats } from "pmc-mail/out/mail/filetree/NewTree";


export class LocalFfWatcher {
    
    watched: fs.FSWatcher;
    
    watch(fileName: string, callback: () => void): fs.FSWatcher {
        this.unwatch();
        return this.watched = fs.watch(fileName, () => {
            callback();
        });
    }
    
    unwatch() {
        if (this.watched) {
            this.watched.close();
        }
    }
    
}
