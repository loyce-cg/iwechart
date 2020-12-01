import * as $ from "jquery";
import { ComponentView } from "../base/ComponentView";
import * as Types from "../../Types";

export interface InfoTooltipOptions {
    $parentElement: JQuery;
    message?: string;
    extraMessage?: string;
    theme?: "light" | "dark";
    icon?: string;
    marginFromCursor?: number;
    withAvatars?: boolean;
}

export class InfoTooltip extends ComponentView {
    $currentTooltip: JQuery;
    $container: JQuery;
    margin: number = 20;
    optionsSet: InfoTooltipOptions;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
    }
    
    init($container: JQuery): void {
        this.$container = $container;
        this.$container.find(".infotooltip.not-rendered").each((_i, e) => {
            let $e = $(e);
            this.optionsSet = {
                $parentElement: this.$container,
                message: $e.data("tooltip-message") || "",
                extraMessage: $e.data("tooltip-extra") || "",
                theme: $e.data("tooltip-theme") || "dark",
                icon: $e.data("tooltip-icon"),
                marginFromCursor: $e.data("cursor-margin") || this.margin,
                withAvatars: $e.data("with-avatars") || false
            }
            this.render($e);
            $e.removeClass("not-rendered");
        });
    }
    
    render($e: JQuery) {
        let $parent = $e.parent();
        let extra: string = "";
        if (this.optionsSet.extraMessage && !this.optionsSet.withAvatars) {
            extra = "<div class='extra-message'>" + this.optionsSet.extraMessage + "</div>";
        }
        let icon: string = "";
        if (this.optionsSet.icon) {
            icon = "<i class='" + this.optionsSet.icon + "'></i>";
        }
        let html: string;
        if (this.optionsSet.withAvatars) {
            html = "<div class='info-tooltip-component'><div class='info-tooltip" + (this.optionsSet.theme == "light" ? " light" : "") + "'></div></div>";
            let $html = $(html);
            let $avatars = $e.find(".avatars").detach();
            $html.find(".info-tooltip").append($avatars);
            $e.append($html);
        }
        else {
            html = "<div class='info-tooltip-component'><div class='info-tooltip" + (this.optionsSet.theme == "light" ? " light" : "") + "'>" + this.optionsSet.message + icon + extra + "</div></div>";
            $e.append($(html));
        }
        $parent.on("mouseover", $e, this.onTooltipShow.bind(this));
        $parent.on("mousemove", $e, this.onTooltipPositionUpdate.bind(this));
        $parent.on("mouseout", $e, this.onTooltipHide.bind(this));
    }
    
    onTooltipShow(e: MouseEvent) {
        if (this.$currentTooltip && this.$currentTooltip.css("visibility") == "visible") {
            return;
        }
        let curr: JQuery = $(<HTMLElement>e.currentTarget);
        this.$currentTooltip = curr.find(".info-tooltip-component");
        this.$currentTooltip.css("visibility", "visible");
        this.ellipsis(this.$currentTooltip);
        
        this.onTooltipPositionUpdate(e);
    }
    
    ellipsis($ele: JQuery): void {
        $ele.each((_i, e) => {
            let el = $(e);
            if (el.css("overflow") == "hidden") {
                let text = el.html();
                let multiline = el.hasClass("multiline");
                let t = $(<HTMLElement>e.cloneNode(true))
                    .hide()
                    .css("position", "absolute")
                    .css("overflow", "visible")
                    .width(multiline ? el.width() : "auto")
                    .height(multiline ? "auto" : el.height());
                el.after(t);
                let height = () => t.height() > el.height();
                let width = () => t.width() > el.width();
                let tooLong = multiline ? height : width;
                t.text(text);
                if (tooLong()) {
                    let a = 0;
                    let b = text.length;
                    while (true) {
                        let c = a + Math.floor((b - a) / 2);
                        t.text(text.substring(0, c) + "...");
                        if (b - a == 1) {
                            break;
                        }
                        if (tooLong()) {
                            b = c;
                        }
                        else {
                            a = c;
                        }
                    }
                }
                el.text(t.text());
                t.remove();
            }
        });
    }
    
    onTooltipHide(e: MouseEvent) {
        if (this.$currentTooltip && this.$currentTooltip.css("visibility", "visible")) {
            this.$currentTooltip.css("visibility", "hidden");
            this.$currentTooltip = null;
        }
    }
    
    onTooltipPositionUpdate(e: MouseEvent) {
        if (!this.$currentTooltip) {
            return;
        }
        let windowX = $(window).width();
        let windowY = $(window).height();
        let tooltipWidth = this.$currentTooltip.find(".info-tooltip").outerWidth();
        let tooltipHeight = this.$currentTooltip.find(".info-tooltip").outerHeight();
        this.$currentTooltip.css("left", this.margin + this.getMaxTooltipPos(this.margin, e.clientX, windowX, tooltipWidth) + "px");
        this.$currentTooltip.css("top", this.margin + this.getMaxTooltipPos(this.margin, e.clientY, windowY, tooltipHeight) + "px");
    }
    
    getMaxTooltipPos(margin: number, client: number, windowSize: number, avatarBoxSize: number) {
        let tooltipPos = avatarBoxSize + client;
        let maxClientPos = client;
        if (tooltipPos > windowSize - margin) {
            maxClientPos = client - (tooltipPos - windowSize) - margin;
        }
        return maxClientPos;
    }

}