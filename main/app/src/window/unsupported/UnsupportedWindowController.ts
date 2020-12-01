import {EditorWindowController, Options} from "../editor/EditorWindowController";
import {app} from "../../Types";
import {ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import { OpenableElement } from "../../app/common/shell/ShellTypes";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export class Model {
    name: string;
    mimeType: string;
    size: number;
    showOpenButton: boolean;
    previewMode: boolean;
    systemLabel?: string;
    localFile: boolean;
}

export class UnsupportedWindowController extends EditorWindowController {
    
    static textsPrefix: string = "window.unsupported.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: app.WindowParent, public session: Session, options: Options) {
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.edit = false;
        if (this.app.isElectronApp() && this.openableElement) {
            state.unlock = (<any>this.app).externalFilesService.isElementRegisteredAndLocked(this.openableElement.getElementId());
        }
        return state;
    }
    
    onViewLoad(): void {
        let currentViewId = this.currentViewId;
        let model: Model = {
            name: this.name,
            mimeType: this.openableElement ? this.openableElement.getMimeType() : "",
            size: this.openableElement ? this.openableElement.getSize() : 0,
            showOpenButton: this.app.isElectronApp(),
            previewMode: this.previewMode,
            systemLabel: this.app.isElectronApp() ? (<any>this.app).getSystemLabel() : undefined,
            localFile: this.openableElement ? this.openableElement.isLocalFile() : false
        };
        if (this.app.isElectronApp() && this.openableElement) {
            (<any>this.app).externalFilesService.registerPreview(this.openableElement.getElementId(), (isLockSet: boolean) => {
                this.callViewMethod("setLockState", isLockSet);
                this.editorButtons.refreshButtonsState();
            })
        }

        this.callViewMethod("setData", currentViewId, model, this.getButtonsState());
        if (this.app.isElectronApp() && this.openableElement) {
            if((<any>this.app).externalFilesService.isElementRegisteredAndLocked(this.openableElement.getElementId())) {
                this.callViewMethod("setLockState", true);
            }
        }

    }
    
    onViewExport() {
        this.editorButtons.onViewExport();
    }
    
    onViewOpenExternal(): void {
        this.editorButtons.onViewOpenExternal();
    }
    
    reopen(openableElement: OpenableElement) {
        this.currentViewId++;
        this.openableElement = openableElement;
        if (this.app.isElectronApp()) {
            (<any>this.app).externalFilesService.registerPreview(openableElement.getElementId(), (isLockSet: boolean) => {
                this.callViewMethod("setLockState", isLockSet);
                this.editorButtons.refreshButtonsState();
            })
        }
        this.setWindowIcon(this.openableElement);
        this.refreshName();
        this.callViewMethod("reopen", this.currentViewId);
    }
    
    release() {
        if (this.app.isElectronApp() && this.openableElement) {
            (<any>this.app).externalFilesService.unregisterPreview(this.openableElement.getElementId());
        }
        
        this.currentViewId++;
        this.openableElement = null;
        this.refreshName();
        this.callViewMethod("release", this.currentViewId);
    }
    
    onViewReleaseLock(): void {
        if (this.app.isElectronApp() && this.openableElement) {
            (<any>this.app).externalFilesService.unregisterFile(this.openableElement.getElementId());
        }
    }
}
