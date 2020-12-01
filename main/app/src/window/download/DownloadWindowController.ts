import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {app} from "../../Types";
import {ElectronApplication} from "../../app/electron/ElectronApplication";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { Session } from "../../mail/session/SessionManager";

export interface Model {
    name: string;
    mimeType: string;
    size: number;
    osLabel?: string;
}

export class DownloadWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.download.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    content: privfs.lazyBuffer.IContent;
    
    constructor(parent: app.WindowParent, content: privfs.lazyBuffer.IContent, public session: Session) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.content = content;
        this.openWindowOptions = {
            width: 500,
            height: 185,
            resizable: false,
            position: "center",
            // modal: true,
            title: this.i18n("window.download.title", [this.content.getName()]),
            icon: this.app.shellRegistry.resolveIcon(this.content.getMimeType())
        };
    }
    
    getModel(): Model {
        return {
            name: this.content.getName(),
            mimeType: this.content.getMimeType(),
            size: this.content.getSize(),
            osLabel: this.app.isElectronApp() ? (<any>this.app).getSystemLabel() : null
        };
    }
    
    init(): Q.IWhenable<void> {
        return super.init();
    }
    
    onViewOpen(): void {
        this.saveContent(true);
    }
    
    onViewSave(): void {
        this.saveContent(false);
    }
    
    saveContent(openAfterSave: boolean): void {
        this.addTask(this.i18n(openAfterSave ? "window.download.task.open.text" : "window.download.task.save.text"), true, () => {
            return Q().then(() => {
                if (this.app.isElectronApp()) {
                    if (openAfterSave) {
                        return (<ElectronApplication>this.app).saveToHddAndOpen(this.session, this.content, this);
                    }
                    return (<ElectronApplication>this.app).saveToHddWithChoose(this.content, this.session, this.getClosestNotDockedController().nwin);
                }
                return this.app.saveContent(this.content, this.session, this);
            })
            .then(() => {
                this.close();
            })
            .fail(e => {
                if (e != "cancelled") {
                    throw e;
                }
            });
        })
        .fail(e => {
            if (e == "no-choose") {
                return;
            }
            this.onError(e);
        });
    }
    
    onViewCancel(): void {
        this.close();
    }
}
