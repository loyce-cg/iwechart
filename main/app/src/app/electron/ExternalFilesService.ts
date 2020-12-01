import { ElectronApplication } from "./ElectronApplication";
import * as privfs from "privfs-client";
import * as Q from "q";
import * as path from "path";
import {MsgBoxResult} from "../../window/msgbox/MsgBoxWindowController";
import { OpenableFile, OpenableElement } from "../common/shell/ShellTypes";

import { CommonApplication } from "../common";
import * as Types from "../../Types";
import { SectionService } from "../../mail/section/SectionService";
import { SectionManager } from "../../mail/section/SectionManager";
import * as fs from "fs";
import { Session } from "../../mail/session/SessionManager";
import { resolve } from "url";
import { Formatter } from "../../utils/Formatter";
import * as RootLogger from "simplito-logger";
import { FilesLockingService } from "../common/fileslockingservice/FilesLockingService";
let Logger = RootLogger.get("privfs-mail-client.app.ExternalFilesService");

export interface RegisteredExternalFile {
    hostHash: string;
    openableElement: OpenableElement;
    hddPath: string;
    handle: privfs.fs.descriptor.Handle;
    watcherTimer: NodeJS.Timer;
}


export type LockStateUpdater = (isEnabled: boolean) => void;

export interface RegisteredPreviewsStateUpdaters {
    hostHash: string;
    elementId: string;
    setLockEnabled: LockStateUpdater;
}

export class ExternalFilesService  {
    static instance: ExternalFilesService;
    
    registeredFiles: {[elementId: string]: RegisteredExternalFile} = {};
    registeredPreviews: {[elementId: string]: RegisteredPreviewsStateUpdaters} = {};
    
    static create(app: ElectronApplication, identity: privfs.identity.Identity, filesLockingService: FilesLockingService): ExternalFilesService {
            return ExternalFilesService.getInstance(app, identity, filesLockingService);
    }
    static getInstance(app: ElectronApplication, identity: privfs.identity.Identity, filesLockingService: FilesLockingService): ExternalFilesService {
        if (!ExternalFilesService.instance) {
            ExternalFilesService.instance = new ExternalFilesService(app, identity, filesLockingService);
        }
        return ExternalFilesService.instance;
    }
        
    constructor(public app: ElectronApplication, public identity: privfs.identity.Identity, public filesLockingService: FilesLockingService) {}
    
    getMapId(session: Session, elementId: string): string {
        return session.hostHash + "-" + elementId;
    }

    registerFile(session: Session, openableElement: OpenableElement, hddPath: string, handle: privfs.fs.descriptor.Handle, watcherTimer: NodeJS.Timer):Q.Promise<void> {
        let elementId = openableElement.getElementId();
        Logger.debug("registering file...", elementId);
        return Q().then(() => {
            let mapId = this.getMapId(session, elementId);
            if (mapId in this.registeredFiles) {
                this.registeredFiles[mapId].handle = handle;
                return;
            }

            this.registeredFiles[mapId] = {hostHash: session.hostHash, openableElement, hddPath, handle, watcherTimer};
            
            // syncing with preview
            if (mapId in this.registeredPreviews) {
                this.registeredPreviews[mapId].setLockEnabled(true);
            }
        });
    }

    unregisterFile(session: Session, elementId: string, silent?: boolean): Q.Promise<void> {
        return Q().then(() => {
            let mapId = this.getMapId(session, elementId);
            // console.log("trying to unregister file:",elementId);
            if ( !(mapId in this.registeredFiles) ) {
                // console.log("file not registered....");
                if (silent) {
                    return;
                }
                return Q.reject<void>("no file registered with given elementId: " + elementId);
            }
            else {
                if (this.registeredFiles[mapId].watcherTimer) {
                    clearTimeout(this.registeredFiles[mapId].watcherTimer);
                }

                this.registeredFiles[mapId] = null;
                this.reduceFilesMap();
                // syncing with preview
                // console.log("syncing with preview");
                if (mapId in this.registeredPreviews) {
                    this.registeredPreviews[mapId].setLockEnabled(false);
                }
                else {
                    // console.log("not registered in previews...");
                }

            }
        })
    }
    
    unregisterAllFiles(): Q.Promise<void> {
        return Q().then(() => {
            let unregisterActions:Q.Promise<void>[] = [];
            for (let element in this.registeredFiles) {
                let session = this.app.sessionManager.getSessionByHostHash(this.registeredFiles[element].hostHash);
                let fileElementId = this.registeredFiles[element].openableElement.getElementId();
                let action = Q().then(() => this.unregisterFile(session, fileElementId));
                unregisterActions.push(action);
            }
            return Q.all(unregisterActions);
        })
        .then(() => {
            return;
        })
    }
    
    unregisterAllPreviews(): void {
        this.registeredPreviews = {};
    }
    
    cleanup(): void {
        this.unregisterAllFiles();
        this.unregisterAllPreviews();
    }
    
    getData(): string {
        // dummy func
        return ""
    }
    
    registerPreview(session: Session, elementId: string, lockUpdater: LockStateUpdater) {
        let mapId = this.getMapId(session, elementId);
        if (mapId in this.registeredPreviews) {
            return;
        }
        Logger.debug("registering preview", elementId);
        this.registeredPreviews[mapId] = {hostHash: session.hostHash, elementId: elementId, setLockEnabled: lockUpdater};
    }
    
    unregisterPreview(session: Session, elementId: string): void {
        let mapId = this.getMapId(session, elementId);
        if (!(mapId in this.registeredPreviews)) {
            return;
        }
        this.registeredPreviews[mapId] = null;
        this.reducePreviewsMap();
    }
    
    reduceFilesMap() {
        let newMap: {[elementId: string]: RegisteredExternalFile} = {};
        for (let mapId in this.registeredFiles) {
            if (this.registeredFiles[mapId]) {
                newMap[mapId] = this.registeredFiles[mapId];
            }
        }
        this.registeredFiles = newMap;
    }
    
    reducePreviewsMap() {
        let newMap: {[elementId: string]: RegisteredPreviewsStateUpdaters} = {};
        for (let mapId in this.registeredPreviews) {
            if (this.registeredPreviews[mapId]) {
                newMap[mapId] = this.registeredPreviews[mapId];
            }
        }
        this.registeredPreviews = newMap;
    }

    lockOrReject(session: Session, openableFile: OpenableFile): Q.Promise<privfs.fs.descriptor.Handle> {
        return Q().then(() => {
            // unlock old file if any locked
            return this.unregisterFile(session, openableFile.getElementId(), true);
        })
        .then(() => {
            return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE)
            .then(h => {
                Logger.debug("trying to set lock...");
                return h.lock().thenResolve(h);
            })
            .fail(e => {
                Logger.debug("lock failed");
                if (!privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.data.error.data.lockerPub58 != this.identity.pub58) {
                    let pub58 = e.data.error.data.lockerPub58;
                    let contact = this.app.contactService.getContactByPub58(pub58);
                    let msg;
                    if (contact) {
                        msg = this.app.localeService.i18n("core.error.anotherUserLock.known", [contact.getDisplayName()]);
                    }
                    else {
                        msg = this.app.localeService.i18n("core.error.anotherUserLock.unknown", [pub58]);
                    }
                    this.app.msgBox.alert(msg);
                    return Q.reject<MsgBoxResult>(e).thenResolve(null);
                }
                else {
                    Logger.debug("lock set by me. re locking...");
                    return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE)
                    .then(h => {
                        return h.lock(true).thenResolve(h);
                    })
                    .fail(ex => {
                        Logger.debug("locking failed",ex);
                        return;
                    })
                }
            })
        })
    }

    openFileWithNoLock(session: Session, openableFile: OpenableFile): Q.Promise<privfs.fs.descriptor.Handle> {
        return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE);
    }

    saveAndOpenFile(session: Session, content: privfs.lazyBuffer.IContent): Q.Promise<void> {
        let openableFile: OpenableFile;
        let filePath: string;
        let handle: privfs.fs.descriptor.Handle;

        return Q().then(() => {
            openableFile = <OpenableFile>content;
            if (openableFile.isLocalFile()) {
                return null;
            }
            // return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE, true)
            // return this.tryLock(session, openableFile)
            return this.openFileWithNoLock(session, openableFile)
            .then(handleOrNull => {
                handle = handleOrNull;
                let tmpDir = path.resolve(this.app.profile.tmpAbsolutePath, privfs.crypto.service.randomBytes(10).toString("hex"));
                fs.mkdirSync(tmpDir);
                let i = 0;
                let fileName = content.getName();
                let ext = path.extname(fileName);
                let name = path.basename(fileName, ext);
                filePath = path.resolve(tmpDir, fileName);
                while (fs.existsSync(filePath)) {
                    filePath = path.resolve(tmpDir, name + "-" + (++i) + ext);
                }
                return this.app.saveToHdd(content, filePath);
            })
            .then(() => {
                fs.chmodSync(filePath, handle ? 0o644 : 0o440);
    
                let openableElement = content instanceof OpenableElement ? content : null;
                if (openableElement && openableElement.isEditable() && !openableElement.isLocalFile() && handle != null) {
                    this.startSyncing(session, openableElement, filePath, handle);
                }
                this.app.electronShellOpen(filePath);
            });
    
        })
    }
    // setLockingTimer(elementId: string): NodeJS.Timer {
    //     let lockingTimer = setInterval(() => {
    //         Q().then(() => {
    //             return this.reLockOrReject(elementId)
    //         })
    //     }, 60 * 1000);
    //     return lockingTimer;
    // }

    
    // reLockOrReject(elementId: string): Q.Promise<any> {
    //     // console.log("on relockOrReject");
    //     return Q().then(() => {
    //         if (!(elementId in this.registeredFiles)) {
    //             return;
    //         }

    //         let handle = this.registeredFiles[elementId].handle;
    //         // console.log("trying to refresh lock..", elementId);
    //         return handle.lock(false, false)    
    //     })

    // }

    createConflictedFileName(openableFile: OpenableFile): string {
        try {
            // console.log("orig path:", openableFile.path);
            let parentPath = openableFile.path.split("/").slice(0, -1).join("/");
            // console.log("parent path: ", parentPath);
            let fileName = openableFile.getName();
            // console.log("filename:", fileName);
            let fileParts = fileName.split(".");
            let ext: string = "";
            if (fileParts.length > 1) {
                ext = fileParts[fileParts.length - 1];
                fileName = fileParts.slice(0, -1).join(".");
            }
            // console.log("fileParts: ", fileParts);
            // console.log("ext: ", ext);
            
            let formatter = new Formatter();
            let conflictedCopyStr = this.app.localeService.i18n("externalFilesService.conflictedCopy");
            let dateString = formatter.standardDate(new Date()).replace(/:/g, "-").replace(/ /g, "-");
            return parentPath + "/" + fileName + " - " + conflictedCopyStr + " - " + dateString + (ext.length > 0 ? "." + ext : "");
        } catch (e) {
            console.log("error creating filename",e);
        }
    }

    saveFileAsConflicted(session: Session, elementId: string): Q.Promise<void> {
        let registeredFile: RegisteredExternalFile;
        let mapId = this.getMapId(session, elementId);
        if (mapId in this.registeredFiles) {
            registeredFile = this.registeredFiles[mapId];
        }
        return Q().then(() => {
            if (! registeredFile.openableElement) {
                return;
            }
            // console.log("sessionManager ready.. creating lazyBuffer of registeredFile..", registeredFile.hddPath);
            let lazyBuffer = new privfs.lazyBuffer.NodeFileLazyContent(registeredFile.hddPath, registeredFile.openableElement.getMimeType());
            
            let openableFile = (registeredFile.openableElement as OpenableFile);
            let fname = this.createConflictedFileName(openableFile)

            // console.log("created conflicted name: ", fname);
            return openableFile.fileSystem.resolvePath(fname)
            .then(resolvedPath => {
                return openableFile.fileSystem.save(resolvedPath.path, lazyBuffer);
            })
            .then(result => {
                this.filesLockingService.showWarning(fname);
                this.startSyncing(session, openableFile, registeredFile.hddPath, result.handle);
                return this.unregisterFile(session, registeredFile.openableElement.getElementId());
            })
   
        })
        .fail(e => {
            return Q.reject(e);
        })
    }


    saveFileAsRecovery(session: Session, elementId: string): Q.Promise<void> {
        // console.log("on saveFileAsRecovery");
        let registeredFile: RegisteredExternalFile;
        let mapId = this.getMapId(session, elementId);
        if (mapId in this.registeredFiles) {
            registeredFile = this.registeredFiles[mapId];
        }
        return Q().then(() => {
            if (! registeredFile.openableElement) {
                return;
            }

            // console.log("sessionManager ready.. creating lazyBuffer of registeredFile..", registeredFile.hddPath);
            let lazyBuffer = new privfs.lazyBuffer.NodeFileLazyContent(registeredFile.hddPath, registeredFile.openableElement.getMimeType());
            return this.uploadToMy(session.sectionManager, lazyBuffer);
        })
        .then(result => {
            let openableFile = result.openableElement as OpenableFile;

            return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE)
            .then(h => {
                // console.log("updating handle on recovery..")
                Logger.debug("updating handle on recovery..");
                return h.lock().thenResolve(h);
            })
            .then(handle => {
                // update registered file data\
                // console.log("registering new created file", result.openableElement.getElementId());                
                this.startSyncing(session, result.openableElement, registeredFile.hddPath, handle);

                // unregister old file
                // console.log("unregister old file", registeredFile.openableElement.getElementId());
                return this.unregisterFile(session, registeredFile.openableElement.getElementId());

            })
        })
        .fail(e => {
            return Q.reject(e);
        })
    }

    uploadToMy(sectionManager: SectionManager, content: privfs.lazyBuffer.IContent): Q.Promise<Types.section.UploadFileResultEx> {
        return Q().then(() => {
            let privateSection = sectionManager.getMyPrivateSection();
            if (privateSection) {
                return sectionManager.uploadFile({
                    data: content,
                    destination: "my",
                    path: "/"
                })    
            }
            else {
                return Q.reject<any>("Did not find private section");
            }
        })
    }


    // if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED")) {
    //     return this.saveFileAsRecovery(text);
    // }
    // else
    // if (privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
    //     return this.saveFileAsRecovery(text);
    // }







    
    lockedByMeInOtherSession(e: any, handle: privfs.fs.descriptor.Handle): Q.Promise<void> {
        return Q().then(() => {
            if (!privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.data.error.data.lockerPub58 != this.identity.pub58) {
                return Q.reject<MsgBoxResult>(e);
            }
            let msg = this.app.localeService.i18n("plugin.editor.window.editor.error.anotherSessionLock");
            return this.app.msgBox.confirm(msg);
        })
        .then(result => {
            if (result.result != "yes") {
                throw new Error("locked-in-another-session-by-me");
            }
            if (handle) {
                return handle.lock(true);
            }
        });
    }

    isElementRegisteredAndLocked(session: Session, elementId: string): boolean {
        let mapId = this.getMapId(session, elementId);
        if (!(mapId in this.registeredFiles)) {
            return false;
        }
        else {
            return this.registeredFiles[mapId].handle.lockObj != null;
        }
    }


    startSyncing(session: Session, openableElement: OpenableElement, filePath: string, handle: privfs.fs.descriptor.Handle): void {
            let syncTimer: NodeJS.Timer;
            let entry = {
                mtime: fs.statSync(filePath).mtime,
                syncing: false,
                intervalId: syncTimer = setInterval(() => {
                    if (!fs.existsSync(filePath)) {
                        // clearTimeout(syncTimer);
                        this.unregisterFile(session, openableElement.getElementId());
                        return;
                    }
                    let newStat = fs.statSync(filePath);
                    if (!entry.syncing && entry.mtime.getTime() < newStat.mtime.getTime()) {
                        entry.syncing = true;
                        Q().then(() => {
                            let lazyBuffer = new privfs.lazyBuffer.NodeFileLazyContent(filePath, openableElement.getMimeType());
                            if (openableElement.isLocalFile()) {
                                return openableElement.save(lazyBuffer).thenResolve(null)
                            }
                            else {
                                return handle.write(lazyBuffer)
                                .fail(e => {
                                    console.log("trying to write file ended with error", e);
                                    // console.log("writing in original location failed...", e);
                                    if (privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || privfs.core.ApiErrorCodes.is(e, "OLD_SIGNATURE_DOESNT_MATCH")) {
                                        return this.saveFileAsConflicted(session, openableElement.getElementId())
                                        .fail(ex => {
                                            // console.log("could not write recovery file..");
                                            Logger.error("Could not write recovery file...")
                                        })
                                    }
                                })
                            }
                        })
                        .then(() => {
                            entry.mtime = newStat.mtime;
                        })
                        .fail(e => {
                            Logger.error("Error during syncing " + filePath, e);
                        })
                        .fin(() => {
                            entry.syncing = false;
                        });
                    }
                }, 5000)
            }
            if (! openableElement.isLocalFile()) {
                this.registerFile(session, openableElement, filePath, handle, entry.intervalId);
                // this.externalOpenedFilesSyncIntervals.push(entry);
            }
    }


}