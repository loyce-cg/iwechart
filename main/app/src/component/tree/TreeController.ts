import {ComponentController} from "../base/ComponentController";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {app, utils} from "../../Types";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Tree<T> {
    value: T;
    children: Tree<T>[];
}

export interface Model<T> {
    tree: Tree<T>;
    activeId: string;
}

export interface BaseType {
    id: string;
    parentId: string;
}

export class TreeController<T extends BaseType> extends ComponentController {
    
    static textsPrefix: string = "component.tree.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(
        parent: app.IpcContainer,
        public rootId: string,
        public collection: BaseCollection<T>,
        public getActiveId: () => string
    ) {
        super(parent);
        this.ipcMode = true;
        this.registerChangeEvent(this.collection.changeEvent, this.onChange.bind(this));
    }
    
    getModel(): Model<T> {
        let tree: Tree<T> = {
            value: this.collection.find(x => x.id == this.rootId),
            children: []
        };
        this.addTrees(tree);
        return {
            tree: tree,
            activeId: this.getActiveId()
        };
    }
    
    addTrees(tree: Tree<T>): void {
        this.collection.forEach(x => {
            if (x.parentId == tree.value.id) {
                let xTree: Tree<T> = {
                    value: x,
                    children: []
                };
                tree.children.push(xTree);
                this.addTrees(xTree);
            }
        });
    }
    
    onChange(event: utils.collection.CollectionEvent<T>) {
        if (event.type == "add") {
            this.callViewMethod("add", event.element, event.element.id == this.getActiveId());
        }
        else if (event.type == "update") {
            this.callViewMethod("update", event.element, event.element.id == this.getActiveId());
        }
        else if (event.type == "remove") {
            this.callViewMethod("remove", event.element);
        }
        else if (event.type == "active") {
            this.callViewMethod("active", event.oldActive, event.newActive);
        }
    }
}

