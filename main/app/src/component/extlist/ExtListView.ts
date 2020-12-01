import { ComponentView } from "../base/ComponentView";
import { Template } from "../../web-utils/template/Template";
import { BaseCollection } from "../../utils/collection/BaseCollection";
import { utils, webUtils } from "../../Types";
import { MailClientViewHelper } from "../../web-utils/MailClientViewHelper";
import { app } from "../../Types";
import { Model } from "./ExtListController";

export interface Context<T, E = void, H = MailClientViewHelper> {
    index: number;
    isActive: boolean;
    listView: ExtListView<T, E, H>;
}

export interface Options<T, E = void, H = MailClientViewHelper> {
    template: webUtils.TemplateDefinition<T, Context<T, E, H>, H>;
    extra?: E;
    onAfterListRender?: (view: ExtListView<T, E, H>) => void;
    emptyTemplate?: webUtils.TemplateDefinition<any, any, any>;
    onEmptyChange?: (view: ExtListView<T, E, H>) => void;
    preserveContainers?: string[],
}

export interface ExtListChangeEvent {
    type: "ext-list-change";
    actionLevel: number;
}

export class ExtListView<T, E = void, H = MailClientViewHelper> extends ComponentView {

    static MINOR_CHANGE_LEVEL = 1;
    static MAJOR_CHANGE_LEVEL = 2;

    mainTemplate: Template<T, Context<T, E, H>, H>;
    $container: JQuery;
    extra: E;
    empty: {
        value: boolean;
        template: Template<any, any, any>;
        $element: JQuery;
        callback: (view: ExtListView<T, E, H>) => void;
    }
    calledActionLevel: number;
    preserveContainers: string[];
    // changeDebouncer: NodeJS.Timer;
    // changeDebouncerLastUpdate: number;
    // static CHANGE_EVENT_DEBOUNCE_TIME: number = 100;

    constructor(parent: app.ViewParent, options: Options<T, E, H>) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(options.template);
        this.extra = options.extra;
        this.preserveContainers = options.preserveContainers;
        this.calledActionLevel = 0;
        if (options.onAfterListRender) {
            this.addEventListener<ExtListChangeEvent>("ext-list-change", event => {
                if (event.actionLevel == ExtListView.MAJOR_CHANGE_LEVEL) {
                    // let now = new Date().getTime();
                    // if (!this.changeDebouncerLastUpdate) {
                    //     this.changeDebouncerLastUpdate = 0;
                    // }

                    // if (now - this.changeDebouncerLastUpdate > ExtListView.CHANGE_EVENT_DEBOUNCE_TIME) {
                    //     options.onAfterListRender(this);
                    //     this.changeDebouncerLastUpdate = now;
                    // }
                    // else {
                    //     if (this.changeDebouncer) {
                    //         clearTimeout(this.changeDebouncer);
                    //         this.changeDebouncer = null;
                    //     }
                    //     this.changeDebouncer = setTimeout(() => {
                    //         options.onAfterListRender(this);
                    //         this.changeDebouncerLastUpdate = new Date().getTime();
                    //     }, ExtListView.CHANGE_EVENT_DEBOUNCE_TIME);
                    // }
                    options.onAfterListRender(this);

                }
            });
        }
        this.empty = {
            value: null,
            template: options.emptyTemplate ? this.templateManager.createTemplate(options.emptyTemplate) : null,
            $element: null,
            callback: options.onEmptyChange
        };
    }

    finalizeRender(actionLevel: number): void {
        if (this.performingControllerCalls) {
            this.calledActionLevel = Math.max(this.calledActionLevel, actionLevel);
        }
        else {
            this.calledActionLevel = actionLevel;
            this.finalizeControllerCall();
        }
    }

    finalizeControllerCall(): void {
        if (this.calledActionLevel > 0) {
            this.dispatchEvent<ExtListChangeEvent>({ type: "ext-list-change", actionLevel: this.calledActionLevel });
        }
        this.calledActionLevel = 0;
    }

    init(list: Model<T>): void {
        this.render(list);
    }

    updateEmpty(value?: boolean) {
        let oldEmpty = this.empty.value;
        this.empty.value = value == null ? this.$container.children().length == 0 : value;
        if (this.empty.value) {
            if (this.empty.template) {
                this.empty.$element = this.empty.template.renderToJQ();
                this.$container.append(this.empty.$element);
            }
        }
        else {
            if (this.empty.$element) {
                this.empty.$element.remove();
                this.empty.$element = null;
            }
        }
        if (oldEmpty !== this.empty.value && this.empty.callback) {
            this.empty.callback(this);
        }
    }

    render(model: Model<T>): void {
        let context: Context<T, E, H> = {
            index: null,
            isActive: false,
            listView: this
        };
        this.$container.empty();
        this.updateEmpty(model.list.length == 0);
        for (let i = 0; i < model.list.length; i++) {
            let element = model.list[i];
            context.index = i;
            context.isActive = i == model.activeIndex;
            let $element = this.mainTemplate.renderToJQ(element, context);
            this.$container.append($element);
        }
        this.finalizeRender(ExtListView.MAJOR_CHANGE_LEVEL);
    }

    add(index: number, isActive: boolean, element: T): void {
        let $element = this.mainTemplate.renderToJQ(element, {
            index: index,
            isActive: isActive,
            listView: this
        });
        this.updateEmpty();
        let $before = this.$container.children().eq(index);
        if ($before.length == 0) {
            this.$container.append($element);
        }
        else {
            $element.insertBefore($before);
        }
        this.finalizeRender(ExtListView.MAJOR_CHANGE_LEVEL);
    }

    remove(index: number, element: T): void {
        this.$container.children().eq(index).remove();
        this.updateEmpty();
        this.finalizeRender(ExtListView.MAJOR_CHANGE_LEVEL);
    }

    update(index: number, isActive: boolean, element: T): void {
        let $element = this.mainTemplate.renderToJQ(element, {
            index: index,
            isActive: isActive,
            listView: this
        });
        let $currentElement = this.$container.children().eq(index);
        if ($currentElement && $currentElement.get(0) && $element.get(0).outerHTML == $currentElement.get(0).outerHTML) {
            return;
        }
        $currentElement.replaceWith($element);
        this.preserve($currentElement, $element);
        this.finalizeRender(ExtListView.MAJOR_CHANGE_LEVEL);
    }

    clear(): void {
        this.$container.empty();
        this.updateEmpty();
        this.finalizeRender(ExtListView.MAJOR_CHANGE_LEVEL);
    }

    active(oldActive: utils.collection.Entry<T>, newActive: utils.collection.Entry<T>): void {
        if (oldActive != null) {
            this.$container.children().eq(oldActive.index).removeClass("active");
        }
        if (newActive != null) {
            this.$container.children().eq(newActive.index).addClass("active");
        }
        this.finalizeRender(ExtListView.MINOR_CHANGE_LEVEL);
    }

    reorganize(indicies: number[]): void {
        let $reorganized = [];
        let $children = this.$container.children();
        for (let i = 0; i < indicies.length; i++) {
            $reorganized[i] = $children.eq(indicies[i]);
        }
        $children.detach();
        for (let i = 0; i < $reorganized.length; i++) {
            this.$container.append($reorganized[i]);
        }
        this.finalizeRender(ExtListView.MINOR_CHANGE_LEVEL);
    }

    move(oldIndex: number, newIndex: number): void {
        let $ele = this.$container.children().eq(oldIndex).detach();
        let $before = this.$container.children().eq(newIndex);
        if ($before.length == 0) {
            this.$container.append($ele);
        }
        else {
            $ele.insertBefore($before);
        }
        this.finalizeRender(ExtListView.MAJOR_CHANGE_LEVEL);
    }

    select(index: number, indicies: number[]): void {
        if (indicies && indicies.length > 0) {
            indicies.forEach(one => {
                this.$container.children().eq(one).addClass("selected");
            })
        } else {
            this.$container.children().eq(index).addClass("selected");
        }
    }

    updateSelected(indicies: number[]): void {
        this.$container.children().removeClass("selected");
        if (indicies && indicies.length > 0) {
            indicies.forEach(one => {
                this.$container.children().eq(one).addClass("selected");
            })
        }
    }

    deselect(index: number, indicies: number[]): void {
        if (indicies && indicies.length > 0) {
            indicies.forEach(one => {
                this.$container.children().eq(one).removeClass("selected");
            })
        } else {
            this.$container.children().eq(index).removeClass("selected");
        }
    }

    preserve($currentElement: JQuery, $element: JQuery): void {
        if (this.preserveContainers) {
            for (let key of this.preserveContainers) {
                let $preserved = $currentElement.find("[data-extlist-preserve-container='" + key + "']");
                $element.find("[data-extlist-preserve-container='" + key + "']").replaceWith($preserved);
            }
        }
    }
}
