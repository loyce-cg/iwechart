import { Mindmap } from "./Mindmap";
import { MindmapNode } from "./MindmapNode";
import * as $ from "jquery";
import Q = require("q");

export class Rect {
    
    constructor(public x0: number, public y0: number, public width: number, public height: number) {
    }
    
    get x1(): number {
        return this.x0 + this.width;
    }
    
    get y1(): number {
        return this.y0 + this.height;
    }
    
}

export class NodeRenderer {
    
    static DESCENDANT_OFFSET: number = 32; // Distance in pixels between two nodes in parent-child relationship
    static NODE_TOTAL_HORIZONTAL_MARGINS: number = null; // Horizontal distance in pixels between two nodes
    static NODE_TOTAL_VERTICAL_MARGINS: number = null; // Vertical distance in pixels between two nodes
    static DEBUG_RECTS: boolean = true;
    
    public labelBox: Rect;
    public childrenBox: Rect;
    public boundingBox: Rect;
    public parent: NodeRenderer;
    public children: NodeRenderer[] = [];
    public $node: JQuery;
    
    constructor(public node: MindmapNode, public escapeHtmlFunc: (str: string) => string) {
        //node.setRenderer(this);
    }
    
    isRootNode(): boolean {
        return this.node == null;
    }
    
    refreshClasses(invisible: boolean = false): void {
        if (this.isRootNode()) {
            return;
        }
        this.$node.toggleClass("collapsed", !!this.node.collapsed);
        this.$node.toggleClass("important", !!this.node.important);
        this.$node.toggleClass("invisible", !!invisible);
        
        let styleClass = "style-" + this.node.style;
        if (!this.node.style || !this.$node.hasClass(styleClass)) {
            this.removeClassesByPrefix("style-", styleClass);
            if (this.node.style) {
                this.$node.addClass(styleClass);
            }
        }
        
        let taskStateClass = "task-state-" + this.node.taskState;
        if (!this.node.taskState || !this.$node.hasClass(taskStateClass)) {
            this.removeClassesByPrefix("task-state-", taskStateClass);
            if (this.node.taskState) {
                this.$node.addClass(taskStateClass);
            }
        }
    }
    
    removeClassesByPrefix(prefix: string, safeClass: string = null): void {
        let node = this.$node[0];
        let classesToRemove: string[] = [];
        for (let i = 0; i < node.classList.length; ++i) {
            if (node.classList[i].substr(0, prefix.length) == prefix) {
                classesToRemove.push(node.classList[i]);
            }
        }
        for (let cls of classesToRemove) {
            node.classList.remove(cls);
        }
    }
    
    refreshClassesRecursive(invisible: boolean = false): void {
        this.refreshClasses(invisible);
        
        // Recursive
        for (let child of this.children) {
            child.refreshClassesRecursive(invisible || (this.node && this.node.collapsed));
        }
    }
    
    collectChildrenRecursive(childNodes: MindmapNode[]): void {
        for (let childNode of childNodes) {
            // Create child node and create parent-child relationship
            let renderedNode = new NodeRenderer(childNode, this.escapeHtmlFunc);
            this.children.push(renderedNode);
            renderedNode.parent = this;
            
            // Recursive
            renderedNode.collectChildrenRecursive(childNode.nodes);
        }
    }
    
    createHtmlElementsRecursive($hiddenNodesContainer: JQuery, invisible: boolean = false): void {
        // Create html element for this node
        this.$node = $(`<div class="node"></div>`);
        if (!this.isRootNode()) {
            this.$node.html(this.escapeHtmlFunc(this.node.label));
            this.refreshClasses(invisible);
        }
        $hiddenNodesContainer.append(this.$node);
        
        // Recursive
        for (let child of this.children) {
            child.createHtmlElementsRecursive($hiddenNodesContainer, invisible || (this.node && this.node.collapsed));
        }
    }
    
    calculateLabelBoxesRecursive(): void {
        // Calculate label box for this node
        if (this.isRootNode()) {
            this.labelBox = new Rect(0, 0, 0, 0);
            if (NodeRenderer.NODE_TOTAL_HORIZONTAL_MARGINS === null) {
                NodeRenderer.NODE_TOTAL_HORIZONTAL_MARGINS = parseFloat(this.$node.css("marginLeft")) + parseFloat(this.$node.css("marginRight"));
                NodeRenderer.NODE_TOTAL_VERTICAL_MARGINS = parseFloat(this.$node.css("marginTop")) + parseFloat(this.$node.css("marginBottom"));
            }
        }
        else {
            this.labelBox = new Rect(0, 0, this.$node.outerWidth(true), this.$node.outerHeight(true));
        }
        
        // Recursive
        for (let child of this.children) {
            child.calculateLabelBoxesRecursive();
        }
    }
    
    calculateBoundingBoxesRecursive(): void {
        // Recursive
        for (let child of this.children) {
            child.calculateBoundingBoxesRecursive();
        }
        
        // Calculate bounding box for this node
        let width = this.isRootNode() ? 0 : this.labelBox.width;
        let height = this.isRootNode() ? 0 : this.labelBox.height;
        if (this.children.length > 0 && (!this.node || !this.node.collapsed)) {
            // Calculate max child width and sum children height
            let maxChildWidth: number = 0;
            let childrenHeightSum: number = 0;
            for (let child of this.children) {
                maxChildWidth = Math.max(maxChildWidth, child.boundingBox.width);
                childrenHeightSum += child.boundingBox.height;
            }
            
            // Add max children width and some horizontal space for the relationship line
            width += maxChildWidth + NodeRenderer.DESCENDANT_OFFSET;
            
            // Calculate height
            height = Math.max(height, childrenHeightSum);
            
            // Calculate children bounding box
            this.childrenBox = new Rect(
                0,
                0,
                width - this.labelBox.width - NodeRenderer.DESCENDANT_OFFSET,
                childrenHeightSum
            );
        }
        else {
            this.childrenBox = new Rect(0, 0, 0, 0);
        }
        this.boundingBox = new Rect(0, 0, width, height);
    }
    
    calculateCoordsRecursive(availableRect: Rect): void {
        // Bounding box x, y
        this.boundingBox.x0 = availableRect.x0;
        this.boundingBox.y0 = availableRect.y0;
        
        // Label box x, y
        this.labelBox.x0 = this.boundingBox.x0;
        this.labelBox.y0 = this.boundingBox.y0 + Math.max(0, availableRect.height - this.labelBox.height) / 2;
        
        // Children box x, y
        this.childrenBox.x0 = this.isRootNode() ? 0 : (this.labelBox.x1 + NodeRenderer.DESCENDANT_OFFSET);
        this.childrenBox.y0 = this.boundingBox.y0 + Math.max(0, availableRect.height - this.childrenBox.height) / 2;
        
        // Recursive
        let currentY: number = this.childrenBox.y0;
        if (NodeRenderer.DEBUG_RECTS) {
            this.debugRect("av", availableRect);
            this.debugRect("lb", this.labelBox);
            this.debugRect("cb", this.childrenBox);
            this.debugRect("bb", this.boundingBox);
        }
        for (let child of this.children) {
            let rect: Rect = new Rect(
                this.childrenBox.x0,
                currentY,
                this.childrenBox.width,
                child.boundingBox.height
            );
            if (NodeRenderer.DEBUG_RECTS) {
                this.debugRect("*", rect);
            }
            child.calculateCoordsRecursive(rect);
            currentY += child.boundingBox.height;
        }
    }
    
    renderHtmlElementsRecursive($nodes: JQuery): void {
        if (!this.isRootNode()) {
            $nodes.append(this.$node);
        }
        
        // Recursive
        for (let child of this.children) {
            child.renderHtmlElementsRecursive($nodes);
        }
    }
    
    arrangeHtmlElementsRecursive(): void {
        // Arrange
        this.$node.css({
            left: this.labelBox.x0 + "px",
            top: this.labelBox.y0 + "px",
            width: (this.labelBox.width - NodeRenderer.NODE_TOTAL_HORIZONTAL_MARGINS) + "px",
            height: (this.labelBox.height - NodeRenderer.NODE_TOTAL_VERTICAL_MARGINS) + "px",
        })
        
        // Recursive
        for (let child of this.children) {
            child.arrangeHtmlElementsRecursive();
        }
    }
    
    createSvgPathsRecursive(svgPaths: string[]) {
        if (!this.isRootNode() && this.node.collapsed) {
            return;
        }
        
        // Create and add path to the list
        if (!this.isRootNode() && this.children.length > 0) {
            let cx = this.labelBox.x0 + this.labelBox.width;
            let cy = this.labelBox.y0 + this.labelBox.height / 2;
            let HSPACE = NodeRenderer.DESCENDANT_OFFSET;
            let path = "";
            for (let child of this.children) {
                let cy2 = child.labelBox.y0 + child.labelBox.height / 2;
                path += "M " + cx + " " + cy + " C " + (cx + 0.9 * HSPACE) + " " + cy + " " + (cx + 0.4 * HSPACE) + " " + (cy2) + " " + " " + (cx + HSPACE) + " " + (cy2);
            }
            svgPaths.push(path);
        }
        
        // Recursive
        for (let child of this.children) {
            child.createSvgPathsRecursive(svgPaths);
        }
    }
    
    debugRect(key: string, rect: Rect): void {
        let [r, g, b] = this.debugRandColor();
        let $e = $(`<div style="display:none;overflow:hidden;font-size:11px;pointer-events:none;z-index:9999;position:absolute;left:${rect.x0}px;top:${rect.y0}px;width:${rect.width}px;height:${rect.height}px;background:rgba(${r},${g},${b},0.1);text-align:center;line-height:${rect.height}px;border:1px dashed rgba(${r},${g},${b},1.0);"><span style="padding:1px;color:#000;border-radius:100px;background:rgb(${r},${g},${b});">${key}</span></div>`)
        $(".nodes").append($e)
        this.$node.hover(
            () => {
                $e.css("display", "block");
            },
            () => {
                $e.css("display", "none");
            }
        );
    }
    
    debugRandColor(): [number, number, number] {
        let r: number, g: number, b: number;
        do {
            r = Math.round(Math.random() * 255);
            g = Math.round(Math.random() * 255);
            b = Math.round(Math.random() * 255);
        } while (r + g + b < 255);
        return [r, g, b];
    }
    
}
