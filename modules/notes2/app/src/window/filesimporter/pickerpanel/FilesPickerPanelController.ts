import { BaseItemsPanelController } from "./BaseItemsPanelController";
import { utils, window, component, mail } from "pmc-mail";
import { FileEntry, FileEntryModel, AddItemEvent } from "./Types";
import { LocalEntry } from "../../../main/LocalFS";
import { FileEntryBase } from "../../../main/Notes2Utils";

class EntryFromLocalFileEntry implements FileEntry {
    id: string;
    path: string;
    fileType: string;
    icon: string;
    isParentDir: boolean;
    modificationDate: number;
    name: string;
    size: number;
    basePath: string;
    hidden: boolean;

    constructor(f: FileEntryBase, basePath: string, iconsResolver: (mime: string) => string) {
        let localFile = <LocalEntry>f;
        this.id = localFile.id;
        this.path = localFile.path;
        this.fileType = localFile.type;
        this.icon = localFile.type == "directory" ? "fa-folder" : iconsResolver(localFile.mime);
        this.modificationDate = localFile.mtime.getTime(),
        this.name = localFile.name;
        this.size = localFile.size;
        this.basePath = basePath;
        this.hidden = localFile.hidden;
    }

    getFileType(): string {
        return this.fileType;
    }
    getId(): string {
        return this.id;
    }
    getPath(): string {
        return this.path;
    }
    getIcon(): string {
        return this.icon;
    }
    getIsParentDir(): boolean {
        return this.isParentDir;
    }
    getModificationDate(): number {
        return this.modificationDate;
    }
    getName(): string {
        return this.name;
    }
    getSize(): number {
        return this.size;
    }
    getBasePath(): string {
        return this.basePath;
    }
    isHidden(): boolean {
        return this.hidden;
    }

}

export class FilesPickerPanelController extends BaseItemsPanelController<FileEntry, FileEntryModel> {
    entriesCollection: utils.collection.TransformCollection<FileEntry, FileEntryBase>;
    currentDir: string;
    showHidden: boolean = false;

    constructor (
        parent: window.base.BaseWindowController, 
        public personsComponent: component.persons.PersonsController, 
        public sourceCollection: utils.collection.BaseCollection<FileEntryBase>,
        public onUpdateCollection: (path: string, parentPath: string) => void,
        public iconsResolver: (mimeType: string) => string
    ) {        
        super(parent, personsComponent);
        this.ipcMode = true;
        this.entriesCollection = this.addComponent("transformCollection-" + this.constructor.name, new utils.collection.TransformCollection<FileEntry, FileEntryBase>(
            this.sourceCollection, 
            (entry) => {
                return this.convertLocalEntryToFileEntry(<LocalEntry>entry, this.iconsResolver);
            }
        ));
        super.addBaseCollection(this.entriesCollection);
    }

    protected filterEntry(entry: FileEntry): boolean {
        if (entry.isHidden() && !this.showHidden) {
            return false;
        }
        return true;
    }    
    
    protected convertEntry(entry: FileEntry): FileEntryModel {
        return {
            fileType: entry.getFileType(),
            id: entry.getId(),
            path: entry.getPath(),
            icon: entry.getIcon(),
            isParentDir: entry.getIsParentDir(),
            modificationDate: entry.getModificationDate(),
            name: entry.getName(),
            size: entry.getSize(),
            basePath: entry.getBasePath(),
            hidden: entry.isHidden()
        }
    }
    
    protected sortEntry(a: FileEntryModel, b: FileEntryModel): number {
        if (a.fileType != b.fileType) {
            return a.fileType == "directory" ? -1 : 1;
        }
        return a.path.localeCompare(b.path);
    }

    protected convertLocalEntryToFileEntry(entry: FileEntryBase, iconsResolver: (mime: string) => string): FileEntry {
        return new EntryFromLocalFileEntry(entry, this.getCurrentDir(), iconsResolver);
    }

    onViewDirectoryClick(id: string, parentId: string): void {
        if (id == "parent") {
            let parentItem = this.itemsTransformCollection.find(x => x.id == "parent");
            this.setCurrentDir(parentItem.path);
            this.onUpdateCollection(parentItem.path, parentId);
        }
        else {
            this.setCurrentDir(id);
            this.onUpdateCollection(id, parentId);    
        }
    }

    onViewAddItemClick(id: string): void {
        let item = this.itemsMergedCollection.find(x=>x.getId() == id);
        this.dispatchEvent<AddItemEvent>({
            type: "add-item",
            id: item.getId(),
            basePath: item.getBasePath()
        })
    }

    protected onActiveCollectionChange(event: any): void {
       
    }

    setCurrentDir(dir: string): void {
        this.currentDir = dir;
    }

    getCurrentDir(): string {
        return this.currentDir;
    }

    setShowHidden(showHidden: boolean): void {
        this.showHidden = showHidden;
        this.itemsFilteredCollection.refresh();
    }

    getItem(id: string, basePath: string): FileEntry {
        return this.itemsMergedCollection.find(x => x.getId() == id && x.getBasePath() == basePath);
    }

}