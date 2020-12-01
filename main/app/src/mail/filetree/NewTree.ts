import * as privfs from "privfs-client";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import {SectionService} from "../section/SectionService";
import {Lang} from "../../utils/Lang";
import {MimeType} from "./MimeType";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.filetree.Tree");

export class Tree {
    
    root: Directory;
    collection: MutableCollection<Entry>;
    processLastVersionEvents: boolean;
    autoLoadEntries: boolean;
    
    constructor(
        public fileSystem: privfs.fs.file.FileSystem,
        public section: SectionService
    ) {
        this.processLastVersionEvents = true;
        this.autoLoadEntries = true;
        this.collection = new MutableCollection();
        this.root = new Directory(this, null, this.fileSystem.root.ref, "");
        this.collection.add(this.root);
        this.fileSystem.fsd.manager.storageProviderManager.event.add((event: privfs.types.descriptor.DescriptorNewVersionEvent) => {
            if (this.processLastVersionEvents && event.type == "descriptor-new-version" && event.descriptor && event.descriptor.lastVersion) {
                this.root.onDescriptorNewVersionEvent(event.descriptor);
            }
        });
        this.sync();
    }
    
    sync() {
        this.collection.changeEvent.hold();
        this.root.sync(this.fileSystem.root);
        this.collection.changeEvent.release();
    }
    
    getPathFromDescriptor(did: string, withRefreshDeep: boolean = true): Q.Promise<string> {
        let resolved: boolean = false;
        let entry = Q.defer<string>();
        this.section.getFileTree().then(tree =>{
            tree.collection.list.forEach( x => {
                if (x.ref.did == did) {
                    resolved = true;
                    entry.resolve(x.path);
                    return;
                }
            });
            if ((!resolved) && withRefreshDeep) {
                    this.refreshDeep(false)
                    .then(() => {
                        return this.getPathFromDescriptor(did, false)
                        .then(result => {
                            entry.resolve(result);
                        });
                    })
            }

        })
        return entry.promise;
    }
    
    refreshDeep(withFilesMeta: boolean): Q.Promise<void> {
        return Q().then(() => {
            this.processLastVersionEvents = false;
            return this.fileSystem.root.refreshDeep(withFilesMeta);
        })
        .then(() => {
            this.sync();
        })
        .fin(() => {
            this.processLastVersionEvents = true;
        });
    }
}

export class Helper {
    
    static resolvePath(path: string, name: string): string {
        return Lang.endsWith(path, "/") || Lang.startsWith(name, "/") ? path + name : path + "/" + name;
    }
    
    static resolvePaths(a: string, b: string): string {
        let aEnds = Lang.endsWith(a, "/") ;
        let bStarts = Lang.startsWith(b, "/");
        return aEnds == bStarts ? (aEnds ? a + b.substring(1) : a + "/" + b) : a + b;
    }
    
    static maxWithNulls(a: number, b: number): number {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return Math.max(a, b);
    }
}

export interface TrashedInfo {
    who?: string;
    when?: number;
}

export interface EntryMeta {
    mimeType: string;
    size: number;
    serverCreateDate: Date;
    serverDate: Date;
    createDate: number;
    modifiedDate: number;
    modifier: string;
    owner: string;
    version: string;
    metaLastVersion: string;
    bindedElementId: string;
    styleName: string;
    styleStr: string;
    trashedInfo?: TrashedInfo;
}

export interface DirStats {
    modifiedDate: number;
    filesCount: number;
    directoriesCount: number;
    filesSize: number;
}

export abstract class Entry {
    
    meta: EntryMeta;
    path: string;
    id: string;
    
    protected constructor(
        public type: string,
        public tree: Tree,
        public parent: Directory,
        public ref: privfs.fs.descriptor.ref.DescriptorRef,
        public name: string
    ) {
        this.path = Helper.resolvePath(this.parent ? this.parent.path : "/", this.name);
        this.id = Entry.getId(this.tree.section.getId(), this.path);
        this.meta = {
            mimeType: MimeType.resolve(this.name),
            size: null,
            serverCreateDate: null,
            serverDate: null,
            createDate: null,
            modifiedDate: null,
            modifier: null,
            owner: null,
            version: null,
            metaLastVersion: null,
            bindedElementId: null,
            styleName: null,
            styleStr: null,
            trashedInfo: null,
        };
    }
    
    static create(type: string, tree: Tree, parent: Directory, ref: privfs.fs.descriptor.ref.DescriptorRef, name: string): Entry {
        if (type == "directory") {
            return new Directory(tree, parent, ref, name);
        }
        else if (type == "file") {
            return new File(tree, parent, ref, name);
        }
        throw new Error("Invalid entry type '" + type + "'");
    }
    
    static getId(sectionId: string, path: string): string {
        return "section|file|" + sectionId + "|" + path;
    }
    
    static parseId(entryId: string): {sectionId: string, path: string} {
        if (!Lang.startsWith(entryId, "section|file|")) {
            return null;
        }
        let splitted = entryId.substring(13).split("|");
        return {
            sectionId: splitted[0],
            path: splitted[1]
        };
    }
    
    isDirectory(): this is Directory {
        return this instanceof Directory;
    }
    
    isFile(): this is File {
        return this instanceof File;
    }
    
    onDescriptorNewVersionEvent(descriptor: privfs.fs.descriptor.Descriptor): void {
        if (descriptor.ref.id == this.ref.id) {
            this.onDescriptorNewVersion(descriptor);
        }
    }
    
    onDescriptorNewVersion(descriptor: privfs.fs.descriptor.Descriptor): void {
        let version = descriptor.lastVersion;
        if (version == null) {
            return;
        }
        if (this.meta.version == version.raw.signature && this.meta.metaLastVersion == this.meta.version) {
            return;
        }
        if (version.extra) {
            this.refreshWithNewVersion(version, true);
            if (this.parent) {
                this.parent.refreshDirStats();
            }
        }
        else {
            version.getExtra((<privfs.fs.descriptor.ref.DescriptorRefRead>this.ref).readKey).then(() => {
                this.onDescriptorNewVersion(descriptor);
            })
            .fail(e => {
                Logger.error("Error during loading meta", this.path, e);
            });
        }
    }
    
    sync(pmxEntry: privfs.fs.file.entry.Entry): void {
        this.syncMeta(pmxEntry, true);
    }
    
    syncMeta(pmxEntry: privfs.fs.file.entry.Entry, fireEvent: boolean): boolean {
        let descriptor = pmxEntry.getCachedDescriptor(this.tree.fileSystem.fsd.manager);
        return descriptor && descriptor.lastVersion ? this.refreshWithNewVersion(descriptor.lastVersion, fireEvent) : false;
    }
    
    refreshWithNewVersion(version: privfs.fs.descriptor.Version, fireEvent: boolean): boolean {
        if (this.meta.version == version.raw.signature && this.meta.metaLastVersion == this.meta.version) {
            return false;
        }
        this.applyDescriptor(version.descriptor);
        this.applyRaw(version.raw);
        let meta = version.extra ? version.extra.meta : null;
        if (meta) {
            this.applyMeta(meta);
            this.meta.metaLastVersion = this.meta.version;
        }
        if (fireEvent) {
            this.tree.collection.updateElement(this);
        }
        return true;
    }
    
    applyDescriptor(descriptor: privfs.fs.descriptor.Descriptor) {
        this.meta.serverCreateDate = descriptor.creationDate;
        this.meta.owner = descriptor.owner;
    }
    
    applyRaw(raw: privfs.fs.descriptor.Raw) {
        this.meta.serverDate = raw.serverDate;
        this.meta.modifier = raw.modifier || this.meta.owner;
        this.meta.version = raw.signature;
    }
    
    applyMeta(meta: privfs.types.descriptor.Meta) {
        if (meta) {
            if (meta.mimeType) {
                this.meta.mimeType = MimeType.resolve2(this.name, meta.mimeType);
            }
            if (meta.size) {
                this.meta.size = meta.size;
            }
            if (meta.createDate) {
                this.meta.createDate = meta.createDate;
            }
            if (meta.modifiedDate) {
                this.meta.modifiedDate = meta.modifiedDate;
            }
            if (meta.bindedElementId) {
                this.meta.bindedElementId = meta.bindedElementId;
            }
            if ((<any>meta).styleName) {
                this.meta.styleName = (<any>meta).styleName;
            }
            if ((<any>meta).styleStr) {
                this.meta.styleStr = (<any>meta).styleStr;
            }
            if ((<any>meta).trashedInfo) {
                this.meta.trashedInfo = (<any>meta).trashedInfo;
            }
        }
    }
    
    getTrashedInfo(): TrashedInfo {
        if (this.meta && this.meta.trashedInfo) {
            return this.meta.trashedInfo;
        }
        if (!this.path || this.path.indexOf("/.trash/") < 0) {
            return null;
        }
        return {};
    }
}

export class Directory extends Entry {
    
    entries: {[name: string]: Entry};
    dirStats: DirStats;
    
    constructor(
        public tree: Tree,
        public parent: Directory,
        public ref: privfs.fs.descriptor.ref.DescriptorRef,
        public name: string
    ) {
        super("directory", tree, parent, ref, name);
        this.entries = {};
        this.dirStats = {
            modifiedDate: this.meta.modifiedDate,
            filesCount: 0,
            directoriesCount: 0,
            filesSize: 0
        };
    }
    
    removeChildren() {
        for (let name in this.entries) {
            let entry = this.entries[name];
            this.tree.collection.remove(entry);
            if (entry.isDirectory()) {
                entry.removeChildren();
            }
        }
    }
    
    getPmxEntry(): privfs.fs.file.entry.Directory {
        if (this.parent == null) {
            return this.tree.fileSystem.root;
        }
        let parentDir = this.parent.getPmxEntry();
        if (parentDir == null || parentDir.entries == null) {
            return null;
        }
        let dir = parentDir.entries ? parentDir.entries.getByName(this.name) : null;
        return dir && dir.isDirectory() ? <privfs.fs.file.entry.Directory>dir : null;
    }
    
    onDescriptorNewVersionEvent(descriptor: privfs.fs.descriptor.Descriptor): void {
        if (descriptor.ref.id == this.ref.id) {
            this.onDescriptorNewVersion(descriptor);
        }
        for (let name in this.entries) {
            this.entries[name].onDescriptorNewVersionEvent(descriptor);
        }
    }
    
    onDescriptorNewVersion(descriptor: privfs.fs.descriptor.Descriptor): void {
        let version = descriptor.lastVersion;
        if (version == null) {
            return;
        }
        if (this.meta.version == version.raw.signature && this.meta.metaLastVersion == this.meta.version) {
            return;
        }
        let pmxEntry = this.getPmxEntry();
        if (!pmxEntry) {
            return super.onDescriptorNewVersion(descriptor);
        }
        if (version.extra && pmxEntry.entries && pmxEntry.handle && pmxEntry.handle.currentVersion.raw.signature == version.raw.signature) {
            this.sync(pmxEntry);
            if (this.parent) {
                this.parent.refreshDirStats();
            }
            if (this.tree.autoLoadEntries) {
                pmxEntry.loadNotLoadedMeta().fail(e => {
                    Logger.error("Error during loading entries meta", this.path, e);
                });
            }
        }
        else {
            Q.all([
                pmxEntry.getEntries(true),
                version.getExtra((<privfs.fs.descriptor.ref.DescriptorRefRead>this.ref).readKey)
            ])
            .then(() => {
                return pmxEntry.decryptMetaInEntries();
            })
            .then(() => {
                this.onDescriptorNewVersion(descriptor);
            })
            .fail(e => {
                Logger.error("Error during loading directory", this.path, e);
            });
        }
    }
    
    sync(pmxEntry: privfs.fs.file.entry.Directory): void {
        let changed = this.syncMeta(pmxEntry, false);
        this.syncEntries(pmxEntry);
        changed = this.syncDirStats() || changed;
        if (changed) {
            this.tree.collection.updateElement(this);
        }
    }
    
    refreshDirStats() {
        if (this.syncDirStats()) {
            this.tree.collection.updateElement(this);
        }
        if (this.parent) {
            this.parent.refreshDirStats();
        }
    }
    
    syncDirStats(): boolean {
        let oldDirStats = this.dirStats;
        this.dirStats = {
            modifiedDate: this.meta.modifiedDate,
            filesCount: 0,
            directoriesCount: 0,
            filesSize: 0
        };
        for (let name in this.entries) {
            let entry = this.entries[name];
            if (entry.isDirectory()) {
                this.dirStats.modifiedDate = Helper.maxWithNulls(this.dirStats.modifiedDate, entry.dirStats.modifiedDate);
                this.dirStats.filesCount += entry.dirStats.filesCount;
                this.dirStats.directoriesCount += entry.dirStats.directoriesCount + 1;
            }
            else if (entry.isFile()) {
                this.dirStats.modifiedDate = Helper.maxWithNulls(this.dirStats.modifiedDate, entry.meta.modifiedDate);
                this.dirStats.filesCount++;
                this.dirStats.filesSize += entry.meta.size || 0;
            }
        }
        return oldDirStats.modifiedDate != this.dirStats.modifiedDate ||
            oldDirStats.filesCount != this.dirStats.filesCount ||
            oldDirStats.directoriesCount != this.dirStats.directoriesCount ||
            oldDirStats.filesSize != this.dirStats.filesSize;
    }
    
    syncEntries(pmxEntry: privfs.fs.file.entry.Directory): void {
        let list = pmxEntry.entries ? pmxEntry.entries.list : [];
        let newEntries: {[name: string]: Entry} = {}
        list.forEach(px => {
            let entry = this.entries[px.name];
            delete this.entries[px.name];
            //rename optimalization => try find renamed object but after that you have to change its name/path/childrens paths itd.
            if (entry != null && entry.type != px.type) {
                this.tree.collection.remove(entry);
                if (entry.isDirectory()) {
                    entry.removeChildren();
                }
                entry = null;
            }
            if (entry == null) {
                entry = Entry.create(px.type, this.tree, this, px.ref, px.name);
                entry.sync(px);
                this.tree.collection.add(entry);
                newEntries[px.name] = entry;
            }
            else {
                newEntries[px.name] = entry;
                entry.sync(px);
            }
        });
        for (let name in this.entries) {
            let entry = this.entries[name];
            this.tree.collection.remove(entry);
            if (entry.isDirectory()) {
                entry.removeChildren();
            }
        }
        this.entries = newEntries;
    }
}

export class File extends Entry {
    
    constructor(
        public tree: Tree,
        public parent: Directory,
        public ref: privfs.fs.descriptor.ref.DescriptorRef,
        public name: string
    ) {
        super("file", tree, parent, ref, name);
    }
}