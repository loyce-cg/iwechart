import {ComponentController} from "../base/ComponentController";
import {app} from "../../Types";
import Q = require("q");
import { CssParser, CustomizationParsingResult } from "../../app/common/customization/CssParser";
import { CommonApplication } from "../../app/common";
import { SliderController } from "../slider/main";
import { Inject } from "../../utils/Decorators";
import { ComponentFactory } from "../main";
import { CustomizationData } from "../../app/common/customization/CustomizationData";
import { CssGenerator } from "../../app/common/customization/CssGenerator";
import * as privfs from "privfs-client";
import { BaseWindowController } from "../../window/base/main";
import { EventDispatcher } from "../../utils";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    title: string;
    css: string;
    logoHeader: string;
    logoHeaderWh: string;
    logoLoginScreen: string;
}

export interface CustomizationEditorOptions {
    data: CustomizationData;
    app: CommonApplication;
}

export class CustomizationEditorController extends ComponentController {
    
    static textsPrefix: string = "component.customizationEditor.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject componentFactory: ComponentFactory;
    
    afterViewLoaded: Q.Deferred<void>;
    parserResult: CustomizationParsingResult;
    sliders: SliderController[] = [];
    saveCallback: (customizationData: CustomizationData) => void;
    defaultData: CustomizationData;
    
    constructor(parent: app.IpcContainer, public options: CustomizationEditorOptions) {
        super(parent);
        this.afterViewLoaded = Q.defer();
        this.ipcMode = true;
        this.defaultData = this.options.data;
    }
    
    setData(data: CustomizationData) {
        if (this.defaultData) {
            let defaultData = CssParser.parseVariables(this.defaultData.css);
            let data2 = CssParser.parseVariables(data.css);
            let changed = false;
            for (let k in defaultData.cssVars) {
                if (!(k in data2.cssVars)) {
                    data2.cssVars[k] = defaultData.cssVars[k];
                    changed = true;
                }
            }
            for (let k in defaultData.customizationVars) {
                if (!(k in data2.customizationVars)) {
                    data2.customizationVars[k] = defaultData.customizationVars[k];
                    changed = true;
                }
            }
            if (changed) {
                data.css = CssGenerator.generate(data2);
            }
        }
        this.options.data = data;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setModel", this.getModel());
        });
    }
    
    getModel(): Model {
        return {
            title: this.options.data.title,
            css: this.options.data.css,
            logoHeader: this.options.data.logoHeader,
            logoHeaderWh: this.options.data.logoHeaderWh,
            logoLoginScreen: this.options.data.logoLoginScreen,
        };
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    onViewFullPreview(customizationDataStr: string): void {
        let customizationData = JSON.parse(customizationDataStr);
        this.options.app.useTemporaryCustomizedTheme(customizationData);
    }
    
    onViewSave(customizationDataStr: string): void {
        let customizationData = JSON.parse(customizationDataStr);
        this.options.app.useCustomizedTheme(customizationData);
        this.options.app.saveCustomTheme();
        if (this.saveCallback) {
            this.saveCallback(customizationData);
        }
    }
    
    onViewExport(customizationData: any): void {
        let session = this.options.app.sessionManager.getLocalSession();
        this.options.app.directSaveContent(privfs.lazyBuffer.Content.createFromJson(customizationData, null, "customization.json"), session, this.getClosestNotDockedController());
    }
    
    onViewImport(): void {
        let wnd = this.getClosestNotDockedController();
        this.options.app.openFile(wnd ? wnd.nwin : null).then(file => {
            return file.getJson<Model>();
        })
        .then(model => {
            this.callViewMethod("setModel", model);
        });
    }
    
    onViewCancel(): void {
        this.options.app.restoreCustomizedTheme();
    }
    
    onViewAddSlider(id: number, perc: boolean) {
        let slider = this.addComponent("slider-" + id, this.componentFactory.createComponent("slider", [this, {}]));
        this.sliders.push(slider);
        this.callViewMethod("addSlider", id, perc);
    }
    
    prepare(): void {
        this.callViewMethod("prepare");
    }
    
    onViewRestoreDefaults(): void {
        this.setData(this.defaultData);
    }
    
    getClosestNotDockedController(): BaseWindowController {
        let parent: EventDispatcher = this.parent;
        let lim = 100;
        while (--lim > 0 && parent) {
            if (parent instanceof BaseWindowController) {
                return parent.getClosestNotDockedController();
            }
            parent = parent.parent;
        }
        return null;
    }
    
}

