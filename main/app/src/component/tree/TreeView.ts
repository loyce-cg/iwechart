import {ComponentView} from "../base/ComponentView";
import * as $ from "jquery";
import {app, webUtils, utils} from "../../Types";
import {Tree, Model} from "./TreeController";

export interface Options<T> {
    mainTemplate: webUtils.MailTemplateDefinition<T>;
    sorter?: (a: HTMLElement, b: HTMLElement) => number;
}

export class TreeView<T extends {id: string, parentId: string}> extends ComponentView {
    
    mainTemplate: webUtils.MailTemplate<T>;
    $container: JQuery;
    sorter: (a: HTMLElement, b: HTMLElement) => number;
    
    constructor(parent: app.ViewParent, options: Options<T>) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(options.mainTemplate);
        this.sorter = options.sorter || ((a, b) => {
            return ("" + $(a).data("name")).localeCompare("" + $(b).data("name"));
        });
    }
    
    finalizeRender(): void {
        if (!this.performingControllerCalls) {
            this.finalizeControllerCall();
        }
    }
    
    finalizeControllerCall(): void {
        this.dispatchEvent({type: "change"});
    }
    
    init(model: Model<T>): void {
        this.render(model.tree, model.activeId);
    }
    
    render(tree: Tree<T>, activeId: string): void {
        this.$container.empty();
        this.addTree(tree, activeId);
    }
    
    addTree(tree: Tree<T>, activeId: string): void {
        this.add(tree.value, tree.value.id == activeId);
        tree.children.forEach(x => {
            this.addTree(x, activeId);
        });
    }
    
    sortTree($parent: JQuery): void {
        if ($parent.hasClass("pf-scrollable")) {
            $parent = $parent.children(".pf-content");
        }
        let children = $parent.children().detach().toArray();
        children.sort(this.sorter);
        children.forEach(x => {
            $parent.append(x);
        });
    }
    
    add(element: T, isActive: boolean, $children?: JQuery): void {
        let $parent = this.$container.find("[data-tree-id='" + element.parentId + "'] > .tree-children");
        if ($parent.length == 0) {
            $parent = this.$container;
        }
        if ($parent.hasClass("pf-scrollable")) {
            $parent = $parent.children(".pf-content");
        }
        let $newEle = this.mainTemplate.renderToJQ(element, isActive);
        if ($children) {
            $newEle.find("> .tree-children").append($children);
        }
        $parent.append($newEle);
        this.sortTree($parent);
        this.finalizeRender();
    }
    
    update(element: T, isActive: boolean): void {
        let $ele = this.$container.find("[data-tree-id='" + element.id + "']");
        let $children = $ele.find("> .tree-children").children().detach();
        $ele.remove();
        this.add(element, isActive, $children);
        this.finalizeRender();
    }
    
    remove(element: T): void {
        this.$container.find("[data-tree-id='" + element.id + "']").remove();
        this.finalizeRender();
    }
    
    active(_oldEntry: utils.collection.Entry<T>, newEntry: utils.collection.Entry<T>): void {
        this.$container.find(".active").removeClass("active")
        if (newEntry) {
            this.$container.find("[data-tree-id='" + newEntry.obj.id + "']").addClass("active");
        }
        this.finalizeRender();
    }
}
