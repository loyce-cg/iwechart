import * as fs from "fs";
import * as origFs from "original-fs";
import * as trash from "trash";
import * as drivelist from "drivelist";
import * as ncp from "ncp";
import * as pathUtils from "path";
import * as os from "os";
import { app, utils, Q, mail, privfs } from "pmc-mail";
import { FileEntryBase } from "./Notes2Utils";
import DirStats = mail.filetree.nt.DirStats;
const hidefile = require("hidefile");

export type LocalEntryType = "file"|"directory";

export class LocalEntry {
    id: string;
    path: string;
    name: string;
    parent: LocalEntry;
    type: LocalEntryType;
    size: number;
    ctime: Date;
    mtime: Date;
    mime?: string;
    dirStats?: DirStats;
    hidden?: boolean;
    
    constructor(obj: { [key: string]: any }) {
        for (let key in obj) {
            (<any>this)[key] = obj[key];
        }
    }
    
    isDirectory(): boolean {
        return this.type == "directory";
    }
    
    isFile(): boolean {
        return this.type == "file";
    }
}

export class LocalOpenableElement extends app.common.shelltypes.OpenableElement  {
    
    openableElementType: string = "LocalOpenableElement";
    entry: LocalEntry;
    
    static createSync(data: LocalEntry|string): LocalOpenableElement {
        let entry: LocalEntry = data instanceof LocalEntry ? data : LocalFS.getEntry(data);
        if (!entry.isFile()) {
            throw new Error("Entry is not a file");
        }
        return new LocalOpenableElement(entry, new privfs.lazyBuffer.NodeFileLazyContent(entry.path, entry.mime));
    }
    
    static create(data: LocalEntry|string): Q.Promise<LocalOpenableElement> {
        return Q().then(() => LocalOpenableElement.createSync(data));
    }
    
    constructor(entry: LocalEntry, content: privfs.lazyBuffer.IContent) {
        super(content);
        this.entry = entry;
    }
    
    isEditable(): boolean {
        return LocalFS.isWritable(this.entry.path, false);
    }
    
    isLocalFile(): boolean {
        return true;
    }
    
    save(data: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q(data.getBuffer()).then(buff => {
            return LocalFS.writeFile(this.entry.path, buff);
        });
    }
    
    equals(ele: app.common.shelltypes.OpenableElement): boolean {
        if (!(ele instanceof LocalOpenableElement)) {
            return false;
        }
        return ele.entry.id == this.entry.id;
    }
    
    getCreateDate(): Date {
        return this.entry.ctime;
    }
    
    getModifiedDate(): Date {
        return this.entry.mtime;
    }
    
    hasElementId(): boolean {
        return true;
    }
    
    getElementId(): string {
        return this.entry.id;
    }
    
    reopenRenamed(newName: string): void {
        let newPath = this.entry.path.substr(0, this.entry.path.lastIndexOf("/") + 1) + newName;
        let el = LocalOpenableElement.createSync(newPath);
        this.entry = el.entry;
        this.name = newName;
    }
    
    rename(newName: string): Q.Promise<void> {
        return LocalFS.rename(this.entry.path, newName);
    }
}

export class LocalFS {
    
    static REJECT_DIR_NOT_EMPTY = "dir-not-empty";
    
    static isWindows: boolean = false;
    static trash: typeof trash = null;
    static staticConstructor(app: app.common.CommonApplication) {
        if (app.isElectronApp() && LocalFS.trash == null) {
            LocalFS.trash = require("trash");
        }
        this.isWindows = process.platform == "win32";
    }
    
    currentPath: string = null;
    currentFileNamesCollection: utils.collection.MutableCollection<FileEntryBase>;
    
    constructor(collection: utils.collection.MutableCollection<FileEntryBase>, path: string, public onPathChange: (newPath: string) => void) {
        this.currentFileNamesCollection = collection;
        this.browse(path);
    }
    
    
    
    
    
    /****************************************
    ***************** Tree ******************
    ****************************************/
    browse(path: string): Q.Promise<void> {
        if (path == "" || !LocalFS.exists(path) || !LocalFS.isDir(path) || !LocalFS.isReadable(path, true)) {
            path = LocalFS.getHomeDir();
        }
        this.currentPath = path;
        return LocalFS.listEntries(path).then(fileNames => {
            this.watch(path);
            let arr: LocalEntry[] = [];
            let parentEntry = LocalFS.getEntry(path);
            fileNames.forEach(fn => {
                let entry = LocalFS.getEntry(fn, parentEntry);
                if (!entry) {
                    return;
                }
                if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                    arr.push(entry);
                }
            });
            this.currentFileNamesCollection.clear();
            this.currentFileNamesCollection.addAll(arr);
            this.onPathChange(this.currentPath);
        });
    }

    browseWithParent(path: string): Q.Promise<void> {
        if (path == "" || !LocalFS.exists(path) || !LocalFS.isDir(path) || !LocalFS.isReadable(path, true)) {
            path = LocalFS.getHomeDir();
        }
        this.currentPath = path;
        return LocalFS.listEntries(path).then(fileNames => {
            let arr: LocalEntry[] = [];
            let parentEntry = LocalFS.getEntry(path);
            fileNames.forEach(fn => {
                let entry = LocalFS.getEntry(fn, parentEntry);
                if (!entry) {
                    return;
                }
                if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                    arr.push(entry);
                }
            });
            if (parentEntry && this.currentPath != "/") {
                let entry = Object.assign({}, parentEntry);
                let parentDir = entry.path.split("/").slice(0, -1).join("/");
                if (parentDir == "") {
                    parentDir = "/";
                }
                entry.path = parentDir;
                entry.id = "parent";
                entry.name = "..";
                arr = [entry, ...arr];
            }
            this.currentFileNamesCollection.clear();
            this.currentFileNamesCollection.addAll(arr);
            this.onPathChange(this.currentPath);
        });
    }


    browseEx(path: string): Q.Promise<LocalEntry[]> {
        if (path == "" || !LocalFS.exists(path) || !LocalFS.isDir(path) || !LocalFS.isReadable(path, true)) {
            path = LocalFS.getHomeDir();
        }
        this.currentPath = path;
        return LocalFS.listEntries(path).then(fileNames => {
            let arr: LocalEntry[] = [];
            let parentEntry = LocalFS.getEntry(path);
            fileNames.forEach(fn => {
                let entry = LocalFS.getEntry(fn, parentEntry);
                if (!entry) {
                    return;
                }
                if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                    arr.push(entry);
                }
            });
            return arr;
        });
    }
    


    static listEntries(path: string): Q.Promise<string[]> {
        if (path != "/") {
            if (!LocalFS.isReadable(path, true)) {
                return Q([]);
            }
        }
        let deferred = Q.defer<string[]>();
        if (path == "/" && LocalFS.isWindows) {
            drivelist.list().then(driveList => {
                let driveNamesList: string[] = [];
                driveList.forEach(drive => {
                    drive.mountpoints.forEach(mpt => {
                        driveNamesList.push(mpt.path);
                    });
                });
                deferred.resolve(driveNamesList);
            }).catch(err => {
                deferred.reject(err);
            });
        }
        else {
            fs.readdir(path, (err, fileNames) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(fileNames.map(fn => pathUtils.join(path, fn)));
                }
            });
        }
        return deferred.promise;
    }
    
    static moveToTrash(path: string): Q.Promise<void> {
        return Q(LocalFS.trash(path, { glob:false }));
    }
    
    static getEntry(path: string, parentEntry: LocalEntry = null): LocalEntry {
        let stat: fs.Stats;
        let isHidden: boolean;
        try {
            stat = origFs.lstatSync(path);

            try {
                isHidden = hidefile.isHiddenSync(path);
            }
            catch (e) {
                isHidden = true;
            }
        }
        catch (e) {
            return null;
        }
        let type: LocalEntryType = null;
        let dirStats: DirStats = null;
        let mime: string = "";
        if (stat.isDirectory()) {
            type = "directory";
            let counts = LocalFS.countChildren(path);
            dirStats = {
                directoriesCount: counts.directories,
                filesCount: counts.files,
                filesSize: stat.size,
                modifiedDate: stat.mtime.getTime(),
            };
        }
        else if (stat.isFile()) {
            type = "file";
            mime = mail.filetree.MimeType.resolve(pathUtils.basename(path));
        }
        else {
            return null;
        }
        return new LocalEntry({
            id: path,
            path: path,
            name: pathUtils.basename(path),
            parent: parentEntry,
            type: type,
            size: stat.size,
            mtime: stat.mtime,
            ctime: stat.ctime,
            mime: mime,
            dirStats: dirStats,
            hidden: isHidden
        });
    }

    static getParentEntry(entry: LocalEntry): LocalEntry {
        let path = pathUtils.dirname(entry.path);
        return LocalFS.getEntry(path);
    }

    static getDirName(path: string): string {
        return pathUtils.dirname(path);
    }
    
    static countChildren(path: string): { directories:number, files:number } {
        let nFiles = 0;
        let nDirectories = 0;
        try {
            fs.readdirSync(path).forEach(fn => {
                let fullPath = pathUtils.join(path, fn);
                let stat = fs.lstatSync(fullPath);
                if (stat.isFile()) {
                    nFiles++;
                }
                else if (stat.isDirectory()) {
                    nDirectories++;
                }
            });
        }
        catch (e) {}
        return { directories:nDirectories, files:nFiles };
    }
    
    
    
    
    
    /****************************************
    ************** Directories **************
    ****************************************/
    static isDir(path: string): boolean {
        return fs.lstatSync(path).isDirectory();
    }
    static createDir(path: string): Q.Promise<boolean> {
        let deferred = Q.defer<boolean>();
        if (LocalFS.exists(path)) {
            deferred.resolve(false);
        }
        else {
            fs.mkdir(path, err => {
               if (err) {
                   deferred.reject(err);
               }
               else {
                   deferred.resolve(true);
               }
           });
       }
       return deferred.promise;
    }
    
    static deleteDir(path: string, moveToTrash: boolean = true): Q.Promise<void> {
        let deferred = Q.defer<void>();
        
        // Only empty directories can be deleted permanently; non-empty can only be moved to trash
        LocalFS.listEntries(path).then(entries => {
            if (!moveToTrash && entries.length > 0) {
                deferred.reject(LocalFS.REJECT_DIR_NOT_EMPTY);
            }
            else {
                if (moveToTrash) {
                    LocalFS.moveToTrash(path).then(() => {
                        deferred.resolve();
                    }).catch(err => {
                        deferred.reject(err);
                    });
                }
                else {
                    fs.rmdir(path, err => {
                        if (err) {
                            deferred.reject(err);
                        }
                        else {
                            deferred.resolve();
                        }
                    });
                }
            }
        });
        return deferred.promise;
    }
    
    static copyDir(srcFilePath: string, dstFilePath: string, overwriteExisting: boolean): Q.Promise<void> {
        let deferred = Q.defer<void>();
        ncp.ncp(srcFilePath, dstFilePath, { clobber: overwriteExisting }, err => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve();
            }
        })
        return deferred.promise;
    }
    
    
    
    
    
    /****************************************
    ***************** Files *****************
    ****************************************/
    static readFile(path: string, buff: boolean = false): Q.Promise<string|Buffer> {
        let deferred = Q.defer<string>();
        let encoding = buff ? null : "utf8";
        fs.readFile(path, encoding, (err, data) => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(buff ? data : data.toString());
            }
        });
        return deferred.promise;
    }
    
    static writeFile(path: string, content: string|Buffer): Q.Promise<void> {
        let deferred = Q.defer<void>();
        fs.writeFile(path, content, err => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    
    static writeFileEx(path: string, content: string|Buffer): Q.Promise<void> {
        if (this.exists(path)) {
            // File already exists
            return this.readFile(path).then(data => {
                let currStr = <string>data;
                let newStr = content instanceof Buffer ? content.toString(): content;
                if (newStr == currStr) {
                    return; // Same file content => ignore
                }
                else {
                    // Different file content => use different name
                    path = this.getAltPath2(path);
                    return this.writeFile(path, content);
                }
            });
        }
        else {
            // File doesn't exist => normal write
            return this.writeFile(path, content);
        }
    }
    
    static createFile(path: string): Q.Promise<void> {
        if (LocalFS.exists(path)) {
            return Q.reject("File already exists");
        }
        return LocalFS.writeFile(path, "");
    }
    
    static deleteFile(path: string, moveToTrash: boolean = true): Q.Promise<void> {
        if (moveToTrash) {
            return LocalFS.moveToTrash(path);
        }
        else {
            let deferred = Q.defer<void>();
            fs.unlink(path, err => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve();
                }
            });
            return deferred.promise;
        }
    }
    
    static copyFile(srcFilePath: string, dstFilePath: string, allowOverwrite: boolean): Q.Promise<boolean> {
        let deferred = Q.defer<boolean>();
        if (!allowOverwrite && LocalFS.exists(dstFilePath)) {
            deferred.resolve(false);
        }
        else {
            let rs = fs.createReadStream(srcFilePath);
            let ws = fs.createWriteStream(dstFilePath);
            rs.on("error", (err: any) => { deferred.reject(err); });
            ws.on("error", (err: any) => { deferred.reject(err); });
            ws.on("close", () => { deferred.resolve(true); })
            rs.pipe(ws);
        }
        return deferred.promise;
    }
    
    
    
    
    
    /****************************************
    **************** Watcher ****************
    ****************************************/
    watched: fs.FSWatcher;
    watch(path: string): fs.FSWatcher {
        this.unwatch();
        let parentEntry = LocalFS.getEntry(path);
        return this.watched = fs.watch(path, (evt, fn) => {
            let fnPath = pathUtils.join(path, fn);
            let entry = LocalFS.getEntry(fnPath, parentEntry);
            if (!entry) {
                this.currentFileNamesCollection.removeBy("name", fn);
                return;
            }
            if (LocalFS.isReadable(entry.path, entry.isDirectory())) {
                let idx = this.currentFileNamesCollection.indexOfBy(it => it.id == entry.id);
                if (idx >= 0) {
                    this.currentFileNamesCollection.triggerUpdateAt(idx);
                }
                else {
                    this.currentFileNamesCollection.add(entry);
                }
            }
        });
    }
    
    unwatch() {
        if (this.watched) {
            this.watched.close();
        }
    }
    
    
    
    
    
    /****************************************
    ***************** Perms *****************
    ****************************************/
    static isReadable(path: string, isDir: boolean = false): boolean {
        try { fs.accessSync(path, isDir ? (fs.constants.R_OK | fs.constants.X_OK) : fs.constants.W_OK); }
        catch (e) { return false; }
        return true;
    }
    
    static isWritable(path: string, isDir: boolean = false): boolean {
        try { fs.accessSync(path, isDir ? (fs.constants.W_OK | fs.constants.X_OK) : fs.constants.W_OK); }
        catch (e) { return false; }
        return true;
    }
    
    static exists(path: string): boolean {
        try { fs.accessSync(path, fs.constants.F_OK); }
        catch (e) { return false; }
        return true;
    }
    
    static isDeletable(path: string): boolean {
        return LocalFS.isWritable(pathUtils.dirname(path), true);
    }
    
    static isRenamable(path: string): boolean {
        return LocalFS.isWritable(pathUtils.dirname(path), true);
    }
    
    
    
    
    
    /****************************************
    ***************** Other *****************
    ****************************************/
    static rename(oldPath: string, newName: string): Q.Promise<void> {
        let deferred = Q.defer<void>();
        let newPath = pathUtils.join(pathUtils.dirname(oldPath), newName);
        fs.rename(oldPath, newPath, err => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve();
            }
        });
        return deferred.promise;
    }
    
    static move(oldPath: string, newPath: string, allowOverwrite: boolean): Q.Promise<boolean> {
        let deferred = Q.defer<boolean>();
        if (!allowOverwrite && LocalFS.exists(newPath)) {
            deferred.resolve(false);
        }
        else {
            fs.rename(oldPath, newPath, err => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(true);
                }
            });
        }
        return deferred.promise;
    }
    
    static isNameValid(name: string): boolean {
        let valid = true;
        let forbiddenCharacters = (LocalFS.isWindows ? "<>:\"/\\|?*" : "/").split("");
        forbiddenCharacters.forEach(c => {
            if (name.indexOf(c) >= 0) {
                valid = false;
            }
        });
        return valid;
    }
    
    static joinPath(path: string, name: string): string {
        return pathUtils.join(path, name);
    }
    
    static getFileName(path: string, ext: string = null): string {
        return pathUtils.basename(path, ext ? ext : "");
    }
    
    static getExt(path: string): string {
        return pathUtils.extname(path);
    }
    
    static getAltPath(dstDir: string, fileName: string): string {
        let dstPath = LocalFS.joinPath(dstDir, fileName);
        let id = 1;
        let ext = LocalFS.getExt(fileName);
        let bn = LocalFS.getFileName(fileName, ext);
        while (id < 1000 && LocalFS.exists(dstPath)) {
            dstPath = LocalFS.joinPath(dstDir, bn + "(" + (id++) + ")" + ext);
        }
        return dstPath;
    }
    
    static getAltPath2(dstPath: string): string {
        return this.getAltPath(pathUtils.dirname(dstPath), pathUtils.basename(dstPath));
    }
    
    static getHomeDir(): string {
        return os.homedir();
    }
    
}
