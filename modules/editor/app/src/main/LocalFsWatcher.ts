import * as fs from "fs";

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
