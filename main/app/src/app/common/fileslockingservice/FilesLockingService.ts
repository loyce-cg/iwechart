import { Session } from "../../../mail/session/SessionManager";
import * as Q from "q";
import { OpenableFile, OpenableElement, DescriptorVersionElement } from "../../common/shell/ShellTypes";
import * as RootLogger from "simplito-logger";
import { CommonApplication } from "..";
import * as privfs from "privfs-client";
let Logger = RootLogger.get("privfs-mail-client.FilesLockingService");

export class FilesLockingService {
    constructor(public app: CommonApplication, public identity: privfs.identity.Identity) {}

    manualLockFile(session: Session, openableElement: OpenableElement): void {
        this.tryLock(session, openableElement as OpenableFile);
    }
    
    manualUnlockFile(session: Session, openableElement: OpenableElement): Q.Promise<void> {
        let openableFile = openableElement as OpenableFile;
        return Q().then(() => {
            return Q.all([
                openableFile.fileSystem.getLockedInfo(openableFile.path),
                session.mailClientApi.privmxRegistry.getIdentityProvider()
            ])
            .then(res => {
                let [info, identityProvider] = res;
                if (identityProvider.isAdmin() && info && info.user != identityProvider.getIdentity().user) {
                    return this.showConfirm()
                }
                else
                if (identityProvider.getIdentity().user == info.user) {
                    return true;
                }
                return false;
            })
        })
        .then(result => {
            return result ? openableFile.fileSystem.forcedLockRelease(openableFile.path) : Q.resolve<void>();
        })      
    }

    canUnlockFile(session: Session, openableElement: OpenableElement): Q.Promise<boolean> {
        if (openableElement instanceof DescriptorVersionElement) {
            return Q(false);
        }
        if (openableElement.isLocalFile()) {
            return Q(false);
        }
        let openableFile = openableElement as OpenableFile;
        return Q().then(() => {
            return Q.all([
                openableFile.fileSystem.getLockedInfo(openableFile.path),
                session.mailClientApi.privmxRegistry.getIdentityProvider()
            ])
            .then(res => {
                let [info, identityProvider] = res;
                if (!info) {
                    return false;
                }
                if (identityProvider.getIdentity().user == info.user || identityProvider.isAdmin()) {
                    return true;
                }
                return false;
            })
            .then(result => {
                Logger.debug("canUnlockFile returned", result);
                return result;
            })
        })
    }

    isLocked(session: Session, openableFile: OpenableFile| OpenableElement): Q.Promise<boolean> {
        if (openableFile instanceof DescriptorVersionElement) {
            return Q(true);
        } 
        if (openableFile.isLocalFile()) {
            return Q(true);
        } 
        let element = openableFile instanceof OpenableElement ? <OpenableFile>openableFile : openableFile;
        return element.fileSystem.isLocked(element.path)                
    }

    showConfirm(): Q.Promise<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            return this.app.msgBox.confirmEx({
                message: this.app.localeService.i18n("externalFilesService.locks.performUnlock"),
                yes: {
                    faIcon: "unlock",
                    btnClass: "btn-warning",
                    label: this.app.localeService.i18n("externalFilesService.locks.confirmUnlock")
                },
                no: {
                    faIcon: "",
                    btnClass: "btn-default",
                    label: this.app.localeService.i18n("core.button.cancel.label")
                }
            })
            .then(result => {
                defer.resolve(result.result == "yes");
            });
        });
        return defer.promise;
    }

    showWarning(fileName: string): Q.Promise<boolean> {
        let defer = Q.defer<boolean>();
        Q().then(() => {
            this.app.msgBox.getChilWindowParent = () => this.app.manager.getMainWindow().controller;
            return this.app.msgBox.alertEx({
                message: this.app.localeService.i18n("externalFilesService.locks.conflictedSave", fileName),
                alwaysOnTop: true,
                
            })
            .then(result => {
                defer.resolve();
            });
        });
        return defer.promise;
    }

    tryLock(session: Session, openableFile: OpenableFile): Q.Promise<privfs.fs.descriptor.Handle> {
        return Q().then(() => {
            return openableFile.fileSystem.openFile(openableFile.path, privfs.fs.file.Mode.READ_WRITE)
            .then(h => {
                Logger.debug("trying to set lock...");
                return h.lock().thenResolve(h);
            })
            .fail(e => {
                Logger.debug("lock failed");
                // if (!privfs.core.ApiErrorCodes.is(e, "DESCRIPTOR_LOCKED") || e.data.error.data.lockerPub58 != this.identity.pub58) {
                //     return Q.resolve(null);
                // }
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
                    return Q.resolve(null);
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


}