import { MindmapNode } from "./MindmapNode";
import { NodeRenderer } from "./NodeRenderer";
import { Rect } from "./Rect";
import { Mindmap } from "./Mindmap";
import * as $ from "jquery";

export class MindmapRenderer {
    
    protected _isFrozen: boolean = false;
    protected rootNodeRenderer: NodeRenderer = new NodeRenderer(null, this);
    
    constructor(public mindmap: Mindmap, public $mindmapContainer: JQuery, public $nodesContainer: JQuery, public $hiddenNodesContainer: JQuery, public $svg: JQuery, public formatText: (str: string) => string) {
    }
    
    freeze(): void {
        this._isFrozen = true;
    }
    
    unfreeze(): void {
        if (!this._isFrozen) {
            return;
        }
        this._isFrozen = false;
        this.render();
    }
    
    isFrozen(): boolean {
        return this._isFrozen;
    }
    
    render(): void {
        let t: number[] = [];
        let ft = (key: string = null) => {
            t.push(performance.now());
            if (key) {
                console.log(key, t[t.length - 1] - t[t.length - 2]);
            }
        };
        ft = () => {};
        ft();
        
        // Style
        let styleName = this.mindmap.getStyleName();
        this.$mindmapContainer.closest(".component-mindmap-editor").attr("data-style-name", styleName);
        this.$mindmapContainer.closest(".window-mindmap-editor").closest("body").attr("data-style-name", styleName);
        ft("style");
        
        // Create html elements
        this.rootNodeRenderer.recursiveCreateHtmlElement();
        ft("html")
        
        // Calculate boxes
        this.rootNodeRenderer.recursiveCalculateLabelBoxSize();
        ft("labelBoxes")
        this.rootNodeRenderer.recursiveCalculateChildrenAndNodeBoxSizes();
        ft("childrenAndNodeBoxes")
        this.rootNodeRenderer.recursiveCalculateBoxCoordinates(new Rect(0, 0, this.rootNodeRenderer.nodeBox.width, this.rootNodeRenderer.nodeBox.height));
        ft("coords")
        
        // Render html elements
        this.rootNodeRenderer.recursiveRender();
        ft("render")
        
        // Create svg elements
        this.rootNodeRenderer.recursiveUpdateSvgElements();
        ft("svgElements");
        
        // Calculate and set svg size
        this.recalculateSvgSize(false);
        ft("svgSize");
    }
    
    recalculateSvgSize(recalcNodeBoxes: boolean = true): void {
        if (recalcNodeBoxes) {
            this.rootNodeRenderer.recursiveCalculateChildrenAndNodeBoxSizes();
            this.rootNodeRenderer.recursiveCalculateBoxCoordinates(new Rect(0, 0, this.rootNodeRenderer.nodeBox.width, this.rootNodeRenderer.nodeBox.height));
        }
        this.$svg
            .attr("width", this.rootNodeRenderer.nodeBox.width + parseFloat(this.$nodesContainer.css("right")))
            .attr("height", this.rootNodeRenderer.nodeBox.height + parseFloat(this.$nodesContainer.css("bottom")));
    }
    
    updateSelection(selectedNodes: MindmapNode[]): void {
        // Deselect
        let childNodes = this.$nodesContainer.find(".node.selected");
        for (let i = 0; i < childNodes.length; ++i) {
            let $node = $(childNodes[i]);
            let nodeRenderer: NodeRenderer = $node.data("nodeRenderer");
            if (selectedNodes.indexOf(nodeRenderer.node) < 0) {
                $node.removeClass("selected");
            }
        }
        
        // Select
        for (let node of selectedNodes) {
            node.getRenderer().$node.addClass("selected");
            node.focus();
        }
    }
    
    updateCutNodes(cutNodes: MindmapNode[]): void {
        // Deselect
        let childNodes = this.$nodesContainer.find(".node.cut");
        for (let i = 0; i < childNodes.length; ++i) {
            let $node = $(childNodes[i]);
            let nodeRenderer: NodeRenderer = $node.data("nodeRenderer");
            if (cutNodes.indexOf(nodeRenderer.node) < 0) {
                $node.removeClass("cut");
            }
        }
        
        // Select
        for (let node of cutNodes) {
            node.getRenderer().$node.addClass("cut");
        }
    }
    
}
