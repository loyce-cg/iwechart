import { ComponentController } from "../base/ComponentController";
import * as Types from "../../Types";
import { AssetSpecEx, AssetsManager } from "../../app/common/AssetsManager";
import { Inject } from "../../utils/Decorators";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    assetsPath: string;
}

export class EmojiViewBarController extends ComponentController {
    
    static textsPrefix: string = "component.emojiViewBar.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static ASSETS: AssetSpecEx[] = [
        {type: "script", path: "build/twemoji/twemoji.min.js"}
    ];
    
    @Inject assetsManager: AssetsManager;
    
    constructor(
        public parent: Types.app.IpcContainer&Types.app.IOCContainer
    ) {
        super(parent);
        this.ipcMode = true;
    }
    
    getModel(): Model {
        let path = this.assetsManager.getAsset("build/twemoji");
        return {
            assetsPath: path
        };
    }
    
    static getAssetsPath(assetsManager: AssetsManager): string {
        return assetsManager.getAsset("build/twemoji", true);
    }
}
