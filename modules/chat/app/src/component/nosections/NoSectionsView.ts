import {component, webUtils, window as wnd, Q, JQuery as $} from "pmc-web";
import {mail, Types} from "pmc-mail";
import {func as nosectionsTemplate} from "./template/nosections.html";
import {Model} from "./NoSectionsController";

export interface EntryToRemove {
    sendingId: number;
    realMessageId: number;
}

export class NoSectionsView extends component.base.ComponentView {
    parent: wnd.base.BaseWindowView<any>;
    $container: JQuery;
    constructor(parent: wnd.base.BaseWindowView<any>) {
        super(parent);
    }
    
    init(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$container.append(this.templateManager.createTemplate(nosectionsTemplate).renderToJQ());
            this.$container.attr("tabindex", "-1");
            return;
        });
    }
    
    onDeactivate(): void {}
    onActivate(): void {}
    blurInputFocus(): void {}
}