import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./SectionSummaryWindowController";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import * as $ from "jquery";
import { ComponentView } from "../../component/base/ComponentView";
import { Lang } from "../../utils/Lang";
import * as Q from "q";
import { SplitterView } from "../../component/splitter/SplitterView";
import { PersonsView } from "../../component/persons/PersonsView";
import { PersonTooltipView } from "../../component/persontooltip/web";

declare var c: any;

export interface ModuleView extends ComponentView {
    order: number;
    $container: JQuery;
}

@WindowView
export class SectionSummaryWindowView extends BaseWindowView<Model> {
    chatComponentView: ComponentView;
    
    modules: {[id: string]: ModuleView};
    $modulesContainer: JQuery;
    $leftSplitter: SplitterView;
    $rightSplitter: SplitterView;
    $splitters: SplitterView[] = [];
    $placeholders: JQuery[] = [];
    activeModulesCount: number;
    useAutoResizer: boolean = true;
    personsComponent: PersonsView;
    personTooltip: PersonTooltipView;
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.helper));
        this.personTooltip = new PersonTooltipView(this.templateManager, this.personsComponent);
        this.modules = {};
        if (this.useAutoResizer) {
            this.useAutoResizer = !!(<any>window).ResizeObserver;
        }
    }
    
    initWindow(model: Model) {
        this.$main.on("click", "[data-action=close]", this.onCloseClick.bind(this));
        this.$main.on("click", "[data-action=ok]", this.onOkClick.bind(this));
        this.$modulesContainer = this.$main.find(".modules-container");  
        this.$main.toggleClass("single-mode", model.singleMode);
        this.bindKeyPresses();
        if (this.useAutoResizer) {
            let resizeObserver = new (<any>window).ResizeObserver((entries: any) => {
                let entry = entries[0];
                if (entry) {
                    let h = entry.contentRect.width;
                    this.onWidthChanged(h);
                }
            });
            resizeObserver.observe(this.$main[0]);
        }
        return Q().then(() => {
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            let modulesCount = model.activeModules.length;
            this.activeModulesCount = modulesCount;
            for (let x = 0; x < modulesCount - 1; ++x) {
                let splitter = this.addComponent("splitter-" + x, new SplitterView(this, {type: "vertical", handlePlacement: "right", handleDot: true}));
                this.$splitters.push(splitter);
                if (this.useAutoResizer) {
                    splitter.onRedraw(this.updateAutoResizerData.bind(this));
                }
            }
            
            let splittersPromise = Q();
            let prev: SplitterView = null;
            if (modulesCount == 1) {
                this.$placeholders.push(this.$modulesContainer);
            }
            this.$splitters.forEach( (x, _i, _arr) => {
                splittersPromise = splittersPromise.then(() => {
                    x.$container = prev ? prev.$right : this.$modulesContainer;
                    prev = x;
                    return x.triggerInit()
                    .then(() => {
                        this.$placeholders.push(x.$left);
                        if (_i == this.$splitters.length -1) {
                            this.$placeholders.push(x.$right);
                        }
                        return;
                    })
                });
            })
            return splittersPromise
            .then(() => {
                let currentModule: number = 0;
                let modulesToShow: {[id: string]: ModuleView} = {};
                if (this.useAutoResizer) {
                    this.updateAutoResizerData();
                }
                for (let id in this.modules) {
                    if (model.activeModules.indexOf(id) > -1) {
                        modulesToShow[id] = this.modules[id];
                    }
                }
                return Q.all(Lang.getValues(modulesToShow).map(ele => {
                    return ele.triggerInit().then(() => {
                        let moduleIdx = this.getModuleInitOrderId(model, ele);
                        this.$placeholders[moduleIdx].append(ele.$container);
                        return;
                    });
                }))
            })
            
        })
        .then(() => {
            return this.personTooltip.init(this.$main);
        })
        .then(() => {
            this.personsComponent.refreshAvatars();
            return;
        })
    }
    
    getModuleInitOrderId(model: Model, x: ModuleView): number {
        let order: number = 0;
        for(let id in this.modules) {
            if (model.activeModules.indexOf(id) > -1 && this.modules[id].order < x.order) {
                order++;
            }
        }
        return order;
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    registerModule(id: string, moduleView: ModuleView) {
        if (id in this.modules) {
            throw new Error("Already registered uhnder id " + id);
        }
        this.modules[id] = this.addComponent("module-component-" + id, moduleView);
    }
    
    setName(name: string): void {
        this.$main.find(".name .text").html(name);
    }

    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onOkClick(): void {
        this.triggerEvent("ok");
    }
    
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.enter) {
                e.preventDefault();
                this.onOkClick();
            }
        });
    }
    
    onWidthChanged(w: number): void {
        this.updateSplitterElementsWidths(0, w);
    }
    
    updateAutoResizerData(): void {
            for (let i = 0; i < this.$splitters.length; ++i) {
            let splitter = this.$splitters[i];
            if (!splitter || !splitter.$left) {
                return;
            }
            let lw = splitter.$left.width();
            let rw = splitter.$right.width();
            splitter.$left.data("autoresizer-width", lw);
            splitter.$right.data("autoresizer-width", rw);
        }
    }
    
    updateSplitterElementsWidths(splitterId: number, w: number) {
        let splitter = this.$splitters[splitterId];
        if (!splitter || !splitter.$left) {
            return;
        }
        let lw = splitter.$left.data("autoresizer-width");
        let rw = splitter.$right.data("autoresizer-width");
        let lw2 = w * lw / (lw + rw);
        let rw2 = w * rw / (lw + rw);
        splitter.$left.data("autoresizer-width", lw2);
        splitter.$right.data("autoresizer-width", rw2);
        this.updateSplitterElementsWidths(splitterId + 1, rw2);
        splitter.setFirstElementSize(lw2);
    }
    
}
