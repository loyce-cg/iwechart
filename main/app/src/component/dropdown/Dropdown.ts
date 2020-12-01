import {func as mainTemplate} from "./index.html";
import {TemplateManager} from "../../web-utils/template/Manager";
import {Template} from "../../web-utils/template/Template";
import * as $ from "jquery";
import {PfScroll} from "../../web-utils/PfScroll";

export interface Options<T> {
    $container: JQuery;
    model: T;
    template: Template<T, any, any>;
    templateManager: TemplateManager;
}

export class Dropdown<T> {
    
    options: Options<T>;
    $backdrop: JQuery;
    $rendered: JQuery;
    
    constructor(options: Options<T>) {
        this.options = options;
        this.$backdrop = $("<div>").addClass("component-dropdown-backdrop").appendTo($("body"));
        this.$backdrop.on("click", this.destroy.bind(this));
        this.$rendered = options.templateManager.createTemplate(mainTemplate).renderToJQ(this.options.model, this.options);
        this.$rendered.on("click", ".close", this.destroy.bind(this));
        this.options.$container.append(this.$rendered);
        this.afterRender();
    }
    
    destroy() {
        if (this.$backdrop) {
            this.$backdrop.remove();
            this.$backdrop = null;
        }
        if (this.$rendered) {
            this.$rendered.remove();
            this.$rendered = null;    
        }
    }
    
    refresh() {
        this.$rendered.find(".inner").pfScroll().destroy();
        this.$rendered.find(".inner").html(this.options.template.render(this.options.model));
        this.afterRender();
    }
    
    afterRender() {
        if ($("body").height() - this.$rendered.offset().top - this.$rendered.outerHeight() - 5 < 0) {
            this.$rendered.css("width", this.$rendered.outerWidth() + "px");
            this.$rendered.find(".inner").css("height", $("body").height() - this.$rendered.offset().top - 35 + "px");
            this.$rendered.find(".inner").pfScroll().turnOn();
        }
        this.$rendered.css("margin-left", -(this.$rendered.outerWidth() / 2) + "px");
    }
}
