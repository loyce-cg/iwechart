import {EditorWindowController, Options} from "../editor/EditorWindowController";
import {app} from "../../Types";
import { LocaleService, section } from "../../mail";
import { i18n } from "./i18n";
import { ButtonsState } from "../../component/editorbuttons/main";
import { Session } from "../../mail/session/SessionManager"; 
import { ThumbsController, MissingThumbAction } from "../../component/thumbs/ThumbsController";
import Q = require("q");

export class ImageWindowController extends EditorWindowController {
    
    static textsPrefix: string = "window.image.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    thumbs: ThumbsController;
    size: {width: number, height: number};
    
    constructor(parent: app.WindowParent, public session: Session, options: Options) {
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = 600;
        this.thumbs = this.addComponent("thumbs", this.componentFactory.createComponent("thumbs", [this, this.app, {
            missingThumbAction: MissingThumbAction.DO_NOTHING,
        }]));
        this.thumbs.setSession(session);
    }
    
    release() {
        this.size = null;
        super.release();
    }
    
    onViewDetectImageSize(currentViewId: number, width: number, height: number): void {
        if (this.currentViewId != currentViewId) {
            return;
        }
        this.size = {
            width: width,
            height: height
        };
        this.refreshTitle();
    }
    
    refreshTitle(): void {
        let title = super.getTitle();
        this.setTitle(this.size ? title + " (" + this.size.width + "x" + this.size.height + ")" : title);
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.print = true;
        return state;
    }
    
    prepareToPrint(): Q.Promise<void> {
        return super.prepareToPrint().then(() => {
            return this.retrieveFromView("beforeImagePrint");
        });
    }
    
    loadDataStart(): Q.Promise<void> {
        return Q().then(() => {
            if (this.openableElement instanceof section.OpenableSectionFile) {
                let did = this.openableElement.handle.ref.did;
                this.callViewMethod("setThumb", did, this.openableElement.section.getId(), this.currentViewId);
            }
        });
    }
    
}
