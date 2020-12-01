import {EditorWindowController, Options} from "../editor/EditorWindowController";
import * as Q from "q";
import {app} from "../../Types";
import {ButtonsState} from "../../component/editorbuttons/EditorButtonsController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export class PdfWindowController extends EditorWindowController {
    
    static textsPrefix: string = "window.pdf.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    prepareToPrintDeferred: Q.Deferred<void>;
    viewLoadedDeferred: Q.Deferred<void>;
    
    constructor(parent: app.WindowParent, public session: Session, options: Options) {
        super(parent, session, __filename, __dirname, options);
        this.ipcMode = true;
        this.addViewScript({path: "build/pdf/pdfjs-dist/build/pdf.js"});
        this.addViewScript({path: "build/pdf/pdfjs-dist/build/pdf.worker.js"});
        this.viewLoadedDeferred = Q.defer();
        this.openWindowOptions = {
            modal: false,
            maximized: false,
            showInactive: false,
            toolbar: false,
            maximizable: true,
            minimizable: true,
            show: false,
            hidden: this.printMode,
            position: "center-always",
            minWidth: 800,
            minHeight: 600,
            width: 800,
            height: 600,
            resizable: true,
            title: super.getTitle(),
            preTitleIcon: super.getPreTitleIcon(),
            icon: this.app.shellRegistry.resolveIcon(this.openableElement.getMimeType()),
            backgroundColor: "#fff"
        };
        if (this.printMode) {
            this.openWindowOptions.widget = false;
        }
    }
    
    getButtonsState(): ButtonsState {
        let state = super.getButtonsState();
        state.edit = false;
        state.print = true;
        return state;
    }
    
    onViewLoad() {
        this.loadData().then(() => {
            this.viewLoadedDeferred.resolve();
        });
    }
    
    prepareToPrint(): Q.Promise<void> {
        if (this.prepareToPrintDeferred == null) {
            this.prepareToPrintDeferred = Q.defer();
            this.viewLoadedDeferred.promise.then(() => {
                return super.prepareToPrint();
            })
            .then(() => {
                this.callViewMethod("prepareToPrint");
            });
        }
        return this.prepareToPrintDeferred.promise;
    }
    
    onViewPreparedToPrint(): void {
        if (this.prepareToPrintDeferred) {
            this.prepareToPrintDeferred.resolve();
        }
    }
}
