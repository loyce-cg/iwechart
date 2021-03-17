import {component, utils, window, Types} from "pmc-mail";

export interface Model {
    someData: string;
}


export abstract class BaseItemsPanelController<T, U> extends window.base.WindowComponentController<window.base.BaseWindowController>{
    itemsMergedCollection: utils.collection.MergedCollection<T>;
    itemsProxyCollection: utils.collection.ProxyCollection<T>;
    itemsFilteredCollection: utils.collection.FilteredCollection<T>;
    itemsTransformCollection: utils.collection.TransformCollection<U, T>;
    itemsSortedCollection: utils.collection.SortedCollection<T>;
    itemsActiveCollection: utils.collection.WithActiveCollection<T>;
    items: component.extlist.ExtListController<U>;

    constructor(parent: window.base.BaseWindowController, public personsComponent:  component.persons.PersonsController) {
        super(parent);
        this.ipcMode = true;

        this.itemsMergedCollection = this.addComponent("mergedCollection", new utils.collection.MergedCollection());
        this.itemsProxyCollection = this.addComponent("proxyCollection", new utils.collection.ProxyCollection(this.itemsMergedCollection));
        this.itemsFilteredCollection = this.addComponent("filteredCollection", new utils.collection.FilteredCollection(this.itemsProxyCollection, this.filterEntry.bind(this)));
    
        this.itemsSortedCollection = this.addComponent("sortedCollection", new utils.collection.SortedCollection(this.itemsFilteredCollection, this.sortEntry.bind(this)));
        this.itemsActiveCollection = this.addComponent("activeCollection", new utils.collection.WithActiveCollection(this.itemsSortedCollection));
        this.itemsTransformCollection = this.addComponent("transformCollection", new utils.collection.TransformCollection<U, T>(this.itemsActiveCollection, this.convertEntry.bind(this)));

        this.items = this.addComponent("items", this.componentFactory.createComponent("extlist", [this, this.itemsTransformCollection]));
        this.items.ipcMode = true;


        this.registerChangeEvent(this.itemsActiveCollection.changeEvent, (event) => {
            this.onActiveCollectionChange(event);
        });

    }

    public addBaseCollection(collection: utils.collection.BaseCollection<T>): void {
        this.itemsMergedCollection.addCollection(collection);
    }

    protected abstract filterEntry(entry: T): boolean;
    protected abstract convertEntry(entry: T): U;
    protected abstract sortEntry(a: U, b: U): number;
    protected abstract onActiveCollectionChange(event: Types.utils.collection.CollectionEvent<T>): void;

}