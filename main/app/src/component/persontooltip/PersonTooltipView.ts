import {func as tooltipTemplate} from "./template/tooltip.html";
import {PersonsView} from "../persons/PersonsView";
import {TemplateManager} from "../../web-utils/template/Manager";
import * as $ from "jquery";

export class PersonTooltipView {
    
    $main: JQuery;
    $currentAvatar: JQuery;
    $avatarPlaceholder: JQuery;
    margin: number;
    onDocumentMouseMoveBound: any;
    
    constructor(
        public templateManager: TemplateManager,
        public personsView: PersonsView
    ) {
        this.margin = 40;
    }
    
    init($main: JQuery) {
        this.$main = $main;
        this.onDocumentMouseMoveBound = this.onDocumentMouseMove.bind(this);
        this.$main.on("mouseover", "[data-tooltip-trigger]", this.onAvatarZoom.bind(this));
        this.$main.on("mousemove", "[data-tooltip-trigger]", this.onAvatarPositionUpdate.bind(this));
        this.$main.on("mouseout", "[data-tooltip-trigger]", this.onAvatarHide.bind(this));
    }
    
    onAvatarZoom(e: MouseEvent) {
        let $e = <JQuery>$(e.target).closest("[data-tooltip-trigger]");
        if (this.$currentAvatar && this.$currentAvatar[0] == $e[0]) {
            return;
        }
        $(document).off("mousemove", this.onDocumentMouseMoveBound);
        $(document).on("mousemove", this.onDocumentMouseMoveBound);
        if (this.$avatarPlaceholder) {
            this.$avatarPlaceholder.remove();
        }
        this.$currentAvatar = $e;
        let persons = (<string>$e.data("tooltip-trigger")).split(",").map(x => this.personsView.getPerson(x));
        this.$avatarPlaceholder = this.templateManager.createTemplate(tooltipTemplate).renderToJQ(persons);
        this.$avatarPlaceholder.find("canvas").each((_i, e) => {
            let $e = $(e);
            this.personsView.avatarService.draw(<HTMLCanvasElement>e, $e.data("hashmail-image"), this.personsView.getAvatarOptions($e), false);
        });
        $("body").append(this.$avatarPlaceholder);
        this.ellipsis(this.$avatarPlaceholder.find(".description-container"));
        this.onAvatarPositionUpdate(e);
    }
    
    ellipsis($ele: JQuery): void {
        $ele.each((i, e) => {
            let el = $(e);
            if (el.css("overflow") == "hidden") {
                let text = el.html();
                let multiline = el.hasClass("multiline");
                let t = $(<HTMLElement>e.cloneNode(true))
                    .hide()
                    .css("max-height", "initial")
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
    
    onAvatarHide(e: MouseEvent) {
        if (this.$avatarPlaceholder) {
            $(document).off("mousemove", this.onDocumentMouseMoveBound);
            this.$avatarPlaceholder.remove();
            this.$currentAvatar = null;
            this.$avatarPlaceholder = null;
        }
    }
    
    onAvatarPositionUpdate(e: MouseEvent) {
        if (!this.$avatarPlaceholder) {
            return;
        }
        let windowX = $(window).width();
        let windowY = $(window).height();
        let tooltipWidth = this.$avatarPlaceholder.find(".avatar-item").outerWidth();
        let tooltipHeight = this.$avatarPlaceholder.find(".avatar-item").outerHeight();
        this.$avatarPlaceholder.css("left", this.personsView.helper.getMaxTooltipPos(this.margin, e.clientX, windowX, tooltipWidth) + "px");
        this.$avatarPlaceholder.css("top", this.personsView.helper.getMaxTooltipPos(this.margin, e.clientY, windowY, tooltipHeight) + "px");
    }
    
    onDocumentMouseMove(e: MouseEvent): void {
        if (!this.$avatarPlaceholder) {
            return;
        }
        if ($(e.target).closest("[data-tooltip-trigger]").length == 0) {
            return this.onAvatarHide(e);
        }
    }
    
}