import {ComponentController} from "../base/ComponentController";
import {WithActiveCollection} from "../../utils/collection/WithActiveCollection";
import {TransformCollection} from "../../utils/collection/TransformCollection";
import {ExtListController} from "../extlist/ExtListController";
import * as Types from "../../Types";
import * as privfs from "privfs-client";
import {Inject, Dependencies} from "../../utils/Decorators";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {ComponentFactory} from "../main";
import {FilteredCollection} from "../../utils/collection/FilteredCollection";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface CustomElement {
    id: string;
    label: string;
    icon: {
        type: string,
        value: string
    };
    private: boolean;
    withBorder?: boolean;
    alternative?: boolean;
    emphasized?: boolean;
}

export interface CustomElementListOptions {
    baseCollection: BaseCollection<CustomElement>;
    unreadProvider: (customElement: CustomElement) => number;
    unmutedUnreadProvider?: (conv2Section: CustomElement) => number;
    elementsCountProvider?: (customElement: CustomElement) => number;
    searchCountProvider: (customElement: CustomElement) => number;
    searchAllSearchedProvider?: (customElement: CustomElement) => boolean;
    withSpinnerProvider?: (section: CustomElement) => boolean;
}

export interface CustomElementBeforeActivateEvent extends Types.event.Event<boolean> {
    type: "customelementbeforeactivate";
    customElement: CustomElement;
}

export interface CustomElementActivatedEvent extends Types.event.Event {
    type: "customelementactivated";
    customElement: CustomElement;
}

@Dependencies(["extlist"])
export class CustomElementListController extends ComponentController {
    
    static textsPrefix: string = "component.customElementList.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject componentFactory: ComponentFactory;
    
    customElementsCollection: WithActiveCollection<CustomElement>;
    transformCollection: TransformCollection<Types.webUtils.CustomElementModel, CustomElement>;
    customElements: ExtListController<Types.webUtils.CustomElementModel>;
    customElementsA: ExtListController<Types.webUtils.CustomElementModel>;
    
    constructor(
        parent: Types.app.IpcContainer,
        public options: CustomElementListOptions
    ) {
        super(parent);
        this.customElementsCollection = this.addComponent("customElementsCollection", new WithActiveCollection(this.options.baseCollection));
        this.registerChangeEvent(this.customElementsCollection.changeEvent, this.onCustomElementsCollectionChange);
        this.transformCollection = this.addComponent("transformCollection", new TransformCollection<Types.webUtils.CustomElementModel, CustomElement>(this.customElementsCollection, this.convertCustomElement.bind(this)))
        let normalElements = this.addComponent("normalElements", new FilteredCollection(this.transformCollection, x => !x.alternative));
        this.customElements = this.addComponent("customElements", this.componentFactory.createComponent("extlist", [this, normalElements]));
        this.customElements.ipcMode = true;
        let alternativeElements = this.addComponent("alternativeElements", new FilteredCollection(this.transformCollection, x => x.alternative));
        this.customElementsA = this.addComponent("customElementsA", this.componentFactory.createComponent("extlist", [this, alternativeElements]));
        this.customElementsA.ipcMode = true;
        this.ipcMode = true;
    }
    
    getUnread(customElement: CustomElement): number {
        return this.options.unreadProvider ? this.options.unreadProvider(customElement) : 0;
    }
    
    getUnmutedUnread(customElement: CustomElement): number {
        return this.options.unmutedUnreadProvider ? this.options.unmutedUnreadProvider(customElement) : this.getUnread(customElement);
    }
    
    getElementsCount(customElement: CustomElement): number {
        return this.options.elementsCountProvider ? this.options.elementsCountProvider(customElement) : null;
    }
    
    getSearchCount(customElement: CustomElement): number {
        return this.options.searchCountProvider ? this.options.searchCountProvider(customElement) : 0;
    }
    
    getAllSearched(customElement: CustomElement): boolean {
        return this.options.searchAllSearchedProvider ? this.options.searchAllSearchedProvider(customElement) : true;
    }
    
    getWithSpinner(section: CustomElement): boolean {
        return this.options.withSpinnerProvider ? this.options.withSpinnerProvider(section) : false;
    }
    
    convertCustomElement(model: CustomElement): Types.webUtils.CustomElementModel {
        return {
            id: model.id,
            label: model.label,
            icon: model.icon,
            private: model.private,
            withBorder: model.withBorder,
            unread: this.getUnread(model),
            unmutedUnread: this.getUnmutedUnread(model),
            elementsCount: this.getElementsCount(model),
            searchCount: this.getSearchCount(model),
            allSearched: this.getAllSearched(model),
            withSpinner: this.getWithSpinner(model),
            alternative: model.alternative,
            emphasized: model.emphasized,
        };
    }
    
    onViewActivateCustomElement(customElementId: string): void {
        let section = this.customElementsCollection.find(x => x.id == customElementId);
        if (section == null) {
            return;
        }
        this.setActive(section, true);
    }
    
    getActive(): CustomElement {
        return this.customElementsCollection.getActive();
    }
    
    setActive(customElement: CustomElement, dispatchBeforeEvent: boolean) {
        let result = true;
        if (dispatchBeforeEvent) {
            result = this.dispatchEventResult(<CustomElementBeforeActivateEvent>{
                type: "customelementbeforeactivate",
                customElement: customElement
            });
        }
        if (result !== false) {
            this.customElementsCollection.setActive(customElement);
        }
    }
    
    onCustomElementsCollectionChange(event: Types.utils.collection.CollectionEvent<CustomElement>): void {
        if (event.type == "active" && event.newActive) {
            this.dispatchEvent<CustomElementActivatedEvent>({
                type: "customelementactivated",
                customElement: event.newActive.obj
            });
        }
    }
    
    refresh() {
        this.transformCollection.rebuild();
    }
    
    updateSidebarSpinners(id: string): void {
        let states: { [id: string]: boolean } = {};
        this.customElementsCollection.forEach(x => {
            if (!id || x.id == id) {
                states[x.id] = this.getWithSpinner(x);
            }
        });
        this.callViewMethod("updateSidebarSpinners", JSON.stringify(states));
    }
    
    onViewOpenSettings(customElementId: string): void {
    }
    
}