import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.FileDb2");

export interface FileQueueDataProvider {
    synchronize(data: privfs.lazyBuffer.Content): void;
    dumpData(): privfs.lazyBuffer.Content;
}

export class FileQueue {
    
    static RETRY_TIMEOUT = 3000;
    
    dumpedVersion: number;
    currentVersion: number;
    timeoutId: NodeJS.Timer;
    saving: boolean;
    handle: privfs.fs.descriptor.Handle;
    
    constructor(
        public fileSystem: privfs.fs.file.FileSystem,
        public filePath: string,
        public dataProvider: FileQueueDataProvider
    ) {
        this.dumpedVersion = 0;
        this.currentVersion = 0;
    }
    
    static init(fileSystem: privfs.fs.file.FileSystem, filePath: string, defaultData: privfs.lazyBuffer.IContent, dataProvider: FileQueueDataProvider) {
        let fileQueue = new FileQueue(fileSystem, filePath, dataProvider);
        return fileQueue.load(defaultData).thenResolve(fileQueue);
    }
    
    public load(defaultData: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q().then(() => {
            return this.fileSystem.openOrCreate(this.filePath, defaultData, {versioning: false, checkVersioning: true});
        })
        .then(version => {
            this.handle = version.handle;
        })
        .then(() => {
            return this.handle.read(false);
        })
        .then(data => {
            this.dataProvider.synchronize(data.getContent());
        });
    }
    
    save(): void {
        this.currentVersion++;
        this.kickQueue();
    }
    
    kickQueue(): void {
        Logger.debug("on save(): versions: ", this.currentVersion, this.dumpedVersion, this.saving, this.timeoutId);
        if (this.currentVersion == this.dumpedVersion || this.saving || this.timeoutId) {
            Logger.debug("on save(): return due to same version or timeout or busy saving");
            
            if (this.currentVersion != this.dumpedVersion && !this.timeoutId) {
                this.timeoutId = setTimeout(() => {
                    this.timeoutId = null;
                    this.kickQueue();
                }, FileQueue.RETRY_TIMEOUT);
            }
            return;
        }
        this.saving = true;
        let currDumpedVersion: number = null;
        
        Q().then(() => {
            Logger.debug("on save(): create lock..")
            return this.handle.lock();
        })
        .then(() => {
            Logger.debug("on save(): refreshAndUpdateToLastVersion..")
            return this.handle.refreshAndUpdateToLastVersion();
        })
        .then(updated => {
            Logger.debug("on save(): afterRefreshAndUpdate...")
            if (updated) {
                Logger.debug("on save(): was updated.")
                return this.handle.read(false)
            }
        })
        .then(data => {
            Logger.debug("on save(): getContent and synchronize");
            if (data) {
                this.dataProvider.synchronize(data.getContent());
            }
            currDumpedVersion = this.currentVersion;
            let dataToSave = this.dataProvider.dumpData();
            return this.handle.write(dataToSave, {releaseLock: true, updateCurrentVersion: true});
        })
        .then(() => {
            this.dumpedVersion = currDumpedVersion;
        })
        .fail(e => {
            Logger.debug("on save(): postpone operation...");
            if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
                Logger.debug("file locked...");
                this.timeoutId = setTimeout(() => {
                    this.timeoutId = null;
                    this.kickQueue();
                }, FileQueue.RETRY_TIMEOUT);
            }
            else {
                Logger.error("Error during saving", e);
            }
        })
        .fin(() => {
            this.saving = false;
            this.kickQueue();
        });
    }
    
    destroy() {
        clearTimeout(this.timeoutId);
    }
}

