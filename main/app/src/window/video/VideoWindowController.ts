import {EditorWindowController, Options} from "../editor/EditorWindowController";
import {app} from "../../Types";
import {ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export class VideoWindowController extends EditorWindowController {
    
    static textsPrefix: string = "window.video.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    size: {width: number, height: number};
    
    constructor(parent: app.WindowParent, public session: Session, options: Options) {
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
    }
    
    release() {
        this.size = null;
        super.release();
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.edit = false;
        return state;
    }
    
    onViewDetectVideoSize(currentViewId: number, width: number, height: number): void {
        if (this.currentViewId != currentViewId) {
            return;
        }
        let maxWindowWidth = 800;
        let maxWindowHeight = 600;

        let mainWindow = this.manager.getMainWindow();
        if (mainWindow && mainWindow.controller && mainWindow.controller.nwin) {
            maxWindowHeight = mainWindow.controller.nwin.getHeight();
            maxWindowWidth = mainWindow.controller.nwin.getWidth();
        }
        this.size = {
            width: width,
            height: height
        };

        this.refreshTitle();
        this.nwin.setInnerSize(maxWindowWidth, maxWindowHeight);
    }
    
    refreshTitle(): void {
        this.setTitle(this.size ? this.name + " (" + this.size.width + "x" + this.size.height + ")" : this.name);
    }
    
    stopPlayback(): void {
        this.callViewMethod("stopPlayback");
    }
}
