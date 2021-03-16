import { BaseItemsPanelController } from "./BaseItemsPanelController";
import { utils, window, component } from "pmc-mail";
import { FileEntry, FileEntryModel, RemoveItemEvent } from "./Types";



export class FilesToImportPanelController extends BaseItemsPanelController<FileEntry, FileEntryModel> {
    constructor (
        parent: window.base.BaseWindowController, 
        public personsComponent: component.persons.PersonsController, 
        public sourceCollection: utils.collection.MutableCollection<FileEntry>
    ) {
        
        super(parent, personsComponent);
        this.ipcMode = true;
        super.addBaseCollection(this.sourceCollection);
    }
    
    protected filterEntry(entry: FileEntry): boolean {
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
        return 0;
    }


    protected onActiveCollectionChange(event: any): void {
       
    }

    onViewRemoveItemClick(id: string): void {
        const item = this.itemsMergedCollection.find(x => x.getId() == id);
        this.dispatchEvent<RemoveItemEvent>({
            type: "remove-item",
            id: item.getId(),
            basePath: item.getBasePath()
        })
    }

    getItem(id: string, basePath: string): FileEntry {
        return this.itemsMergedCollection.find(x => x.getId() == id && x.getBasePath() == basePath);
    }

}