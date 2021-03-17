import {BaseWindowController} from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app, event} from "../../Types";
import {OpenableElement, ShellOpenAction, OpenableFile} from "../../app/common/shell/ShellTypes";
import * as shelltypes from "../../app/common/shell/ShellTypes";
import {NotificationController} from "../../component/notification/NotificationController";
import {Inject, Dependencies} from "../../utils/Decorators"
import {SectionManager} from "../../mail/section/SectionManager";
import {EditorButtonsController, ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import { OpenableSectionFile } from "../../mail/section";
import { Entry } from "../../mail/filetree/NewTree";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";
import { WebUtils } from "../../web-utils";


export interface Options {
    docked?: boolean;
    entry: OpenableElement;
    action?: ShellOpenAction;
}

export interface Model {
    currentViewId: number;
    docked: boolean;
    previewMode: boolean;
    printMode: boolean;
    systemLabel?: boolean;
    localFile: boolean;
}

@Dependencies(["notification", "editorbuttons"])
export class EditorWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.editor.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    // @Inject client: privfs.core.Client;
    // @Inject sectionManager: SectionManager;

    name: string;
    docked: boolean;
    previewMode: boolean;
    printMode: boolean;
    openableElement: OpenableElement;
    currentViewId: number;
    handle: privfs.fs.descriptor.Handle;
    notifications: NotificationController;
    editorButtons: EditorButtonsController;
    loaded: Q.Deferred<void> = Q.defer();
    // session: Session;

    constructor(parent: app.WindowParent, public session: Session, filename: string, dirname: string,  options: Options) {
        super(parent, filename, dirname);
        this.ipcMode = true;
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.editorButtons = this.addComponent("editorbuttons", this.componentFactory.createComponent("editorbuttons", [this]));
        this.editorButtons.setSession(session);
        this.currentViewId = 1;
        this.openableElement = options.entry;
        this.name = this.openableElement.getName();
        this.docked = !!options.docked;
        this.previewMode = options.action == ShellOpenAction.PREVIEW;
        this.printMode = options.action == ShellOpenAction.PRINT;
        if (this.printMode) {
            this.addViewScript({path: "build/pdf/html2pdf.js/dist/html2pdf.bundle.min.js"});
        }
        if (this.docked) {
            this.openWindowOptions.widget = false;
            this.openWindowOptions.decoration = false;
        }
        else {
            this.openWindowOptions = {
                toolbar: false,
                hidden: this.printMode,
                maximized: false,
                show: false,
                position: "center",
                minWidth: 350,
                minHeight: 215,
                width: "66%",
                height: "75%",
                resizable: true,
                title: this.getTitle() || this.name,
                icon: this.app.shellRegistry.resolveIcon(this.openableElement.getMimeType()),
                preTitleIcon: this.getPreTitleIcon()
            };
        }
        let client = this.session.sectionManager.client;
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);

        this.bindEvent<event.FileLockChangedEvent>(this.app, "file-lock-changed", event => {
            if (this.editorButtons) {
                Q.all([
                    this.isFileLocked(),
                    this.canUnlockFile()
                ])
                .then(res => {
                    let [locked, canUnlock] = res;
                    this.editorButtons.updateLockState(locked, canUnlock);
                })
            }
        })
    }
    
    reopen(openableElement: OpenableElement) {
        this.currentViewId++;
        let client = this.session.sectionManager.client;
        this.unregisterPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        this.openableElement = openableElement;
        this.setWindowIcon(this.openableElement);
        this.refreshName();
        this.callViewMethod("reopen", this.currentViewId);
        Q.all([
            this.isFileLocked(),
            this.canUnlockFile()
        ]).then(res => {
            let [locked, canUnlock] = res;
            this.editorButtons.updateLockState(locked, canUnlock);
        })
    }
    
    release() {
        let client = this.session.sectionManager.client;
        this.unregisterPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
        this.openableElement = null;
        this.refreshName();
        this.callViewMethod("release", this.currentViewId);
    }
    
    getModel(): Model {
        return {
            currentViewId: this.currentViewId,
            docked: this.docked,
            previewMode: this.previewMode,
            printMode: this.printMode,
            systemLabel: this.app.isElectronApp() ? (<any>this.app).getSystemLabel() : undefined,
            localFile: this.openableElement ? this.openableElement.isLocalFile() : false,
        };
    }
    
    getButtonsState(): ButtonsState {
        let state = this.editorButtons.getDefaultButtonsState();
        state.close = this.docked && !this.previewMode;
        return state;
    }

    isFileLocked(): Q.Promise<boolean> {
        if (this.openableElement) {
            return this.app.filesLockingService.isLocked(this.session, <OpenableFile>this.openableElement);
        }
    }

    canUnlockFile(): Q.Promise<boolean> {
        if (this.openableElement) {
            return this.app.filesLockingService.canUnlockFile(this.session, this.openableElement);
        }
    }

    lockFile(): Q.Promise<void> {
        return Q().then(() => {
            if (this.openableElement) {
                return this.isFileLocked().then(locked => {
                    if (locked) {
                        return;
                    }
                    return this.app.filesLockingService.manualLockFile(this.session, this.openableElement);
                })
            }
        })
    }

    unlockFile(): Q.Promise<void> {
        if (this.openableElement) {
            return this.app.filesLockingService.manualUnlockFile(this.session, this.openableElement);
        }
    }

    getButtonsStateWithUpdatedLock(): Q.Promise<ButtonsState> {
        return Q().then(() => {
            let state = this.getButtonsState();
            return Q.all([
                this.isFileLocked(),
                this.canUnlockFile()
            ])
            .then(res => {
                let [locked, canUnlock] = res;
                state.lock = !locked;
                state.unlock = locked && canUnlock;
                return state;
            })    
        })
    }
    
    onViewLoad() {        
        this.loadData();
    }
    
    loadData(): Q.Promise<void> {
        let currentViewId = this.currentViewId;
        return this.addTaskEx("", true, () => {
            if (this.openableElement == null) {
                return;
            }
            return Q().then(() => {
                return this.loadDataStart();
            })
            .then(() => {
                return this.openableElement.getBlobData();
            })
            .progress(progress => {
                this.callViewMethod("setProgress", currentViewId, progress);
            })
            .then(data => {
                return this.getButtonsStateWithUpdatedLock()
                .then(buttonsState => {
                    this.callViewMethod("setData", currentViewId, data, buttonsState);
                    this.loaded.resolve();    
                })
            })
            .fail(e => {
                this.getLogger().debug("Load failed", e);
            })
        });
    }
    
    loadDataStart(): Q.Promise<void> {
        return Q();
    }
    
    hasOpenedEntry(entry: OpenableElement): boolean {
        return entry.equals(this.openableElement);
    }
    
    canBeQuietlyClosed(): boolean {
        return true;
    }
    
    refreshName(): void {
        this.name = this.openableElement ? this.openableElement.getName() : "";
        this.refreshTitle();
    }
    
    refreshTitle(): void {
        this.setTitle(this.name);
    }
    
    onViewFocusedIn(): void {
        this.app.dispatchEvent({type: "focused-in-preview"});
    }
    
    onStorageEvent(event: privfs.types.descriptor.DescriptorNewVersionEvent): void {
        if (event.type == "descriptor-new-version" && this.openableElement instanceof shelltypes.OpenableFile && event.descriptor.ref.id == this.openableElement.handle.ref.id) {
            this.onViewLoad();
        }
    }
    
    getTitle(): string {
        if (!this.openableElement) {
            return "";
        }
        if (this.openableElement instanceof OpenableSectionFile) {
            let parsed = Entry.parseId(this.openableElement.id);
            if (parsed) {
                let section = this.session.sectionManager.getSection(parsed.sectionId);
                if (section) {
                    let sectionName = section.getFullSectionName();
                    let path = parsed.path[0] == "/" ? parsed.path.substring(1) : parsed.path;
                    return sectionName + "/" + path;
                }
            }
        }
        else if ((<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            return this.openableElement.getElementId();
        }
        return this.openableElement.getName();
    }
    
    getPreTitleIcon(): app.PreTitleIcon {
        if (!this.openableElement) {
            return null;
        }
        if (this.openableElement instanceof OpenableSectionFile) {
            let parsed = Entry.parseId(this.openableElement.id);
            if (parsed) {
                let section = this.session.sectionManager.getSection(parsed.sectionId);
                if (section) {
                    if (section.isPrivate() && section.getName() == "<my>") {
                        return "private";
                    }
                    else
                    if (section.isPrivateOrUserGroup()) {
                        return "person";
                    }
                    return section.getScope() == "public" ? "section-public" : "section-non-public";
                }
            }
        }
        else if ((<any>this.openableElement).openableElementType == "LocalOpenableElement") {
            return "local";
        }
        return null;
    }
    
    prepareToPrint(): Q.Promise<void> {
        return super.prepareToPrint().then(() => {
            return this.loaded.promise;
        })
        .then(() => {
            return this.retrieveFromView("setPrintHeader", this.name);
        });
    }
    
}
