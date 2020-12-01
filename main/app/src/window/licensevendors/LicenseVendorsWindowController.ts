import * as Q from "q";
import {app, utils} from "../../Types";
import { BaseWindowController } from "../base/BaseWindowController";
import { OpenableElement } from "../../app/common/shell/ShellTypes";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import {Inject, Dependencies} from "../../utils/Decorators";
import { SplitterController } from "../../component/splitter/SplitterController";
import { MutableCollection } from "../../utils/collection/MutableCollection";
import { FilteredCollection } from "../../utils/collection/FilteredCollection";
import { ExtListController } from "../../component/extlist/ExtListController";
import { WithActiveCollection } from "../../utils/collection/WithActiveCollection";
import { TransformCollection } from "../../utils/collection/TransformCollection";

export interface Model {
    currentViewId: number;
    docked: boolean;
    printMode: boolean;
    isPdf: boolean;
}

export interface SimpleAsset {
    assetName: string;
    elementId: string;
}

export interface Options {
    docked?: boolean;
    entries: app.VendorLicenseAsset[];
}

@Dependencies(["splitter", "extlist"])
export class LicenseVendorsWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.licensevendors.";
    splitter: SplitterController;
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    prepareToPrintDeferred: Q.Deferred<void>;
    viewLoadedDeferred: Q.Deferred<void>;
    userActionDeferred: Q.Deferred<void>;
    
    mutableCollection: MutableCollection<app.VendorLicenseAsset>;
    filteredCollection: FilteredCollection<app.VendorLicenseAsset>;
    assetsCollection: WithActiveCollection<SimpleAsset>;
    transformCollection: TransformCollection<SimpleAsset, app.VendorLicenseAsset>;
    licensesList: ExtListController<SimpleAsset>;
    name: string;
    docked: boolean;
    previewMode: boolean;
    printMode: boolean = false;
    entries: app.VendorLicenseAsset[];
    currentViewId: number;
    openableElement: OpenableElement;
    filter: string;
         
    constructor(parent: app.WindowParent, options: Options) {
        super(parent, __filename, __dirname, {
            isPublic: true,
            subs: {
                "splitter": {defaultValue: "300"}
            }
        });
        this.ipcMode = true;
        this.entries = options.entries;
        if (this.areAnyPdfInEntries(options.entries)) {
            this.addViewScript({path: "build/pdf/pdfjs-dist/build/pdf.js"});
            this.addViewScript({path: "build/pdf/pdfjs-dist/build/pdf.worker.js"});
        }
        
        if (this.entries.length > 0) {
            this.openableElement = this.entries[0].openableElement;
        }
        
        this.mutableCollection = this.addComponent("mutableCollection", new MutableCollection(options.entries));
        this.filteredCollection = this.addComponent("filteredCollection", new FilteredCollection(this.mutableCollection, this.filterEntries.bind(this)));
        this.transformCollection = this.addComponent("transformCollection", new TransformCollection<SimpleAsset, app.VendorLicenseAsset>(this.filteredCollection, this.transformAsset.bind(this)))
        this.assetsCollection = this.addComponent("assetsCollection", new WithActiveCollection(this.transformCollection));
        this.registerChangeEvent(this.assetsCollection.changeEvent, this.onAssetsCollectionChange);
        this.licensesList = this.addComponent("licensesList", new ExtListController<SimpleAsset>(this, this.assetsCollection));
        this.licensesList.ipcMode = true;
        this.viewLoadedDeferred = Q.defer();
        
        this.docked = options.docked;
        
        if (this.docked) {
            this.openWindowOptions.widget = false;
            this.openWindowOptions.decoration = false;
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
                title: this.getTitle() || this.name
            };
        }
        if (this.printMode) {
            this.openWindowOptions.widget = false;
        }
    }
    
    onViewUpdateFilter(text: string): void {
        this.filter = text;
        this.filteredCollection.refresh();
    }
    
    filterEntries(entry: app.VendorLicenseAsset) {
        if (this.filter && this.filter.length >= 2) {
            return entry.assetName.indexOf(this.filter) > -1;
        }
        return true;
    }
    
    onAssetsCollectionChange(event: utils.collection.CollectionEvent<SimpleAsset>): void {
        if (event.type == "active" && event.newActive) {

        }
    }

    onViewActivateAsset(elementId: string): void {
        let asset = this.assetsCollection.find(x => x.elementId == elementId);
        if (asset == null) {
            return;
        }
        this.setActive(asset);
        let foundAsset = this.filteredCollection.find(x => x.assetPath == asset.elementId);
        if (foundAsset) {
            this.openableElement = foundAsset.openableElement;
            this.onViewLoad();
        }
    }
    
    getActive(): SimpleAsset {
        return this.assetsCollection.getActive();
    }
    
    setActive(asset: SimpleAsset) {
        this.assetsCollection.setActive(asset);
    }
    
    transformAsset(asset: app.VendorLicenseAsset): SimpleAsset {
        return {
            assetName: asset.assetName,
            elementId: asset.assetPath
        }
    }
    
    
    init(): Q.IWhenable<void> {
        return Q().then(() => {
            return this.loadSettings()
        })
        .then(() => {
            this.splitter = this.addComponent("splitter", this.componentFactory.createComponent("splitter", [this, this.settings.create("splitter")]));
        })
        .then(() => {
            if (this.assetsCollection.list.length > 0) {
                this.assetsCollection.setActive(this.assetsCollection.list[0]);
            }
        })
    }

    isContentPdf(): boolean {
        return this.openableElement ? this.openableElement.getMimeType().indexOf("pdf") > -1 : false;
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
        return this.app.localeService.i18n("window.licensevendors.title");
    }
    
    getModel(): Model {
        return {
            currentViewId: this.currentViewId,
            docked: this.docked,
            printMode: this.printMode,
            isPdf: this.isContentPdf()
            
        };
    }
    
    beforeClose(_force?: boolean): Q.IWhenable<void> {
        return;
    }
    
    areAnyPdfInEntries(entries: app.VendorLicenseAsset[]): boolean {
        let found: boolean = false;
        entries.forEach(x => {
            if (x.openableElement && x.openableElement.getMimeType().indexOf("pdf") > -1) {
                found = true;
                return;
            }
        })
        return found;
    }
}
