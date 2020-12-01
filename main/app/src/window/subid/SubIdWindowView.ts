import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./SubIdWindowController";
import {app} from "../../Types";
import QRious = require("qrious");

@WindowView
export class SubIdWindowView extends BaseWindowView<Model> {
    
    qr: QRious;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.qr  = new QRious({
          level: "M",
          size: 200,
          value: JSON.stringify({
              mnemonic: model.mnemonic,
              host: model.host
          })
        });
        this.$main.find(".canvas-placeholder").append(this.qr.canvas);
        this.$main.find("textarea").focus().select();
    }
    
    onBodyKeydown(event: KeyboardEvent): void {
        if (event.keyCode == 27) {
            event.preventDefault();
            this.triggerEvent("close");
        }
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
}
