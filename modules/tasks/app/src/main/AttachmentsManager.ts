import { mail, Q, privfs } from "pmc-mail";
import { Task } from "./data/Task";
import { TasksPlugin } from "./TasksPlugin";
import { HistoryManager } from "./HistoryManager";

export interface AttachmentInfo {
    did: string,
    name: string,
    trashed: boolean,
}

export type KeyOfAttachment = Extract<keyof Attachment, string>;

export class Attachment {
    
    attachmentInfo: AttachmentInfo;
    currentSectionId: string;
    justAdded: boolean = false;
    justRemoved: boolean = false;
    
    constructor(attachmentInfo: AttachmentInfo, currentSectionId: string) {
        this.attachmentInfo = attachmentInfo;
        this.currentSectionId = currentSectionId;
    }
    
}

export class AttachmentsManager {
    
    protected tasksPlugin: TasksPlugin;
    protected historyManager: HistoryManager;
    protected attachments: Attachment[];
    
    constructor(public session: mail.session.Session, tasksPlugin: TasksPlugin, historyManager: HistoryManager) {
        this.tasksPlugin = tasksPlugin;
        this.historyManager = historyManager;
    }
    
    reset(task: Task = null, session: mail.session.Session = null): void {
        this.attachments = [];
        if (session) {
            this.session = session;
        }
        if (task) {
            for (let attachmentInfoString of task.getAttachments()) {
                let attachmentInfo: AttachmentInfo = JSON.parse(attachmentInfoString);
                this.add(attachmentInfo.did, attachmentInfo.name, task.getProjectId(), true);
            }
        }
    }
    
    resetFromOpenableSectionFiles(openableSectionFiles: mail.section.OpenableSectionFile[]): void {
        this.reset();
        for (let openableSectionFile of openableSectionFiles) {
            this.add(openableSectionFile.handle.ref.did, openableSectionFile.name, openableSectionFile.section.getId(), false);
        }
    }
    
    
    
    
    
    /********************************************************
    ************** Attachments list operations **************
    ********************************************************/
    add(did: string, fileName: string, sectionId: string, addAsExisting: boolean): void {
        let currIndex = this.indexOf(did);
        if (currIndex >= 0) {
            let attachment = this.at(currIndex);
            if (attachment.justRemoved) {
                this.attachments.splice(currIndex, 1);
                this.attachments.push(attachment);
                attachment.justRemoved = false;
            }
            return;
        }
        let attachment = new Attachment(AttachmentsManager.createAttachmentInfo(did, fileName), sectionId);
        attachment.justAdded = !addAsExisting;
        this.attachments.push(attachment);
    }
    
    addOpenableSectionFile(openableSectionFile: mail.section.OpenableSectionFile, addAsExisting: boolean): void {
        this.add(openableSectionFile.handle.ref.did, openableSectionFile.name, openableSectionFile.section.getId(), addAsExisting);
    }
    
    remove(did: string): void{
        let attachment = this.find(did);
        if (attachment) {
            attachment.justRemoved = true;
        }
    }
    
    find(did: string): Attachment {
        for (let attachment of this.attachments) {
            if (attachment.attachmentInfo.did == did) {
                return attachment;
            }
        }
        return null;
    }
    
    indexOf(did: string): number {
        for (let i = 0; i < this.attachments.length; ++i) {
            if (this.attachments[i].attachmentInfo.did == did) {
                return i;
            }
        }
        return -1;
    }
    
    at(index: number): Attachment {
        return this.attachments[index];
    }
    
    has(did: string): boolean {
        return this.find(did) != null;
    }
    
    update(oldDid: string, newDid: string): boolean {
        let attachment = this.find(oldDid);
        if (attachment) {
            attachment.attachmentInfo.did = newDid;
            return true;
        }
        return false;
    }
    
    isModified(): boolean {
        for (let attachment of this.attachments) {
            if (attachment.justAdded || attachment.justRemoved) {
                return true;
            }
        }
        return false;
    }
    
    
    
    
    
    /********************************************************
    ******************** Section-related ********************
    ********************************************************/
    commit(destinationSection: mail.section.SectionService, task: Task, handles: privfs.fs.descriptor.Handle[]): Q.Promise<void> {
        let destinationSectionId = destinationSection.getId();
        let openableSectionFilesToBind: mail.section.OpenableSectionFile[] = [];
        let openableSectionFilesToUnbind: mail.section.OpenableSectionFile[] = [];
        let suppressAttachmentAddedHistory: string[] = [];
        let suppressAttachmentRemovedHistory: string[] = [];
        return Q().then(() => {
            // Get all attachments that require moving to destinationSection
            let openableSectionFilesToMovePromises: Q.Promise<mail.section.OpenableSectionFile>[] = [];
            for (let attachment of this.attachments) {
                if (attachment.currentSectionId != destinationSectionId) {
                    let section = this.session.sectionManager.getSection(attachment.currentSectionId);
                    openableSectionFilesToMovePromises.push(this.getOpenableSectionFileFromDid(attachment.attachmentInfo.did, section));
                }
            }
            return Q.all(openableSectionFilesToMovePromises);
        })
        .then(openableSectionFilesToMove => {
            // Move attachments to destinationSection
            let uploadPromises: Q.Promise<{ oldDid: string, osf: mail.section.OpenableSectionFile }>[] = [];
            for (let openableSectionFile of openableSectionFilesToMove) {
                let oldDid = openableSectionFile.handle.ref.did;
                uploadPromises.push(
                    this.session.sectionManager.uploadFile({
                        data: openableSectionFile.content,
                        destination: destinationSectionId,
                        path: "/",
                        noMessage: true,
                        copyFrom: openableSectionFile.id,
                        conflictBehavior: {
                            overwriteFile: true,
                        },
                    })
                    .then(result => {
                        return { oldDid: oldDid, osf: <mail.section.OpenableSectionFile>result.fileResult.openableElement };
                    })
                );
            }
            return Q.all(uploadPromises);
        })
        .then(movedOpenableSectionFiles => {
            // Update files in this.attachments
            for (let movedFile of movedOpenableSectionFiles) {
                suppressAttachmentRemovedHistory.push(movedFile.oldDid);
                suppressAttachmentAddedHistory.push(movedFile.osf.handle.ref.did);
                this.update(movedFile.oldDid, movedFile.osf.handle.ref.did);
                openableSectionFilesToBind.push(movedFile.osf);
            }
        })
        .then(() => {
            // Get files to bind and unbind
            let openableSectionFilesToBindPromises: Q.Promise<mail.section.OpenableSectionFile>[] = [];
            let openableSectionFilesToUnbindPromises: Q.Promise<mail.section.OpenableSectionFile>[] = [];
            for (let attachment of this.attachments) {
                if (attachment.justAdded) {
                    if (openableSectionFilesToBind.filter(x => x.handle.ref.did == attachment.attachmentInfo.did).length == 0) {
                        openableSectionFilesToBindPromises.push(this.getOpenableSectionFileFromDid(attachment.attachmentInfo.did, destinationSection));
                    }
                }
                else if (attachment.justRemoved) {
                    if (openableSectionFilesToUnbind.filter(x => x.handle.ref.did == attachment.attachmentInfo.did).length == 0) {
                        openableSectionFilesToUnbindPromises.push(this.getOpenableSectionFileFromDid(attachment.attachmentInfo.did, destinationSection));
                    }
                }
            }
            return Q.all([Q.all(openableSectionFilesToBindPromises), Q.all(openableSectionFilesToUnbindPromises)]);
        })
        .then(data => {
            // Add files to bind and unbind
            for (let openableSectionFile of data[0]) {
                if (openableSectionFilesToBind.filter(x => x.handle.ref.did == openableSectionFile.handle.ref.did).length == 0) {
                    openableSectionFilesToBind.push(openableSectionFile);
                }
            }
            for (let openableSectionFile of data[1]) {
                if (openableSectionFilesToUnbind.filter(x => x.handle.ref.did == openableSectionFile.handle.ref.did).length == 0) {
                    openableSectionFilesToUnbind.push(openableSectionFile);
                }
            }
        })
        .then(() => {
            // Bind/unbind files to/from taskId and
            let operationPromises: Q.Promise<void>[] = [];
            for (let openableSectionFile of openableSectionFilesToBind) {
                if (!openableSectionFile) {
                    continue;
                }
                let handle = this.resolveFileHandle(openableSectionFile, handles);
                operationPromises.push(this.bindFileToTask(openableSectionFile, task.getId(), handle));
            }
            for (let openableSectionFile of openableSectionFilesToUnbind) {
                if (!openableSectionFile) {
                    continue;
                }
                let handle = this.resolveFileHandle(openableSectionFile, handles);
                operationPromises.push(this.unbindFileFromTask(openableSectionFile, task.getId(), handle));
            }
            return Q.all(operationPromises);
        })
        .then(() => {
            // Set task attachments and add history
            let attachments = this.getAttachmentInfoStrings();
            let prevAttachments = task.getAttachments().slice();
            let newAttachments = attachments.slice();
            this.historyManager.addFromAttachmentArrays(task, prevAttachments, newAttachments, suppressAttachmentAddedHistory, suppressAttachmentRemovedHistory)
            task.setAttachments(attachments);
            for (let openableSectionFile of openableSectionFilesToBind) {
                if (openableSectionFile) {
                    this.tasksPlugin.triggerFileAttached(this.session, openableSectionFile.handle.ref.did, task.getId());
                }
            }
            for (let openableSectionFile of openableSectionFilesToUnbind) {
                if (openableSectionFile) {
                    this.tasksPlugin.triggerFileDetached(this.session, openableSectionFile.handle.ref.did, task.getId());
                }
            }
        })
        .then(() => {
            // Finalize list operations
            for (let i = this.attachments.length - 1; i >= 0; --i) {
                let attachment = this.attachments[i];
                if (attachment.justRemoved) {
                    this.attachments.splice(i, 1);
                    continue;
                }
                attachment.justAdded = false;
            }
        });
    }
    
    getOpenableSectionFile(fileId: string): Q.Promise<mail.section.OpenableSectionFile> {
        return this.session.sectionManager.getFileOpenableElement(fileId, false, true);
    }
    
    getOpenableSectionFileFromDid(did: string, section: mail.section.SectionService): Q.Promise<mail.section.OpenableSectionFile> {
        return Q().then(() => {
            return section.getFileTree();
        })
        .then(tree => {
            let entry = tree.collection.find(x => x.ref.did == did);
            if (!entry) {
                return tree.refreshDeep(false).then(() => {
                    entry = tree.collection.find(x => x.ref.did == did);
                    return entry ? tree : null;
                });
            }
            return tree;
        })
        .then(tree => {
            if (!tree) {
                return null;
            }
            return tree.getPathFromDescriptor(did);
        })
        .then(path => {
            if (!path) {
                return null;
            }
            return section.getFileOpenableElement(path, false);
        });
    }
    
    
    
    
    
    /********************************************************
    ***************** Binding files to tasks ****************
    ********************************************************/
    bindFileToTask(openableSectionFile: mail.section.OpenableSectionFile, taskId: string, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return this.tasksPlugin.addMetaBindedTaskIdOSF(openableSectionFile, taskId, handle).fail(e => {
            console.log("bindFileToTask:", e);
        });
    }
    
    unbindFileFromTask(openableSectionFile: mail.section.OpenableSectionFile, taskId: string, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return this.tasksPlugin.removeMetaBindedTaskIdOSF(openableSectionFile, taskId, handle).fail(e => {
            console.log("unbindFileFromTask:", e);
        });
    }
    
    resolveFileHandle(openableSectionFile: mail.section.OpenableSectionFile, handles: privfs.fs.descriptor.Handle[]): privfs.fs.descriptor.Handle {
        let handle = openableSectionFile.handle;
        if (handles && handle && handle.descriptor && handle.descriptor.ref) {
            let did = handle.descriptor.ref.did;
            let handle2 = handles.filter(x => x && x.ref && x.ref.did == did)[0];
            if (handle2) {
                handle = handle2;
            }
        }
        return handle;
    }
    
    
    
    
    
    /********************************************************
    ******************** Attachment info ********************
    ********************************************************/
    static createAttachmentInfo(did: string, fileName: string): AttachmentInfo {
        let attachmentInfo = {
            did: did,
            name: fileName,
            trashed: false,
        };
        return attachmentInfo;
    }
    
    static createAttachmentInfoString(did: string, fileName: string): string {
        return JSON.stringify(this.createAttachmentInfo(did, fileName));
    }
    
    static createAttachmentInfoFromOpenableSectionFile(openableSectionFile: mail.section.OpenableSectionFile): AttachmentInfo {
        return this.createAttachmentInfo(openableSectionFile.handle.descriptor.ref.did, openableSectionFile.getName());
    }
    
    static createAttachmentInfoStringFromOpenableSectionFile(openableSectionFile: mail.section.OpenableSectionFile): string {
        return this.createAttachmentInfoString(openableSectionFile.handle.descriptor.ref.did, openableSectionFile.getName());
    }
    
    createAttachmentInfoFromFileId(fileId: string): Q.Promise<AttachmentInfo> {
        return this.getOpenableSectionFile(fileId).then(osf => {
            return AttachmentsManager.createAttachmentInfoFromOpenableSectionFile(osf);
        });
    }
    
    createAttachmentInfoStringFromFileId(fileId: string): Q.Promise<string> {
        return this.getOpenableSectionFile(fileId).then(osf => {
            return AttachmentsManager.createAttachmentInfoStringFromOpenableSectionFile(osf);
        });
    }
    
    getAttachmentInfoStrings(): string[] {
        return this.attachments.map(attachment => {
            if (attachment.justRemoved) {
                return null;
            }
            return JSON.stringify(attachment.attachmentInfo);
        }).filter(str => str != null);
    }
    
}
