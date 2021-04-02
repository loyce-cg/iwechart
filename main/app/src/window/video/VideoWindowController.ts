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
    protected auotPlay: boolean;
    
    constructor(parent: app.WindowParent, public session: Session, options: Options & { autoPlay?: boolean }) {
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
        this.auotPlay = !!options.autoPlay;
        const initialWindowSize = this.calculateAdaptiveWindowSize();
        this.openWindowOptions.width = initialWindowSize.width;
        this.openWindowOptions.height = initialWindowSize.height;
        this.openWindowOptions.minWidth = 300;
        this.openWindowOptions.minHeight = 200;
        this.openWindowOptions.position = "center";
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
        
        this.size = {
            width: width,
            height: height
        };

        this.refreshTitle();
        
        if (this.nwin) {
            const windowSize = this.calculateAdaptiveWindowSize(width, height, 750, 300, true);
            this.nwin.setInnerSize(windowSize.width + 2, windowSize.height + 52);
            this.nwin.center();
        }
    }
    
    onViewLoad(): void {
        super.onViewLoad();
        this.callViewMethod("setAutoPlay", this.auotPlay);
    }
    
    refreshTitle(): void {
        this.setTitle(this.size ? this.name + " (" + this.size.width + "x" + this.size.height + ")" : this.name);
    }
    
    stopPlayback(): void {
        this.callViewMethod("stopPlayback");
    }
}
