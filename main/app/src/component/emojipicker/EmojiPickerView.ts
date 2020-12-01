
import { BaseWindowView } from "../../window/base/BaseWindowView";
import * as $ from "jquery";
import { ComponentView } from "../base/ComponentView";
import {func as mainTemplate} from "./index.html";
import Q = require("q");
import { Model } from "./EmojiPickerController";
import * as WebUtils from "../../web-utils";
declare var twemoji: any;

export interface ViewModel {
    icons: {name: string, data: any}[];
    assetsPath: string;
}

interface CssRect {
    top: number;
    left: number;
    width: number;
    height: number;
    pointerRight: number;
}

export class EmojiPickerView extends ComponentView {
    static ROWS: number = 3;
    static COLS: number = 10;
    static ICON_MARGIN: number = 0;
    static ICON_SIZE: number = 35;

    opened: boolean = false;
    hideTimer: any;
    $main: JQuery;
    $container: JQuery;
    initialized: boolean = false;
    parentMsgId: string;
    constructor(public parent: ComponentView) {
        super(parent);
    }
    
    convertModel(model: Model): Q.Promise<ViewModel> {
        return Q().then(() => {

            return {
                assetsPath: model.assetsPath,
                icons: []
            }
    

        })
    }

    init(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$container.append(this.templateManager.createTemplate(mainTemplate).renderToJQ());
            this.$main = this.$container.find(".component-emoji-picker");
            if (this.initialized) {
                return;
            }
            let $iconsFaces = this.$container.find(".emoji-line.faces");
            let $iconsHands = this.$container.find(".emoji-line.hands");
            model.iconsFaces.forEach(icon => {
                let $icon = $(`<span class='emoji-icon' data-icon='${icon.name}'></span>`);
                $iconsFaces.append($icon);
                EmojiPickerView.loadImage(icon.url).then(img => {
                    $icon.append(img);
                    $icon.children("img").addClass("emoji");
                })
            })
            model.iconsHands.forEach(icon => {
                let $icon = $(`<span class='emoji-icon' data-icon='${icon.name}'></span>`);
                $iconsHands.append($icon);
                EmojiPickerView.loadImage(icon.url).then(img => {
                    $icon.append(img);
                    $icon.children("img").addClass("emoji");
                })
            })

            // twemoji.parse(this.$main.get(0), {
            //     base: model.assetsPath,
            //     folder: "./",
            //     ext: ".svg"
            // });
            this.$main.on("click", this.onPickerClick.bind(this));
            this.$main.on("click", ".emoji", this.onEmojiClick.bind(this));
            this.initialized = true;
            this.hide();
        });
    }
    
    showHide(parentMsgId: string, $parentContainer: JQuery, x: number, y: number) {
        this.parentMsgId = parentMsgId;
        let pickerRect = this.calculateDimensions($parentContainer);
        if (! this.opened) {
            this.$main
                .css("top", pickerRect.top + "px")
                .css("left", pickerRect.left + "px")
                .css("width", pickerRect.width + "px")
                .css("height", pickerRect.height + "px")
                .css("visibility", "visible");
            this.$main.find(".emoji-popup-header").css("right", pickerRect.pointerRight + "px");
            this.opened = true;
        }
        else {
            this.hide();
        }
    }

    hide() {
        this.opened = false;
        if (this.$main) {
            this.$main.css("visibility", "hidden");
        }
    }
    
    onPickerClick(e: MouseEvent): void {
        this.hide();
    }
    
    onEmojiClick(e: MouseEvent): void {
        let iconCode = $(e.target).closest("[data-icon]").data("icon");
        this.triggerEvent("iconSelected", iconCode, this.parentMsgId);
    }

    calculateDimensions($parent: JQuery): CssRect {
        let $msgContainer = $parent.find(".message");
        let $btnContainer = $parent.find(".emoji-btn");
        let containerRect = $msgContainer[0].getBoundingClientRect();
        let btnPos = $btnContainer.position();
        let extraPointerRightOffset = -1;
        
        if ($msgContainer.is(".file-box")) {
            let $sizeContainer = $msgContainer.find(".file-box .text .line .size");
            extraPointerRightOffset += -$sizeContainer.outerWidth();
        }
        
        let width = EmojiPickerView.COLS * (EmojiPickerView.ICON_MARGIN + EmojiPickerView.ICON_SIZE);
        let btnRect = $btnContainer[0].getBoundingClientRect();
        let rect: CssRect = {
            width: width + 2,
            height: EmojiPickerView.ROWS * (EmojiPickerView.ICON_MARGIN + EmojiPickerView.ICON_SIZE) + 2,
            top: containerRect.top + 32,
            left: containerRect.right - width,
            pointerRight: containerRect.right - btnRect.right + btnRect.width
        }
        return rect;
    }

    static loadImage(url: string): Q.Promise<HTMLImageElement> {
        return Q.Promise(resolve => {
            let img = new Image();
            img.onload = () => {
                resolve(img);
            };
            img.src = url;
        })
    }
}