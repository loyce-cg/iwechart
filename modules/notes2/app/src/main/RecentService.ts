import * as Mail from "pmc-mail";
import Q = Mail.Q;
import { LocalOpenableElement, LocalFS } from "./LocalFS";
import { Notes2Plugin } from "./Notes2Plugin";
let Logger = Mail.Logger.get("privfs-notes2-plugin.RecentFiles");

export interface RecentOpenedFile {
    id: string;
    name: string;
    action?: number;
    isLocal?: boolean;
    did?: string;
}

export class RecentService {
    
    static RECENT_FILES_PREFERENCES_KEY: string = "notes2-plugin.recentFiles";
    static RECENT_FILES_LIMIT: number = 100;
    
    recentOpenFiles: RecentOpenedFile[] = null;
    
    constructor(
        public app: Mail.app.common.CommonApplication,
        public sectionManager: Mail.mail.section.SectionManager,
        public userPreferences: Mail.mail.UserPreferences.UserPreferences,
        public sinkIndexManager: Mail.mail.SinkIndexManager,
        public notes2Plugin: Notes2Plugin
    ) {
    }
    
    saveRecentFilesToPreferences(items: RecentOpenedFile[]) {
        // optymalizacja - limit do RecentService.RECENT_FILES_LIMIT itemów
        let itemsToSave = items.slice(0, RecentService.RECENT_FILES_LIMIT);
        return this.userPreferences.set(RecentService.RECENT_FILES_PREFERENCES_KEY, JSON.stringify(itemsToSave), true)
    }
    
    getRecentFilesFromPreferences(): Q.Promise<RecentOpenedFile[]> {
        return Q().then(() => {
            if (this.app.mailClientApi == null || this.userPreferences == null) {
                return [];
            }
            return Q().then(() => {
                return this.userPreferences.get(RecentService.RECENT_FILES_PREFERENCES_KEY, null);
            })
            .then(data => {
                return data ? JSON.parse(data) : [];
            });
        });
    }
    
    addRecentOpenedFile(event: Mail.Types.event.FileOpenedEvent): Q.Promise<void> {
        if (event.hostHash != this.app.sessionManager.getLocalSession().hostHash) {
            return Q();
        }
        return Q().then(() => {
            return this.getRecentOpenedFiles();
        }).then(() => {
            if (!event.element.hasElementId() || !event.element.isEditable() || event.docked || event.action == Mail.app.common.shelltypes.ShellOpenAction.PREVIEW) {
                return;
            }
            let item: RecentOpenedFile = {
                id: event.element.getElementId(),
                name: event.element.getName(),
                action: event.action,
                isLocal: event.element instanceof LocalOpenableElement,
                did: event.element instanceof Mail.mail.section.OpenableSectionFile ? event.element.handle.ref.did : null,
            };
            let fileIndex = -1;
            do {
                fileIndex = -1;
                for (let i = 0; i < this.recentOpenFiles.length; i++) {
                    if ((item.did && this.recentOpenFiles[i].did == item.did) || (!item.did && this.recentOpenFiles[i].id == item.id)) {
                        fileIndex = i;
                        break;
                    }
                }
                if (fileIndex > -1) {
                    this.recentOpenFiles.splice(fileIndex, 1);
                }
            } while (fileIndex > -1);
            this.recentOpenFiles.unshift(item);
            
            return this.saveRecentFilesToPreferences(this.recentOpenFiles);
        });
    }
    
    removeRecentOpenedFile(fileId: string, did?: string): Q.Promise<void> {
        if (!this.recentOpenFiles) {
            return Q();
        }
        let fileIndex = -1;
        for (let i = 0; i < this.recentOpenFiles.length; i++) {
            if ((did && this.recentOpenFiles[i].did == did) || (!did && this.recentOpenFiles[i].id == fileId)) {
                fileIndex = i;
                break;
            }
        }
        if (fileIndex > -1) {
            this.recentOpenFiles.splice(fileIndex, 1);
        }
        return this.saveRecentFilesToPreferences(this.recentOpenFiles);
    }
    
    saveCurrentList(): Q.Promise<void> {
        return this.saveRecentFilesToPreferences(this.recentOpenFiles);
    }
    
    getRecentOpenedFiles(): Q.Promise<RecentOpenedFile[]> {
        return this.getRecentFilesFromPreferences()
        .then(list => {
            this.recentOpenFiles = list;
            let maxFiles = this.recentOpenFiles.length >= RecentService.RECENT_FILES_LIMIT ? RecentService.RECENT_FILES_LIMIT : this.recentOpenFiles.length;
            return this.recentOpenFiles.slice(0, maxFiles);
        })
    }
    
    openLastFileFromRecent(session: Mail.mail.session.Session): Q.Promise<void> {
        return Q(null).then(() => {
            return this.getRecentOpenedFiles()
            .then(list => {
                if (list.length > 0) {
                    const fileItem = list[0];
                    return this.getRecentFileToOpen(fileItem.id, fileItem.did)
                        .then(element => {
                            let action = fileItem.action || Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL;
                            this.app.shellRegistry.shellOpen({
                                action: action,
                                element: element,
                                session: session
                            });
                        });
                        
                } else {
                    return null;
                }
            })
        })
        
    }
    
    getRecentFileToOpen(id: string, did?: string): Q.Promise<Mail.app.common.shelltypes.OpenableElement> {
        let localRecentOpenedFile = this.recentOpenFiles && this.recentOpenFiles.filter(x => x.id == id && x.isLocal);
        if (localRecentOpenedFile.length > 0) {
            if (!LocalFS.exists(id)) {
                return Q(null);
            }
            return LocalOpenableElement.create(id);
        }
        
        return Q().then((): Q.IWhenable<Mail.app.common.shelltypes.OpenableElement> => {
            let parsed = Mail.mail.filetree.nt.Entry.parseId(id);
            let isRef = id.indexOf("ref://") == 0;
            if (parsed || isRef) {
                let sectionId: string;
                let path: string;
                return Q().then(() => {
                    if (isRef) {
                        let index = id.indexOf("/", 6);
                        sectionId = id.substring(6, index);
                        path = id.substring(index);
                    }
                    else {
                        sectionId = parsed.sectionId;
                        path = parsed.path;
                    }
                    let section = this.sectionManager.filteredCollection.find(x => x.getId() == sectionId);
                    if (section) {
                        return section.getFileTree();
                    }
                    return null;
                })
                .then(tree => {
                    if (tree == null) {
                        return;
                    }
                    if (did) {
                        let fileByDid = tree.collection.find(x => x.ref.did == did);
                        if (!fileByDid) {
                            return;
                        }
                        path = fileByDid.path;
                    }
                    if (tree.collection.indexOfBy(x => x.path == path) < 0) {
                        return;
                    }
                    return tree.section.getFileOpenableElement(path, true)
                    .then(openableElement => {
                        if (!openableElement) {
                            return tree.refreshDeep(true).then(() => {
                                return tree.section.getFileOpenableElement(path, true);
                            });
                        }
                        return openableElement;
                    });
                });
            }
            else {
                let splitted = id.split("/");
                let sinkIndex = this.sinkIndexManager.getSinkIndexById(splitted[0]);
                if (sinkIndex == null) {
                    return;
                }
                let entry = sinkIndex.getEntry(parseInt(splitted[1]));
                if (entry == null) {
                    return;
                }
                let message = entry.getMessage();
                let attachmentIndex = parseInt(splitted[2]);
                let attachment = message.attachments[attachmentIndex];
                if (attachment == null) {
                    return;
                }
                return Mail.app.common.shelltypes.OpenableAttachment.create(attachment, true, true);
            }
        })
    }
    
    clearRecentFiles() {
        return this.userPreferences.set(RecentService.RECENT_FILES_PREFERENCES_KEY, null, true);
    }
    
    onFileRenamed(did: string, oldPath: string, newPath: string): void {
        if (!this.recentOpenFiles) {
            return;
        }
        let elem = this.recentOpenFiles.filter(x => x.did == did)[0];
        if (!elem || !(<any>elem.id).startsWith("section|file|")) {
            return;
        }
        
        let pathStartIdx = elem.id.indexOf("|/");
        let sectionPrefix = elem.id.substr(0, pathStartIdx + 1);
        let newId = sectionPrefix + newPath;
        let newName = newPath.substr(newPath.lastIndexOf("/") + 1);
        elem.id = newId;
        elem.name = newName;
        this.notes2Plugin.afterRecentFileRenamed(elem);
        this.saveCurrentList();
    }
    
    onLocalFileRenamed(oldPath: string, newPath: string): void {
        if (!this.recentOpenFiles) {
            return;
        }
        let elem = this.recentOpenFiles.filter(x => x.id == oldPath)[0];
        if (!elem) {
            return;
        }
        let newName = newPath.substr(newPath.lastIndexOf("/") + 1);
        elem.id = newPath;
        elem.name = newName;
        this.notes2Plugin.afterRecentFileRenamed(elem);
        this.saveCurrentList();
    }
    
    getDid(): void {
        
    }
    
}