import {ComponentController} from "../base/ComponentController";
import {app} from "../../Types";
import Q = require("q");
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface SliderOptions {
    onUserValueChange?: (value: number) => void;
}

export class SliderController extends ComponentController {
    
    static textsPrefix: string = "component.slider.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    afterViewLoaded: Q.Deferred<void>;
    max: number = 0;
    value: number = 0;
    onUserValueChange: (value: number) => void;
    
    constructor(parent: app.IpcContainer, options: SliderOptions) {
        super(parent);
        this.onUserValueChange = options.onUserValueChange;
        this.afterViewLoaded = Q.defer();
        this.ipcMode = true;
    }
    
    onViewLoad(): void {
        this.afterViewLoaded.resolve();
    }
    
    setMax(max: number) {
        this.max = max;
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setMax", this.max);
        });
    }
    
    setValue(value: number) {
        this.value = Math.min(value, this.max);
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setValue", this.value);
        });
    }
    
    setLoading(loading: boolean) {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setLoading", loading);
        });
    }
    
    setProgress(progress: number) {
        this.afterViewLoaded.promise.then(() => {
            this.callViewMethod("setProgress", progress);
        });
    }
    
    onViewUserValueChange(value: number) {
        if (this.onUserValueChange) {
            this.onUserValueChange(value);
        }
    }
    
}

