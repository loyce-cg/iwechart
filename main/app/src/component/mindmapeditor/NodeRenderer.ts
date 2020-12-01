import { MindmapRenderer } from "./MindmapRenderer";
import { MindmapNode } from "./MindmapNode";
import { Rect } from "./Rect";
import * as $ from "jquery";
import Q = require("q");
import { ContentEditableEditor } from "../../web-utils";
import { BaseWindowView } from "../../window/base/web";
import { ContentEditableEditorMetaData } from "../../web-utils/ContentEditableEditorMetaData";

export class NodeRenderer {
    
    static DESCENDANT_OFFSET: number = 32; // Distance in pixels between two nodes in parent-child relationship
    static NODE_TOTAL_HORIZONTAL_MARGINS: number = null; // Horizontal distance in pixels between two nodes
    static NODE_TOTAL_VERTICAL_MARGINS: number = null; // Vertical distance in pixels between two nodes
    static DEBUG_RECTS: boolean = false;
    
    nodeBox: Rect = new Rect(0, 0, 0, 0);
    labelBox: Rect = new Rect(0, 0, 0, 0);
    childrenBox: Rect = new Rect(0, 0, 0, 0);
    $node: JQuery;
    $svgPath: JQuery<SVGPathElement>;
    $svgCircle: JQuery<SVGCircleElement>;
    protected _editor: ContentEditableEditor = null;
    
    get parent(): NodeRenderer {
        if (this.isRootNode() || !this.node.parentNode) {
            return null;
        }
        return this.getOrCreateNodeRenderer(this.node.parentNode);
    }
    
    get children(): NodeRenderer[] {
        if (this.isRootNode()) {
            return this.mindmapRenderer.mindmap.elements.map(x => this.getOrCreateNodeRenderer(x.spec));
        }
        return this.node.nodes.map(x => this.getOrCreateNodeRenderer(x));
    }
    
    constructor(public node: MindmapNode, public mindmapRenderer: MindmapRenderer) {
        if (!this.isRootNode()) {
            node.setRenderer(this);
        }
    }
    
    getOrCreateNodeRenderer(node: MindmapNode): NodeRenderer {
        let nodeRenderer: NodeRenderer = node.getRenderer();
        if (!nodeRenderer) {
            nodeRenderer = new NodeRenderer(node, this.mindmapRenderer);
            node.setRenderer(nodeRenderer);
        }
        return nodeRenderer;
    }
    
    isRootNode(): boolean {
        return this.node == null;
    }
    
    
    
    
    
    /**************************************************
    ********************* Triggers ********************
    ***************************************************/
    triggerStyleChanged(): void {
        this.triggerLabelChanged(false, true);
    }
    
    triggerContentChanged(): void {
        this.triggerLabelChanged(true, false);
    }
    
    triggerLabelChanged(updateContent: boolean, updateClasses: boolean): void {
        if (this.canRender()) {
            let oldLabelBox = this.labelBox.clone();
            if (updateClasses) {
                this.updateClasses();
            }
            if (updateContent) {
                this.updateContent();
            }
            this.calculateLabelBoxSize();
            if (!this.labelBox.equals(oldLabelBox) || this.parent == null) {
                this.calculateChildrenAndNodeBoxSizes();
                if (this.parent) {
                    this.parent.triggerChildSizeChanged();
                }
                else {
                    this.recursiveCalculateBoxCoordinates(new Rect(0, 0, this.nodeBox.width, this.nodeBox.height));
                    this.recursiveRender();
                    this.recursiveUpdateSvgElements();
                    this.updateSvgSize();
                }
            }
        }
    }
    
    triggerChildSizeChanged(): void {
        this.triggerChildrenChanged();
    }
    
    triggerChildListChanged(): void {
        this.triggerChildrenChanged();
    }
    
    triggerChildrenChanged(): void {
        let oldNodeBox = this.nodeBox.clone();
        this.calculateChildrenAndNodeBoxSizes();
        if (!this.nodeBox.equals(oldNodeBox) && this.parent) {
            this.parent.triggerChildSizeChanged();
        }
        else {
            let renderer = this.parent ? this.parent : this;
            renderer.recursiveCalculateBoxCoordinates(new Rect(renderer.nodeBox.x0, renderer.nodeBox.y0, renderer.nodeBox.width, renderer.nodeBox.height));
            this.updateSvgSize();
            renderer.recursiveRender();
            renderer.recursiveUpdateSvgElements();
        }
    }
    
    triggerCollapsedChanged(): void {
        this.triggerStyleChanged();
        this.recursiveUpdateClasses();
    }
    
    triggerNodeCreated(): void {
        this.createHtmlElement();
        this.calculateLabelBoxSize();
        this.calculateChildrenAndNodeBoxSizes();
    }
    
    
    
    
    
    /**************************************************
    ******************** Rendering ********************
    ***************************************************/
    canRender(): boolean {
        return !this.mindmapRenderer.isFrozen();
    }
    
    updateContent(): void {
        if (this.isRootNode()) {
            return;
        }
        this.updateNodeHtml();
    }
    
    updateNodeHtml(): void {
        if (!this.$node) {
        return;
        }
        let metaDataStr = "";
        if (this.node.metaDataStr) {
            metaDataStr = `<${ContentEditableEditorMetaData.META_DATA_TAG_NAME} value="${encodeURIComponent(this.node.metaDataStr)}"></${ContentEditableEditorMetaData.META_DATA_TAG_NAME}>`;
        }
        this.$node.html(this.mindmapRenderer.formatText(metaDataStr + this.node.label));
    }
    
    updateClasses(): void {
        if (this.isRootNode()) {
            return;
        }
        this.$node.toggleClass("collapsed", !!this.node.collapsed);
        this.$node.toggleClass("important", !!this.node.important);
        this.$node.toggleClass("invisible", !this.node.isVisible());
        
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
    
    createHtmlElement(): void {
        let newElement = !this.$node;
        if (newElement) {
            this.$node = $(`<div class="node" tabindex="-1"></div>`);
            this.$svgPath = $(document.createElementNS("http://www.w3.org/2000/svg", "path"));
            this.$svgCircle = $(document.createElementNS("http://www.w3.org/2000/svg", "circle"));
            
            this.$node.data("nodeRenderer", this);
        }
        if (!this.isRootNode()) {
            this.updateNodeHtml();
            this.updateClasses();
        }
        if (newElement) {
            this.mindmapRenderer.$hiddenNodesContainer.append(this.$node);
            this.mindmapRenderer.$svg.append(this.$svgPath);
            this.mindmapRenderer.$svg.append(this.$svgCircle);
        }
    }
    
    calculateLabelBoxSize(): void {
        if (this.isRootNode()) {
            this.labelBox.x0 = 0;
            this.labelBox.y0 = 0;
            this.labelBox.width = 0;
            this.labelBox.height = 0;
            if (NodeRenderer.NODE_TOTAL_HORIZONTAL_MARGINS === null) {
                NodeRenderer.NODE_TOTAL_HORIZONTAL_MARGINS = parseFloat(this.$node.css("marginLeft")) + parseFloat(this.$node.css("marginRight"));
                NodeRenderer.NODE_TOTAL_VERTICAL_MARGINS = parseFloat(this.$node.css("marginTop")) + parseFloat(this.$node.css("marginBottom"));
            }
        }
        else {
            this.clearCssBoxSize();
            if (this.$node.parent().length == 0) {
                //this.mindmapRenderer.$hiddenNodesContainer.append(this.$node);
            }
            this.labelBox.x0 = 0;
            this.labelBox.y0 = 0;
            this.labelBox.width = this.$node.outerWidth(true);
            this.labelBox.height = this.$node.outerHeight(true);
        }
    }
    
    calculateChildrenAndNodeBoxSizes(): void {
        let width = this.isRootNode() ? 0 : this.labelBox.width;
        let height = this.isRootNode() ? 0 : this.labelBox.height;
        if (this.children.length > 0 && (!this.node || !this.node.collapsed)) {
            // Calculate max child width and sum children height
            let maxChildWidth: number = 0;
            let childrenHeightSum: number = 0;
            for (let child of this.children) {
                maxChildWidth = Math.max(maxChildWidth, child.nodeBox.width);
                childrenHeightSum += child.nodeBox.height;
            }
            
            // Add max children width and some horizontal space for the relationship line
            width += maxChildWidth + NodeRenderer.DESCENDANT_OFFSET;
            
            // Calculate height
            height = Math.max(height, childrenHeightSum);
            
            // Calculate children bounding box
            this.childrenBox.x0 = 0;
            this.childrenBox.y0 = 0;
            this.childrenBox.width = width - this.labelBox.width - NodeRenderer.DESCENDANT_OFFSET;
            this.childrenBox.height = childrenHeightSum;
        }
        else {
            this.childrenBox.x0 = 0;
            this.childrenBox.y0 = 0;
            this.childrenBox.width = 0;
            this.childrenBox.height = 0;
        }
        this.nodeBox.x0 = 0;
        this.nodeBox.y0 = 0;
        this.nodeBox.width = width;
        this.nodeBox.height = height;
    }
    
    calculateBoxCoordinates(availableBox: Rect): void {
        // Bounding box x, y
        this.nodeBox.x0 = availableBox.x0;
        this.nodeBox.y0 = availableBox.y0;
        
        // Label box x, y
        this.labelBox.x0 = this.nodeBox.x0;
        this.labelBox.y0 = this.nodeBox.y0 + Math.max(0, availableBox.height - this.labelBox.height) / 2;
        
        // Children box x, y
        this.childrenBox.x0 = this.isRootNode() ? 0 : (this.labelBox.x1 + NodeRenderer.DESCENDANT_OFFSET);
        this.childrenBox.y0 = this.nodeBox.y0 + Math.max(0, availableBox.height - this.childrenBox.height) / 2;
    }
    
    updateSvgElements() {
        if (this.isRootNode()) {
            return;
        }
        
        let invisible = !this.node.isVisible();
        this.$svgPath.css("visibility", !this.node.collapsed && !invisible ? "visible" : "hidden");
        this.$svgCircle.css("visibility", this.node.collapsed && !invisible ? "visible" : "hidden");
        
        // Path
        let cx = this.labelBox.x0 + this.labelBox.width;
        let cy = this.labelBox.y0 + this.labelBox.height / 2;
        let HSPACE = NodeRenderer.DESCENDANT_OFFSET;
        let path = "";
        for (let child of this.children) {
            let cy2 = child.labelBox.y0 + child.labelBox.height / 2;
            path += "M " + cx + " " + cy + " C " + (cx + 0.9 * HSPACE) + " " + cy + " " + (cx + 0.4 * HSPACE) + " " + (cy2) + " " + " " + (cx + HSPACE) + " " + (cy2);
        }
        this.$svgPath.attr("d", path);
        
        // Circle
        this.$svgCircle.attr("cx", cx + 5).attr("cy", cy).attr("r", 3);
    }
    
    render(): void {
        if (this.$node.parent()[0] != this.mindmapRenderer.$nodesContainer[0]) {
            this.mindmapRenderer.$nodesContainer.append(this.$node);
        }
        this.$node.css({
            left: this.labelBox.x0 + "px",
            top: this.labelBox.y0 + "px",
            width: (this.labelBox.width - NodeRenderer.NODE_TOTAL_HORIZONTAL_MARGINS) + "px",
            height: (this.labelBox.height - NodeRenderer.NODE_TOTAL_VERTICAL_MARGINS) + "px",
        });
    }
    
    clearCssBoxSize(): void {
        this.$node.css({
            width: "initial",
            height: "initial",
        });
    }
    
    recursiveUpdateContent(): void {
        // Parent first, then children
        this.updateContent();
        for (let child of this.children) {
            child.recursiveUpdateContent();
        }
    }
    
    recursiveUpdateClasses(): void {
        // Parent first, then children
        this.updateClasses();
        for (let child of this.children) {
            child.recursiveUpdateClasses();
        }
    }
    
    recursiveCreateHtmlElement(): void {
        // Parent first, then children
        this.createHtmlElement();
        for (let child of this.children) {
            child.recursiveCreateHtmlElement();
        }
    }
    
    recursiveCalculateLabelBoxSize(): void {
        // Parent first, then children
        this.calculateLabelBoxSize();
        for (let child of this.children) {
            child.recursiveCalculateLabelBoxSize();
        }
    }
    
    recursiveCalculateChildrenAndNodeBoxSizes(): void {
        // Children first, then parent
        for (let child of this.children) {
            child.recursiveCalculateChildrenAndNodeBoxSizes();
        }
        this.calculateChildrenAndNodeBoxSizes();
    }
    
    recursiveCalculateBoxCoordinates(availableBox: Rect): void {
        // Parent first, then children
        this.calculateBoxCoordinates(availableBox);
        let currentY: number = this.childrenBox.y0;
        if (NodeRenderer.DEBUG_RECTS) {
            this.debugRect("av", availableBox);
            this.debugRect("lb", this.labelBox);
            this.debugRect("cb", this.childrenBox);
            this.debugRect("bb", this.nodeBox);
        }
        for (let child of this.children) {
            let rect: Rect = new Rect(
                this.childrenBox.x0,
                currentY,
                this.childrenBox.width,
                child.nodeBox.height
            );
            if (NodeRenderer.DEBUG_RECTS) {
                this.debugRect("*", rect);
            }
            child.recursiveCalculateBoxCoordinates(rect);
            currentY += child.nodeBox.height;
        }
    }
    
    recursiveUpdateSvgElements(): void {
        // Parent first, then children
        this.updateSvgElements();
        for (let child of this.children) {
            child.recursiveUpdateSvgElements();
        }
    }
    
    recursiveRender(): void {
        // Parent first, then children
        this.render();
        for (let child of this.children) {
            child.recursiveRender();
        }
    }
    
    delete(): void {
        if (this.$node) {
            this.$node.remove();
        }
        if (this.$svgPath) {
            this.$svgPath.remove();
        }
        if (this.$svgCircle) {
            this.$svgCircle.remove();
        }
        this.$node = null;
        this.$svgPath = null;
        this.$svgCircle = null;
        for (let child of this.children) {
            child.delete();
        }
    }
    
    updateSvgSize(): void {
        this.mindmapRenderer.recalculateSvgSize();
    }
    
    
    
    
    
    /**************************************************
    ******************** Edit mode ********************
    ***************************************************/
    enterEditMode(focusImmediately: boolean = false, clearCurrentValue: boolean = false, relatedHostHash: string = null, relatedSectionId: string = null, parentWindow: BaseWindowView<any, any> = null): void {
        this.$node.addClass("edit-mode");
        let $editor = $(`<div class="editor"></div>`);
        this.$node.append($editor);
        let parent = parentWindow;
        let editor = new ContentEditableEditor($editor, {
            disallowTab: true,
            getValueSanitizer: "safeMindmapHtml",
            onRequestTaskPicker: (...args: any[]) => {
                parent.onTaskPickerResult(editor.onTaskPickerResult.bind(editor));
                return (<any>parent).onRequestTaskPicker(...args);
            },
            onRequestFilePicker: (...args: any[]) => {
                parent.onFilePickerResult(editor.onFilePickerResult.bind(editor));
                return (<any>parent).onRequestFilePicker(...args);
            },
            relatedHostHash: relatedHostHash,
            relatedSectionId: relatedSectionId,
        });
        this._editor = editor;
        if (clearCurrentValue) {
            editor.setValue("");
        }
        else {
            // let parts = this.node.label.split(`</${ContentEditableEditorMetaData.META_DATA_TAG_NAME}>`);
            // let metaDataStr: string = null;
            // let nodeLabelStr = this.node.label;
            // if (parts.length > 0) {
            //     metaDataStr = parts[0] + `</${ContentEditableEditorMetaData.META_DATA_TAG_NAME}>`;
            //     nodeLabelStr = parts[1];
            // }
            let metaDataStr: string = "";
            if (this.node.metaDataStr) {
                metaDataStr = `<${ContentEditableEditorMetaData.META_DATA_TAG_NAME} value="${encodeURIComponent(this.node.metaDataStr)}"></${ContentEditableEditorMetaData.META_DATA_TAG_NAME}>`;
            }
            editor.setValue($(this.mindmapRenderer.formatText(metaDataStr + this.node.label)).html(), undefined, true);
        }
        $editor.data("node-editor", editor);
        let focusFunc = () => {
            $editor.focus();
            let sel = window.document.getSelection();
            sel.removeAllRanges();
            let range = window.document.createRange();
            range.selectNodeContents($editor[0]);
            range.collapse(false);
            sel.addRange(range);
        };
        if (focusImmediately) {
            focusFunc();
        }
        else {
            setTimeout(() => {
                focusFunc();
            }, 0);
        }
    }
    
    exitEditMode(): string {
        let $editor = this.$node.children(".editor");
        let editor: ContentEditableEditor = $editor.data("node-editor");
        let newValue = editor.getValue();
        
        this.$node.removeClass("edit-mode");
        $editor.data("node-editor", null);
        $editor.remove();
        
        this._editor = null;
        
        return newValue;
    }
    
    isEditorF2TipOpen(): boolean {
        return !!(this._editor && this._editor.isCursorInPickerContext());
    }
    
    
    
    
    
    /**************************************************
    ********************** Debug **********************
    ***************************************************/
    debugRect(key: string, rect: Rect): void {
        let [r, g, b] = this.debugRandColor();
        let $e = $(`<div class="debug-rect" style="display:none;overflow:hidden;font-size:11px;pointer-events:none;z-index:9999;position:absolute;left:${rect.x0}px;top:${rect.y0}px;width:${rect.width}px;height:${rect.height}px;background:rgba(${r},${g},${b},0.1);text-align:center;line-height:${rect.height}px;border:1px dashed rgba(${r},${g},${b},1.0);"><span style="padding:1px;color:#000;border-radius:100px;background:rgb(${r},${g},${b});">${key}</span></div>`)
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
