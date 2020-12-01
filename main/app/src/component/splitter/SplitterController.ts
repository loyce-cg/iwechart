import {ComponentController} from "../base/ComponentController";
import {Settings} from "../../utils/Settings";
import {app} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    handlePos: number,
    totalSize: number,
    flip: boolean,
}

export class SplitterController extends ComponentController {
    
    static textsPrefix: string = "component.splitter.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    settings: Settings;
    
    constructor(parent: app.IpcContainer, settings: Settings) {
        super(parent);
        this.settings = settings;
        this.ipcMode = true;
        this.registerChangeEvent(this.settings.changeEvent, this.onChange.bind(this));
    }
    
    getModel(): Model {
        let val: string = this.settings.get();
        let num = parseInt(val);
        if (isNaN(num)) {
            return JSON.parse(val);
        }
        return { handlePos: num, totalSize: null, flip: null };
    }
    
    onViewChangeRelativeHandlePosition(relativeHandlePosition: number, totalSize: number, flip: boolean): void {
        if (totalSize !== null) {
            this.settings.set(JSON.stringify({ handlePos: relativeHandlePosition, totalSize: totalSize, flip: flip }));
        }
        else {
            this.settings.set(relativeHandlePosition, this);
        }
    }
    
    onChange(type: string, settings: Settings, caller: any) {
        if (caller != this) {
            this.callViewMethod("setModel", this.getModel());
        }
    }
}

