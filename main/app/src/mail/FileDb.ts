import * as privfs from "privfs-client";
import * as Q from "q";

export abstract class FileDb<T = any> {
    
    constructor(
        public fileSystem: privfs.fs.file.FileSystem,
        public filePath: string
    ) {
    }
    
    abstract getDefaultData(): T;
    
    abstract onDataLoad(data: T): Q.IWhenable<void>;
    
    abstract getDataToSave(): Q.IWhenable<T>;
    
    load(): Q.Promise<void> {
        return Q().then(() => {
            return this.fileSystem.optRead(this.filePath)
        })
        .then(data => {
            return this.onDataLoad(data ? data.getJson() : this.getDefaultData());
        });
    }
    
    save(): Q.Promise<void> {
        return Q().then(() => {
            return this.getDataToSave();
        })
        .then(data => {
            return this.fileSystem.save(this.filePath, privfs.lazyBuffer.Content.createFromJson(data));
        })
        .then(() => {
        });
    }
}