import { ComponentController } from "../base/ComponentController";
import * as Types from "../../Types";
import { AssetSpecEx, AssetsManager } from "../../app/common/AssetsManager";
import { Inject } from "../../utils/Decorators";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { CommonApplication } from "../../app/common/CommonApplication";
import { StickersList } from "./StickersList";

export interface EmojiIcon {
    name: string;
    url: string;
}
export interface Model {
    iconsFaces: EmojiIcon[];
    iconsHands: EmojiIcon[];
    assetsPath: string;
}

export interface EmojiOptions {
    app: CommonApplication;
}

export class EmojiPickerController extends ComponentController {
    
    static textsPrefix: string = "component.emojiPicker.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static ASSETS: AssetSpecEx[] = [
        {type: "script", path: "build/twemoji/twemoji.min.js"}
    ];
    
    @Inject assetsManager: AssetsManager;
    @Inject stickersProvider: Types.section.StickersProvider;
    onIconSelectedListener: (id: string, parentId: string) => void;
    
    constructor(
        public parent: Types.app.IpcContainer&Types.app.IOCContainer, public options: EmojiOptions
    ) {
        super(parent);
        this.ipcMode = true;
    }

    getModel(): Model {
        let path = this.assetsManager.getAsset("build/twemoji");
        let iconsHands = StickersList.get("hands");
        let iconsFaces = StickersList.get("faces");
        let model = {
            iconsHands: iconsHands.map(name => ({name: name, url: path + "/" + name + ".svg"})),
            iconsFaces: iconsFaces.map(name => ({name: name, url: path + "/" + name + ".svg"})),
            assetsPath: path
        };
        return model;
    }
    
    onViewIconSelected(iconCode: string, parentId: string): void {
        if (this.onIconSelectedListener) {
            this.onIconSelectedListener(iconCode, parentId);
        }
        else {
            throw Error("EmojiPickerController - no listener added");
        }
    }
    
    setOnIconSelectedListener(listener: (id: string, parentId: string) => void): void {
        this.onIconSelectedListener = listener;
    }
}