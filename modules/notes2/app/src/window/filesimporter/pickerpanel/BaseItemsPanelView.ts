import {component, Types, webUtils, window as wnd, JQuery as $, Q} from "pmc-web";
import {Model} from "./BaseItemsPanelController";
import { func as mainTemplate } from "./template/main.html";

export abstract class BaseItemsPanelView<U> extends component.base.ComponentView {
    items: component.extlist.ExtListView<U>;
    $container: JQuery;
    listOptions: any;


    constructor(parent: wnd.base.BaseWindowView<any>, public personsComponent: component.persons.PersonsView) {
        super(parent);
    }

    init(model: Model): Q.Promise<void> {
        return Q().then(async () => {
            this.setupListOptionsBeforeInit();
            this.createComponents();
            this.render(model);
            let $listContainer = this.$container.find(".items-list");
            this.items.$container = $listContainer;
            await this.items.triggerInit();
            this.onAfterInit();
        })
    }

    private createComponents(): void {
        this.items = this.addComponent("items", new component.extlist.ExtListView(this, this.listOptions));
    }

    render(model: Model): void {
        this.$container.empty().append(this.templateManager.createTemplate(mainTemplate).renderToJQ(model));
    }

    public abstract setupListOptionsBeforeInit(): void;
    protected abstract onAfterInit(): void;
}