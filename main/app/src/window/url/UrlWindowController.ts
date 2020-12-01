import {app} from "../../Types";
import {EditorWindowController, Options} from "../editor/EditorWindowController";
import {ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export class UrlWindowController extends EditorWindowController {
    
    static textsPrefix: string = "window.url.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: app.WindowParent,  public session: Session, options: Options) {
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.enabled = false;
        return state;
    }
    
    onViewLoad(): void {
        let currentViewId = this.currentViewId;
        this.addTaskEx(this.i18n("window.url.task.load.text"), true, () => {
            if (this.openableElement == null) {
                return;
            }
            return this.openableElement.getContent()
            .progress(progress => {
                this.callViewMethod("setProgress", currentViewId, progress);
            })
            .then(content => {
                let text = content.buffer.toString("utf8");
                let splitted = text.split("\n");
                this.callViewMethod("setUrlData", currentViewId, this.name, splitted[1].substring(4));
            })
        });
    }
}
