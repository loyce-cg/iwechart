import {ComponentController} from "../base/ComponentController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class ProgressController {
    
    static textsPrefix: string = "component.progress.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(public controller: ComponentController, public id: number) {
    }
    
    send(type: string, args: any[]|IArguments): void {
        if (this.id != null) {
            this.controller.sendToViewChannel.apply(this.controller, [this.id, type].concat(Array.prototype.slice.call(args, 0)));
        }
    }
    
    start(...args: any[]): void {
        this.send("start", arguments);
    }
    
    progress(...args: any[]): void {
        this.send("progress", arguments);
    }
    
    finish(...args: any[]): void {
        this.send("finish", arguments);
    }
}

