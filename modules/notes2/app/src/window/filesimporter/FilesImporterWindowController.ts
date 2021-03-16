import {app, component, mail, utils, window, Q, Types, privfs} from "pmc-mail";
import {Notes2Plugin} from "../../main/Notes2Plugin";
import { i18n } from "./i18n";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;
import { LocalFS, LocalEntry } from "../../main/LocalFS";
import { FileEntryBase, Notes2Utils } from "../../main/Notes2Utils";
import { TreeItem } from "./TreeItem";
import { FilesTree, Leaf } from "./FilesTree";
import { FilesImporterUtils } from "./FilesImporterUtils";
import { ProcessingQueue } from "./ProcessingQueue";
import { SectionsPickerPanelController } from "./pickerpanel/SectionsPickerPanelController";
import { FilesPickerPanelController } from "./pickerpanel/FilesPickerPanelController";
import { FilesToImportPanelController } from "./pickerpanel/FilesToImportPanelController";
import { AddItemEvent, RemoveItemEvent, FileEntry } from "./pickerpanel/Types";
export interface Model {
    sectionName: string;
    sectionType: string;
    destDirectory: string;
    showHiddenFiles: boolean;
    computerName: string;
    currentPath: string;
    conversationModel?: Types.webUtils.ConversationModel;
}

@Dependencies(["tree", "extlist", "splitter"])
export class FilesImporterWindowController extends window.base.BaseWindowController {
    static DEFAULT_WINDOW_WIDTH: number = 800;
    static textsPrefix: string = "plugin.notes2.window.filesimporter.";
    static rootId: string = "/";
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    notes2Plugin: Notes2Plugin;
    
    localFS: LocalFS;
    personsComponent: component.persons.PersonsController;

    filesTree: FilesTree;
    treeProcessingQueue: ProcessingQueue;
    importerUtils: FilesImporterUtils;
    sectionDestinationDir: string;
    currentBrowsingDir: string = null;
    showHiddenFiles: boolean = false;

    currentFsDirCollection: utils.collection.MutableCollection<FileEntryBase>;

    ///////////////////////////////////////
    sectionsPicker: SectionsPickerPanelController;
    filesPicker: FilesPickerPanelController;
    choosenFiles: FilesToImportPanelController;
    panelsSplitter: component.splitter.SplitterController;

    choosenFilesCollection: utils.collection.MutableCollection<FileEntry>;
    session: mail.session.Session;

    constructor(parentWindow: Types.app.WindowParent, public section: mail.section.SectionService, sectionDestinationDir: string, browsingDir?: string) {
        super(parentWindow, __filename, __dirname, {
            isPublic: false,
            subs: {
                "panels-splitter": {
                    defaultValue: Math.round(FilesImporterWindowController.DEFAULT_WINDOW_WIDTH / 2),
                }
            }
        });
        this.ipcMode = true;
        this.setPluginViewAssets("notes2");
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));


        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            minWidth: 600,
            width: FilesImporterWindowController.DEFAULT_WINDOW_WIDTH,
            height: 400,
            resizable: true,
            icon: "icon fa fa-upload",
            title: this.i18n("plugin.notes2.window.filesimporter.title")
        };
        this.importerUtils = new FilesImporterUtils(this.app);
        this.sectionDestinationDir = sectionDestinationDir;
        this.currentFsDirCollection = this.addComponent("currentFsDirCollection", new utils.collection.MutableCollection<FileEntryBase>());
        
        this.filesTree = new FilesTree();
        this.treeProcessingQueue = new ProcessingQueue();
    }

    public setSession(session: mail.session.Session) {
        this.session = session;
    }

    private getSession(): mail.session.Session {
        return this.session ? this.session : this.app.sessionManager.getLocalSession();
    }

    init(): Q.Promise<void> {
        return Q().then(() => {
            return this.loadSettings();
        })
        .then(() => {
            this.localFS = new LocalFS(this.currentFsDirCollection, "", (newPath) => {
                this.setCurrentDir(newPath);
                // this.addSubTree(newPath, this.localFS.currentFileNamesCollection);
                this.processNewPath(newPath, this.localFS.currentFileNamesCollection);
            });  
            this.initComponents();    
            this.localFS.browseWithParent("");
        })
    }

    initComponents(): void {
        this.sectionsPicker = this.addComponent("sectionsPicker", new SectionsPickerPanelController(this, null, this.app.sessionManager.getLocalSession().sectionManager.sectionsCollection));
        this.filesPicker = this.addComponent("filesPicker", new FilesPickerPanelController(this, null, this.currentFsDirCollection, (path, parentPath) => {
                this.setCurrentDir(path);
                this.updateCurrentDirInView(path);     
                this.localFS.browseWithParent(this.getCurrentDir())
            },
            (mimeType) => {
                return this.app.shellRegistry.resolveIcon(mimeType)
            }    
        ));
        this.choosenFilesCollection = this.addComponent("choosenFilesCollection", new utils.collection.MutableCollection<FileEntry>());
        this.choosenFiles = this.addComponent("choosenFiles", new FilesToImportPanelController(this, null, this.choosenFilesCollection))
        let settings = this.settings.create("panels-splitter");

        // start always with splitter centered
        settings.currentValue = Math.round(FilesImporterWindowController.DEFAULT_WINDOW_WIDTH / 2);
        this.panelsSplitter = this.addComponent("panelsSplitter", this.componentFactory.createComponent("splitter", [this, settings]));
    
        this.filesPicker.bindEvent<AddItemEvent>(this.filesPicker, "add-item", this.onItemAddClick.bind(this));
        this.choosenFiles.bindEvent<RemoveItemEvent>(this.choosenFiles, "remove-item", this.onItemRemoveClick.bind(this));
    }

    onViewLoad() {
        this.updateCurrentDirInView(this.getCurrentDir());
        this.updateFilesTotalSize();     
    }


    updateCurrentDirInView(dir: string): void {
        this.callViewMethod("updateCurrentDir", dir);
    }

    onItemAddClick(event: AddItemEvent): void {
        let item = this.filesPicker.getItem(event.id, event.basePath);
        let alreadyChoosen = this.choosenFiles.getItem(event.id, event.basePath);
        
        if (item && !alreadyChoosen) {
            this.choosenFilesCollection.add(item);
            this.updateItemSelection(item.getId(), true);
        }
    }

    onItemRemoveClick(event: RemoveItemEvent): void {
        let item = this.choosenFiles.itemsMergedCollection.find(x => x.getId() == event.id && x.getBasePath() == event.basePath);
        
        if (item) {
            const itemIndex = this.choosenFilesCollection.indexOf(item);
            if (itemIndex > -1) {
                this.choosenFilesCollection.removeAt(itemIndex);
                this.updateItemSelection(item.getId(), false);
            }
        }
    }

    getRootEntry(): LocalEntry {
        return {
            id: "/",
            parent: null,
            type: "directory",
            path: "/",
            name: "/",
            size: 0,
            ctime: new Date(),
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false,
        }
    }

    async processNewPath(path: string, collection: utils.collection.MutableCollection<FileEntryBase>, asChecked = false): Promise<void> {
        return new Promise<void>(() => {
            this.filesTree.addFileToTree(<TreeItem>{
                id: path,
                parentId: path.split("/").slice(0, -1).join("/"),
                type: "directory",
                checked: asChecked
            });

            collection.forEach(async child => {
                let entry = <LocalEntry>child;
                let parentId: string;
                if (entry.id == "/") {
                    parentId = "root";
                }
                else {
                    parentId = entry.parent ? entry.parent.id : null
                }
                this.filesTree.addFileToTree({
                    id: entry.id,
                    parentId: parentId,
                    type: entry.type,
                    checked: asChecked
                })
                if (entry.type == "file") {
                    this.filesTree.setFileSize(entry.id, entry.size);
                }
            })

        })
    }

    onViewHiddenChanged(checked: boolean): void {
        this.filesPicker.setShowHidden(checked);
    }

    resetSizeCountrInView(): void {
        this.callViewMethod("resetSizeCounter");
    }

    updateSizeCounterInView(addSize: number): void {
        this.callViewMethod("addSizeToCounter", addSize);
    }

    setCurrentDir(dir: string): void {
        this.currentBrowsingDir = dir;
    }

    getCurrentDir(): string {
        return this.currentBrowsingDir;
    }

    getModel(): Model {
        let sectionName: string;
        let convModel: Types.webUtils.ConversationModel;
        let sectionId = this.section.getId();
        if (this.section.getId().indexOf("usergroup:") == 0) {
            const conv = this.getSession().conv2Service.collection.find(x => x.section && (x.section.getId() == sectionId || x.id == sectionId));
            convModel = utils.Converter.convertConv2(conv, 0, 0, 0, true, 0, false, false, false, null);
            sectionName = null;
        }
        else {
            if (this.section.getId() == "private:" + this.section.manager.identity.user) {
                sectionName = this.app.localeService.i18n("plugin.notes2.component.filesList.filter.my");
            }
            else if (this.section.getId() == "all") {
                this.app.localeService.i18n("plugin.notes2.component.filesList.filter.all");
            }
            else {
                sectionName = this.section.getName()
            }    
        }
        return {
            sectionName: sectionName,
            sectionType: this.section.isPrivate() ? "private" : "public",
            destDirectory: this.sectionDestinationDir,
            showHiddenFiles: this.showHiddenFiles,
            computerName: (<any>this.app).getComputerName(),
            currentPath: this.getCurrentDir(),
            conversationModel: convModel
        };
    }
    
    updateItemSelection(itemId: string, checked: boolean): void {
        this.filesTree.setFileChecked(itemId, checked);
        const leaf = this.filesTree.findLeaf(itemId);

        if (checked && leaf) {
            if (leaf.visited) {
                this.callViewDoneProcessing(itemId);
            }
            else {
                this.browseFilesTreeDeep();
            }
        }
        else if (! checked) {
            if (leaf) {
                this.cancelProcessing(itemId);
            }
        }
        this.updateFilesTotalSize();
    }

    cancelProcessing(id: string): void {
        (<any>this.app).cancelFileTreeBrowseWorker(id);
        // this.filesTree.removePathFromTree(id);
        const leafToRemove = this.filesTree.findLeaf(id);
        if (leafToRemove.type == "directory") {
            this.filesTree.deleteLeaf(id);
            this.filesTree.addFileToTree({
                id: id,
                parentId: leafToRemove.parentId,
                type: leafToRemove.type,
                checked: false
            })

        }
    }

    callViewDoneProcessing(id: string) {
        this.callViewMethod("doneProcessing", id);
    }

    onViewClose() {
        this.close();
    }

    onViewImportFiles(): void {
        new Promise<void>(async () => {
            try {
                await this.uploadFiles();
            }
            catch(e) {
                console.log("error in uploadFiles");
            }
            this.close();
        })
    }

    private async addLeafToUpload(leaf: Leaf, baseDir: string) {
        let sectionTree = await this.section.getFileTree();
        let relative = Leaf.getIdLastPart(leaf.id);

        if (leaf.type == "file") {
            let entry = LocalFS.getEntry(leaf.id);
            let content = this.app.createContent(<any>{
                path: leaf.id,
                type: entry.mime
            });
            (<any>this.app).uploadService.addFile({content: content, session: this.app.sessionManager.getLocalSession(), destination: this.section.getId(), path: baseDir});
        }

        if (leaf.type == "directory") {
            let resolvedBaseDir = baseDir + "/" + relative;
            let baseDirExists = resolvedBaseDir == "/" ? true : await sectionTree.fileSystem.exists(resolvedBaseDir);
            if (! baseDirExists) {
                await sectionTree.fileSystem.mkdirs(resolvedBaseDir);
            }

            for (let child in leaf.children) {
                await this.addLeafToUpload(leaf.children[child], resolvedBaseDir);
            }
        }

    }

    private async uploadFiles(): Promise<void> {
        for (let p of this.choosenFiles.items.collection.list) {
            let leaf = this.filesTree.findLeaf(p.id);

            let baseDir = this.sectionDestinationDir;
            await this.addLeafToUpload(leaf, baseDir);
        }
    }

    ///////////////// PO NOWEMU ////////////////
    browseFilesTreeDeep(): void {
        let dirs = this.filesTree.getDirectoriesToVisit();
        this.addDirsToProcessingQueue(dirs);
    }

    updateFilesTotalSize(): void {
        const totalCount = this.filesTree.getCheckedCount();
        const totalSize = this.filesTree.getCheckedTotalSize();
        this.callViewMethod("updateFilesTotal", totalCount, totalSize);
    }

    addDirsToProcessingQueue(dirs: string[]): void {
        for (const dir of dirs) {
            this.addSingleDirToProcessingQueue(dir);
        }    
    }

    addSingleDirToProcessingQueue(dir: string): void {
        (<any>this.app).fireFileTreeBrowseWorker(dir, (progress: Types.filesimporter.ScanResult) => {
            if (progress.finished) {
                if (progress.hasError) {
                    throw new Error("error in worker" + progress.err);
                }
                // this.updateFilesList(dir);
            }
            if (progress.files) {
                this.addListToTreeFromWorker(progress);
                this.updateFilesTotalSize();    
            }
        })

    }

    addDirToTree(path: string): void {
        this.filesTree.addFileToTree(<TreeItem>{
            id: path,
            parentId: path.split("/").slice(0, -1).join("/"),
            type: "directory",
            checked: true
        });
    }

    addListToTree(list: LocalEntry[]): void {
        for(let element of list) {
            let entry = <LocalEntry>element;
            
            let parentId: string;
            if (entry.id == "/") {
                parentId = "root";
            }
            else {
                parentId = entry.parent ? entry.parent.id : null
            }
            this.filesTree.addFileToTree({
                id: entry.id,
                parentId: parentId,
                type: entry.type,
                checked: true,
            })
            if (entry.type == "file") {
                this.filesTree.setFileSize(entry.id, entry.size);
            }
        }
    }

    addListToTreeFromWorker(scanResult: Types.filesimporter.ScanResult): void {
        this.filesTree.setFileVisited(scanResult.path);
        for(let element of scanResult.files) {
            this.filesTree.addFileToTree({
                id: element.path,
                parentId: scanResult.path,
                type: element.fileType,
                checked: true
            })
            if (element.fileType == "file") {
                this.filesTree.setFileSize(element.path, element.size);
            }
        }
    }

    getAllSelectedFiles(): string[] {
        const list = this.filesTree.getSelectedFiles();
        return list;
    }
////////////////////////////////////////////////////////////////////////////////////////





}



/*
JAK TO DZIALA:
skanowanie w glab po nowemu:
- wchodzac do katalogu - pobieramy jego zawartosc i dodajemy do drzewa
- nastepnie wywolujemy getDirsToVisit() ktora przeglada drzewo w poszukiwaniu nieodwiedzonych katalogow
- majac liste takich katalogow - wywolujemy addDirsToProcessingQueue(dirs)
- funkcja addDirsToProcessQueue() dodaje ktalogi z listy po kolei, zeby zawolac na nich browseEx() i w wyniku dostac kolejne pliki i katalogi, ktore dodamy do drzewa...

- powtarzamy getDirsToVisit()..

TODO:
DONE nie dziala przycisk Close
DONE wyswietlanie katalogu docelowego
DONE blokowanie przycisku import podczas wczucania do uploadera
DONE zamykanie okienka importu po dodaniu do uploadera
DONE okienko uploadu - najnowsze pliki na gorze
DONE wyswietlanie pelnych sciezek
DONE odchudzenie okienka (lzejszy styl)
- okienko uploadu - mozliwosc czyszczenia listy
- okienko uploadu - zapamietywanie listy
- okienko uploadu - otwieranie katalogu docelowego
- recent uploads z glownego menu (po prostu zmienic nazwe i ikonke)
*/