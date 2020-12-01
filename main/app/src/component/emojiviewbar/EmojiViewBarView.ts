import * as $ from "jquery";
import { ComponentView } from "../base/ComponentView";
import { EmojiPickerView } from "../emojipicker/EmojiPickerView";
import { Model } from "./EmojiViewBarController";
import { InfoTooltip } from "../infotooltip/InfoTooltip";
import Q = require('q');
import { StickersList } from "../emojipicker/StickersList";

declare var twemoji: any;

export class EmojiViewBarView extends ComponentView {
    $container: JQuery;
    assetsPath: string;
    emojiTooltip: InfoTooltip;
    constructor(public parent: ComponentView) {
        super(parent);
    }
    
    init(model: Model) {
        this.assetsPath = model.assetsPath;
        this.emojiTooltip = this.addComponent("infoTooltip", new InfoTooltip(this));
        this.refreshEmoji();
    }
    
    refreshEmoji(): void {
        this.$container.find(".component-emoji-view").each((_i, e) => {
            let $e = $(e);
            $e.find(".emoji-icon.emoji-not-rendered").each((_j, icon) => {
                let $icon = $(icon);

                if (StickersList.stickersCompat.indexOf($icon.data("icon")) > -1) {
                    twemoji.parse($e.get(0), {
                        base: this.assetsPath + "/",
                        folder: "./",
                        ext: ".svg",
                        className: "cev-emoji"
                    });    
                }
                else {
                    EmojiPickerView.loadImage(this.assetsPath + "/" + $icon.data("icon") + ".svg").then(img => {
                        $icon.append(img);
                    })    
                }
                $icon.removeClass("emoji-not-rendered");
            })
            this.emojiTooltip.init(this.$container);
        });
    }
}