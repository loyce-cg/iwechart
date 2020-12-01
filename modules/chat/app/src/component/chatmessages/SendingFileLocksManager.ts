import { privfs } from "pmc-mail";

interface SendingFileLock {
    file: File;
}

type File = privfs.lazyBuffer.IContent;

export class SendingFileLocksManager {
    
    locks: SendingFileLock[] = [];
    
    constructor() {
    }
    
    lock(file: File): boolean {
        if (this.isLocked(file)) {
            return false;
        }
        let lock = this.getSendingFileLockFromFile(file);
        this.locks.push(lock);
    }
    
    lockMany(files: File[]): boolean {
        if (this.isAnyLocked(files)) {
            return false;
        }
        for (let file of files) {
            this.lock(file);
        }
        return true;
    }
    
    unlock(file: File): void {
        if (!this.isLocked(file)) {
            return;
        }
        let idx = this.indexOfLock(file);
        this.locks.splice(idx, 1);
    }
    
    unlockMany(files: File[]): void {
        for (let file of files) {
            this.unlock(file);
        }
    }
    
    indexOfLock(file: File): number {
        for (let i = 0; i < this.locks.length; ++i) {
            if (this.locks[i].file == file) {
                return i;
            }
        }
        return -1;
    }
    
    isLocked(file: File): boolean {
        return this.indexOfLock(file) >= 0;
    }
    
    isAnyLocked(files: File[]): boolean {
        for (let file of files) {
            if (this.isLocked(file)) {
                return true;
            }
        }
        return false;
    }
    
    filterOutLocked(files: File[]): File[] {
        let newFiles: File[] = [];
        for (let file of files) {
            if (!this.isLocked(file)) {
                newFiles.push(file);
            }
        }
        return newFiles;
    }
    
    getSendingFileLockFromFile(file: File): SendingFileLock {
        return {
            file: file,
        };
    }
    
}
