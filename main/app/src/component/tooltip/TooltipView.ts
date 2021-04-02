import * as $ from "jquery";
import { ComponentView } from "../base/ComponentView";
import * as Types from "../../Types";
import { MailClientViewHelper } from "../../web-utils";

export class TooltipView extends ComponentView {
    $container: JQuery;
    $tooltip: JQuery;
    $infoTooltip: JQuery;
    $tooltipContent: JQuery;
    margin: number = 20;
    currTargetId: string = null;
    onMouseLeaveBound: (e: MouseEvent) => void = null;
    onMouseMoveBound: (e: MouseEvent) => void = null;
    checkTargetIdIntervalId: number;
    lastEventClientX: number = null;
    lastEventClientY: number = null;
    $lastTarget: JQuery = null;
    helper: MailClientViewHelper;
    tooltipName: string = "basic";
    cachedSizes: { windowX: number, windowY: number, tooltipWidth: number, tooltipHeight: number } = null;
    convertContent: (cnt: string) => string = null;
    isEnabled: (e: MouseEvent) => boolean = null;
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.helper = this.templateManager.getHelperByClass(MailClientViewHelper);
    }
    
    init() {
        if (this.$container.hasClass(this.tooltipName + "-tooltip-initialized")) {
            return;
        }
        this.$container.addClass(this.tooltipName + "-tooltip-initialized");
        this.$tooltip = $('<div class="tooltip-component ' + this.tooltipName + '-tooltip-component info-tooltip-component light"><div class="info-tooltip light"></div></div>');
        this.$infoTooltip = this.$tooltip.find(".info-tooltip");
        this.$tooltipContent = this.$tooltip.children();
        this.$tooltip.appendTo(this.$container);
        this.onMouseLeaveBound = this.onMouseLeave.bind(this);
        this.onMouseMoveBound = this.onMouseMove.bind(this);
        this.$container.on("mouseenter", ".has-" + this.tooltipName + "-tooltip", this.onMouseEnter.bind(this));
    }
    
    attachEvents() {
        if (this.currTargetId != null) {
            if (this.checkTargetIdIntervalId) {
                this.detachEvents();
            }
            this.$container.on("mouseleave", ".has-" + this.tooltipName + "-tooltip", <any>this.onMouseLeaveBound);
            $(document).on("mousemove", <any>this.onMouseMoveBound);
            this.checkTargetIdIntervalId = <any>setInterval(this.checkTargetId.bind(this), 100);
        }
    }
    
    detachEvents() {
        if (this.currTargetId != null) {
            this.$container.off("mouseleave", ".has-" + this.tooltipName + "-tooltip", <any>this.onMouseLeaveBound);
            $(document).off("mousemove", <any>this.onMouseMoveBound);
            clearInterval(this.checkTargetIdIntervalId);
            this.checkTargetIdIntervalId = null;
        }
    }
    
    getCurrentTargetId(): string {
        return this.currTargetId;
    }
    
    checkTargetId(): void {
        if (this.currTargetId && this.$lastTarget) {
            let targetId = this.$lastTarget.data(this.tooltipName + "-id");
            if (targetId != this.currTargetId) {
                this.changeTargetId(targetId);
            }
        }
    }
    
    setContent(targetId: string, cnt: string) {
        if (this.currTargetId != targetId) {
            return;
        }
        
        if (this.convertContent) {
            cnt = this.convertContent(cnt);
        }
        
        this.$tooltipContent.text(cnt);
        this.show();
    }
    
    onMouseEnter(e: MouseEvent) {
        if (this.isEnabled && !this.isEnabled(e)) {
            return;
        }
        let $target = <JQuery>$(e.currentTarget);
        let targetId = $target.data(this.tooltipName + "-id");
        let targetId2 = $target.attr("data-" + this.tooltipName + "-id");
        if (targetId && targetId2 && targetId != targetId2) {
            targetId = targetId2;
            $target.data(this.tooltipName + "-id", targetId2);
        }
        this.currTargetId = targetId;
        this.lastEventClientX = e.clientX;
        this.lastEventClientY = e.clientY;
        this.$lastTarget = $target;
        this.triggerEvent("requestContent", targetId);
        this.attachEvents();
    }
    
    onMouseLeave(e: MouseEvent) {
        let $target = <JQuery>$(e.currentTarget);
        let $newTargetCandidate = $target.parent().closest("[data-" + this.tooltipName + "-id]");
        if ($newTargetCandidate.length > 0) {
            let $newTarget = $newTargetCandidate;
            this.$lastTarget = $newTarget;
            this.changeTargetId($newTarget.data(this.tooltipName + "-id"));
            return;
        }
        this.detachEvents();
        this.currTargetId = null;
        this.lastEventClientX = e.clientX;
        this.lastEventClientY = e.clientY;
        this.$lastTarget = $target;
        this.hide();
    }
    
    onMouseMove(e: MouseEvent) {
        let $target = <JQuery>$(e.target).closest(".has-" + this.tooltipName + "-tooltip");
        if ($target.length == 0) {
            if (!this.currTargetId) {
                return;
            }
            return this.onMouseLeave(e);
        }

        let targetId = $target.data(this.tooltipName + "-id");
        if (targetId != this.currTargetId) {
            this.changeTargetId(targetId);
        }
        
        this.lastEventClientX = e.clientX;
        this.lastEventClientY = e.clientY;
        this.$lastTarget = $target;
        this.move(this.lastEventClientX, this.lastEventClientY);
    }
    
    changeTargetId(targetId: string): void {
        this.currTargetId = targetId;
        this.triggerEvent("requestContent", targetId);
    }
    
    show(clientX: number = null, clientY: number = null) {
        if (clientX === null) {
            clientX = this.lastEventClientX;
        }
        if (clientY === null) {
            clientY = this.lastEventClientY;
        }
        if (this.$tooltip && this.$tooltip.css("visibility") == "visible") {
            return;
        }
        this.$tooltip.css("visibility", "visible");
        this.cacheSizes();
        this.move(clientX, clientY);
    }
    
    hide() {
        this.cachedSizes = null;
        if (this.$tooltip && this.$tooltip.css("visibility", "visible")) {
            this.$tooltip.css("visibility", "hidden");
        }
    }
    
    move(clientX: number, clientY: number) {
        if (!this.$tooltip) {
            return;
        }
        if (!this.cachedSizes) {
            this.cacheSizes();
        }
        let windowX = this.cachedSizes.windowX;
        let windowY = this.cachedSizes.windowY;
        let tooltipWidth = this.cachedSizes.tooltipWidth;
        let tooltipHeight = this.cachedSizes.tooltipHeight;
        this.$tooltip.css("left", this.margin + this.getMaxTooltipPos(this.margin, clientX, windowX, tooltipWidth) + "px");
        this.$tooltip.css("top", this.margin + this.getMaxTooltipPos(this.margin, clientY, windowY, tooltipHeight) + "px");
    }
    
    cacheSizes(): void {
        this.cachedSizes = {
            windowX: $(window).width(),
            windowY: $(window).height(),
            tooltipWidth: this.$infoTooltip.outerWidth(),
            tooltipHeight: this.$infoTooltip.outerHeight(),
        };
    }
    
    getMaxTooltipPos(margin: number, client: number, windowSize: number, tooltipSize: number) {
        let tooltipPos = tooltipSize + client;
        let maxClientPos = client;
        if (tooltipPos + margin > windowSize) {
            if (client - margin - tooltipSize >= 0) {
                maxClientPos = client - margin - tooltipSize;
            }
            else {
                maxClientPos = client - (tooltipPos - windowSize) - margin;
            }
        }
        return maxClientPos;
    }
    
    ellipsis($el: JQuery, len: number = 150, maxLen: number = 200): void {
        let html = $el.html();
        if (html === undefined) {
            return;
        }
        let l = html.length;
        if (l <= len) {
            return;
        }
        
        let inTag = false;
        let inAmp = false;
        let counter = 0;
        let cutAt = -1;
        for (let i = 0; i < l; ++i) {
            let c = html[i];
            if (c == "<") {
                inTag = true;
            }
            else if (c == ">" && inTag) {
                inTag = false;
            }
            else if (c == "&" && !inTag) {
                inAmp = true;
                counter++;
            }
            else if (c == ";" && inAmp) {
                inAmp = false;
            }
            else if (!inTag && !inAmp) {
                if (c == " " || c == "\t" || c == "\n") {
                    counter++;
                    if (counter >= len) {
                        cutAt = i;
                        break;
                    }
                }
                else {
                    counter++;
                    if (counter >= maxLen) {
                        cutAt = i;
                        break;
                    }
                }
            }
        }
        if (cutAt >= 0) {
            html = html.substr(0, cutAt);
            if (html.length < l) {
                html += "...";
            }
            $el.html(html);
        }
    }

}