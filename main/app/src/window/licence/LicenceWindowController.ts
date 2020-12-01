import * as Q from "q";
import {app} from "../../Types";
import { BaseWindowController } from "../base/BaseWindowController";
import { OpenableElement } from "../../app/common/shell/ShellTypes";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";


export interface Model {
    currentViewId: number;
    docked: boolean;
    printMode: boolean;
    onStartup: boolean;
    isElectronApp: boolean;
}

export interface Options {
    docked?: boolean;
    entry: OpenableElement;
    onStartup: boolean;
}

export class LicenceWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.licence.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    prepareToPrintDeferred: Q.Deferred<void>;
    viewLoadedDeferred: Q.Deferred<void>;
    userActionDeferred: Q.Deferred<void>;

    name: string;
    docked: boolean;
    previewMode: boolean;
    printMode: boolean = false;
    openableElement: OpenableElement;
    currentViewId: number;
    onStartup: boolean;
        
    constructor(parent: app.WindowParent, options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openableElement = options.entry;

        if (this.isContentPdf()) {
            this.addViewScript({path: "build/pdf/pdfjs-dist/build/pdf.js"});
            this.addViewScript({path: "build/pdf/pdfjs-dist/build/pdf.worker.js"});
        }
        this.viewLoadedDeferred = Q.defer();
        
        this.docked = options.docked;
        this.onStartup = options.onStartup;
        
        if (this.docked) {
            this.openWindowOptions.widget = false;
            this.openWindowOptions.decoration = false;
            this.openWindowOptions.backgroundColor = "transparent";
        }
        else {
            this.openWindowOptions = {
                toolbar: false,
                maximized: false,
                show: false,
                position: "center",
                minWidth: 350,
                minHeight: 215,
                width: "66%",
                height: "75%",
                modal: true,
                resizable: true,
                title: this.getTitle() || this.name,
                icon: this.app.shellRegistry.resolveIcon(this.openableElement.getMimeType())
            };
        }
        if (this.printMode) {
            this.openWindowOptions.widget = false;
        }
    }

    isContentPdf(): boolean {
        return this.openableElement.getMimeType().indexOf("pdf") > -1;
    }
    
    getUserActionCallback() {
        this.userActionDeferred = Q.defer();
        return this.userActionDeferred.promise;
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
    
        
    onViewLoad() {
        this.loadData().then(() => {
            this.viewLoadedDeferred.resolve();
        });
    }
    
    loadData(): Q.Promise<void> {
        let currentViewId = this.currentViewId;
        return this.addTaskEx("", true, () => {
            if (this.openableElement == null) {
                return;
            }
            return Q().then(() => {
                return this.openableElement.getBlobData().then(d => {
                    return d;
                })
            })
            .then(data => {
                this.callViewMethod("setData", currentViewId, data, this.isContentPdf());
            })
            .fail(e => {
                this.getLogger().debug("Load failed", e);
            })
        });
    }
    
    getTitle(): string {
        return this.app.localeService.i18n("window.licence.title");
    }
    
    getModel(): Model {
        let m = {
            currentViewId: this.currentViewId,
            docked: this.docked,
            printMode: this.printMode,
            onStartup: this.onStartup,
            isElectronApp: this.app.isElectronApp()
        };
        return m;
    }
    
    beforeClose(_force?: boolean): Q.IWhenable<void> {
        if (this.onStartup && this.userActionDeferred) {
            this.userActionDeferred.reject();
        }
        return;
    }
    
    onViewDecline(): void {
        if (this.userActionDeferred) {
            this.userActionDeferred.reject();
        }
    }
    
    onViewAccept(): void {
        if (this.userActionDeferred) {
            this.userActionDeferred.resolve();
        }
        this.close();
    }
    
    onViewLicenses(): void {
        if (this.app.isElectronApp()) {
            this.app.openLicenseVendorsWindow();
        }
    }
    
    onViewOk(): void {
        this.close();
    }
}
