import { Mindmap } from "./Mindmap";
import * as $ from "jquery";
import Q = require("q");
import { NodeRenderer } from "./OldNodeRenderer";

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

export class MindmapRenderer {
    
    constructor(public $mindmap: JQuery, public $nodes: JQuery, public $hiddenNodes: JQuery, public $svg: JQuery, public escapeHtmlFunc: (str: string) => string) {
    }
    
    renderMindmap(mindmap: Mindmap): void {
        let t: number[] = [];
        let ft = (key: string = null) => {
            t.push(performance.now());
            if (key) {
                console.log(key, t[t.length - 1] - t[t.length - 2]);
            }
        };
        ft();
        
        // Style
        this.$mindmap.closest(".component-mindmap-editor").attr("data-style-name", mindmap.style ? mindmap.style.name : "default");
        ft("style");
        
        // Create tree of RenderedNode instances
        let rootNode = new NodeRenderer(null, this.escapeHtmlFunc);
        rootNode.collectChildrenRecursive(mindmap.elements.map(x => x.spec));
        ft("tree")
        
        // Create html elements
        rootNode.createHtmlElementsRecursive(this.$hiddenNodes);
        ft("html")
        
        // Calculate label sizes
        rootNode.calculateLabelBoxesRecursive();
        ft("labelBoxes")
        
        // From leaves to root: calculate total sizes
        rootNode.calculateBoundingBoxesRecursive();
        ft("boundingBoxes")
        
        // From root to leaves: calculate coords
        rootNode.calculateCoordsRecursive(new Rect(0, 0, this.$nodes.innerWidth(), this.$nodes.innerHeight()));
        ft("coords")
        
        // Render html elements
        rootNode.renderHtmlElementsRecursive(this.$nodes);
        ft("render");
        
        // Arrange html elements
        rootNode.arrangeHtmlElementsRecursive();
        ft("arrange")
        
        // Create svg paths
        let svgPaths: string[] = [];
        rootNode.createSvgPathsRecursive(svgPaths);
        for (let path of svgPaths) {
            let $path = $(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
            this.$svg.append($path);
            $path.attr("d", path);
        }
        this.$svg
            .attr("width", rootNode.boundingBox.width + parseFloat(this.$nodes.css("right")))
            .attr("height", rootNode.boundingBox.height + parseFloat(this.$nodes.css("bottom")));
        ft("svg");
    }
    
}
