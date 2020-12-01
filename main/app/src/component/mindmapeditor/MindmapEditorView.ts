import { ComponentView } from "../base/ComponentView";
import { func as mainTemplate } from "./template/index.html";
import {func as customToolbarMindmapTemplate} from "./template/custom-toolbar-mindmap.html";
import {func as rightSideToolbarMindmapTemplate} from "./template/right-side-toolbar-mindmap.html";
import { app } from "../../Types";
import { Model, StyleSwitcherTemplateModel } from "./MindmapEditorController";
import * as $ from "jquery";
import Q = require("q");
import { Mindmap } from "./Mindmap";
import { MindmapNode, MindmapNodeStyle, MindmapNodeTaskState } from "./MindmapNode";
import { MindmapRenderer } from "./MindmapRenderer";
import { MailClientViewHelper, WebUtils } from "../../web-utils";
import { NodeRenderer } from "./NodeRenderer";
import { Rect } from "./Rect";
import { MindmapOperation, ComplexNodeOperation, SwapNodesOperation, KeyOfOperationResult, CreateNewParentOperation, MoveNodeOperation, ChangeNodePropertyOperation, CreateNodeOperation, MindmapOperationResult, DeleteNodeOperation, ChangeMindmapPropertyOperation } from "./MindmapOperation";
import { Utils } from "../../utils";
import { MindmapPath } from "./MindmapPath";
import { ContentEditableEditorMetaData } from "../../web-utils/ContentEditableEditorMetaData";

type KeyOfMindmapNode = Extract<keyof MindmapNode, string>;

enum OperationExecutionMode {
    NORMAL,
    UNDO,
    REDO,
};

export class MindmapEditorView extends ComponentView {
    
    static BATCH_MODIFICATION_FULL_RENDER_THRESHOLD: number = 2000; // Min number of nodes modified simultaneously that will cause full render
    static SINGLE_CLICK_TIMEOUT: number = 300;
    
    $container: JQuery;
    $component: JQuery;
    $scrollable: JQuery;
    $scrollableH: JQuery;
    $scrollableV: JQuery;
    $mindmap: JQuery;
    $nodes: JQuery;
    $hiddenNodes: JQuery;
    $svg: JQuery;
    mindmap: Mindmap;
    editedNode: MindmapNode;
    editedNodeDeferred: Q.Deferred<string> = null;
    selectedNodes: MindmapNode[] = [];
    selectionPointerNode: MindmapNode = null;
    selectionPointerPath: string = null;
    renderer: MindmapRenderer;
    editable: boolean = true;
    clipboard: MindmapNode[] = [];
    clipboardIsCut: boolean = false;
    clipboardString: string = null;
    undoStack: MindmapOperation[] = [];
    redoStack: MindmapOperation[] = [];
    protected _prevIsDirty: boolean = false;
    protected _savedSignature: string = null;
    protected _singleClickTimeout: number = null;
    taskStatuses: { [taskId: string]: string } = {};
    relatedHostHash: string = null;
    relatedSectionId: string = null;
    protected _uniqueId: string;
    
    constructor(parent: app.ViewParent) {
        super(parent);
        this._uniqueId = Math.random().toString(36).substr(2);
    }
    
    init(model: Model): Q.Promise<void> {
        if (model.editable) {
            this.enterMindmapEditMode();
        }
        else {
            this.exitMindmapEditMode();
        }
        this.$component = this.templateManager.createTemplate(mainTemplate).renderToJQ(model);
        this.$container.content(this.$component);
        this.$scrollable = this.$component.find(".scrollable");
        this.$mindmap = this.$component.find(".mindmap");
        this.$nodes = this.$component.find(".nodes");
        this.$hiddenNodes = this.$component.find(".hidden-nodes");
        this.$svg = this.$component.find("svg");
        let helper = this.templateManager.getHelperByClass(MailClientViewHelper);
        this.renderer = new MindmapRenderer(this.mindmap, this.$mindmap, this.$nodes, this.$hiddenNodes, this.$svg, (str: string) => {
            return helper.formatRichMessage(str || "", "html", this.taskStatuses, "safeMindmapHtml");
        });
        this.$scrollable.addClass("pf-scrollable-horizontal").pfScroll();
        this.$scrollable.children(".pf-content").pfScroll();
        this.$scrollableH = this.$scrollable.children(".pf-content");
        this.$scrollableV = this.$scrollableH.children(".pf-content");
        this.bindEvents();
        return Q();
    }
    
    bindEvents(): void {
        this.$container.on("click", ".node", this.onNodeClick.bind(this));
        this.$container.on("dblclick", ".node", this.onNodeDoubleClick.bind(this));
        this.$container.on("click", ".mindmap", this.onMindmapClick.bind(this));
        this.$container.on("click", ".task-label", this.onTaskLabelClick.bind(this));
        $(window).on("keydown", this.onKeyDown.bind(this));
    }
    
    onNodeClick(e: MouseEvent): void {
        let isLinkClick = $(e.target).closest(".file-label.link").length > 0;
        let isTaskClick = $(e.target).closest(".task-label.task-id").length > 0;
        if (WebUtils.hasCtrlModifier(e) && (isLinkClick || isTaskClick)) {
            return;
        }
        else if (isLinkClick) {
            e.stopPropagation();
        }
        this.clearSingleClickTimeout();
        let nodeRenderer: NodeRenderer = $(e.currentTarget).data("nodeRenderer");
        if (!isLinkClick && WebUtils.hasCtrlModifier(e)) {
            this.toggleNodeSelection(nodeRenderer.node);
        }
        else if (WebUtils.hasShiftModifier(e)) {
            // If pointer node and clicked node are siblings, select both of them and all silbing nodes between them (but not child nodes)
            // Else select only the clicked node (without clearing selection)
            if (this.selectionPointerNode && this.selectionPointerNode.parentNode == nodeRenderer.node.parentNode) {
                let parentNode: MindmapNode = nodeRenderer.node.parentNode;
                let indexes: number[] = [parentNode.nodes.indexOf(nodeRenderer.node), parentNode.nodes.indexOf(this.selectionPointerNode)];
                indexes.sort((a, b) => a - b);
                for (let index = indexes[0]; index <= indexes[1]; ++index) {
                    this.selectNode(parentNode.nodes[index]);
                }
            }
            else {
                this.selectNode(nodeRenderer.node);
            }
        }
        else if (this.selectedNodes[0] == nodeRenderer.node && this.selectedNodes.length == 1 && !this.isInNodeLabelEditMode()) {
            this._singleClickTimeout = <any>setTimeout(() => {
                this._singleClickTimeout = null;
                if (this.selectedNodes[0] == nodeRenderer.node && this.selectedNodes.length == 1 && !this.isInNodeLabelEditMode()) {
                    this.toggleNodeCollapsed(nodeRenderer.node);
                }
            }, MindmapEditorView.SINGLE_CLICK_TIMEOUT);
        }
        else {
            if (this.isInNodeLabelEditMode()) {
                if (this.selectedNodes[0] != nodeRenderer.node) {
                    this.exitNodeLabelEditMode(true, false);
                }
            }
            this.toggleNodeSelection(nodeRenderer.node, true, true);
        }
        this.selectionPointerNode = nodeRenderer.node;
        this.selectionPointerPath = this.selectionPointerNode.getPath();
        if (this.selectionPointerNode) {
            this.selectionPointerNode.focus();
        }
    }
    
    onNodeDoubleClick(e: MouseEvent): void {
        this.clearSingleClickTimeout();
        let nodeRenderer: NodeRenderer = $(e.currentTarget).data("nodeRenderer");
        if (this.isInMindmapEditMode()) {
            if (this.isInNodeLabelEditMode() && this.editedNode == nodeRenderer.node) {
                return;
            }
            this.editSelectedNode();
        }
        else {
            this.toggleNodeCollapsed(nodeRenderer.node);
        }
    }
    
    onMindmapClick(e: MouseEvent): void {
        if (!this.isInNodeLabelEditMode() || $(e.target).closest(".node").length > 0) {
            return;
        }
        this.exitNodeLabelEditMode(true);
    }
    
    onTaskLabelClick(e: MouseEvent): void {
        if (!WebUtils.hasCtrlModifier(e)) {
            return;
        }
        e.stopPropagation();
        let taskId = $(e.currentTarget).data("task-id");
        if (taskId) {
            this.triggerEvent("openTask", taskId);
        }
    }
    
    onKeyDown(e: KeyboardEvent): void {
        let ctrlModifier = WebUtils.hasCtrlModifier(e);
        let shiftModifier = WebUtils.hasShiftModifier(e);
        let altModifier = WebUtils.hasAltModifier(e);
        if (e.key == "s" && ctrlModifier) {
            this.exitNodeLabelEditMode(true);
            this.triggerEvent("save");
        }
        else if (e.key == "ArrowRight" && shiftModifier && ctrlModifier) {
            this.goToImportantDescendant();
        }
        else if (e.key == "ArrowUp" && !ctrlModifier && shiftModifier && !altModifier && !this.isInNodeLabelEditMode()) {
            this.selectPreviousNodeInBlock();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowDown" && !ctrlModifier && shiftModifier && !altModifier && !this.isInNodeLabelEditMode()) {
            this.selectNextNodeInBlock();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowUp" && !ctrlModifier && shiftModifier && altModifier && !this.isInNodeLabelEditMode()) {
            this.deselectLastNodeInBlock();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowDown" && !ctrlModifier && shiftModifier && altModifier && !this.isInNodeLabelEditMode()) {
            this.deselectFirstNodeInBlock();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowUp" && !ctrlModifier && !this.isInNodeLabelEditMode()) {
            this.selectPreviousNode();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowDown" && !ctrlModifier && !this.isInNodeLabelEditMode()) {
            this.selectNextNode();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowLeft" && !ctrlModifier && !this.isInNodeLabelEditMode()) {
            this.selectParentNode();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowRight" && !ctrlModifier && !this.isInNodeLabelEditMode()) {
            this.selectChildNode();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowUp" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.moveSelectedNodesUpSameLevel();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowDown" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.moveSelectedNodesDownSameLevel();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowLeft" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.moveSelectedNodesUpInHierarchy();
            this.scrollToPointerNode();
        }
        else if (e.key == "ArrowRight" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.moveSelectedNodesDownInHierarchy();
            this.scrollToPointerNode();
        }
        else if (e.key == " " && !this.isInNodeLabelEditMode()) {
            this.toggleSelectedNodesCollapsed();
        }
        else if (e.key == "F2" && this.isInMindmapEditMode()) {
            if (this.isInNodeLabelEditMode()) {
                if (!this.editedNode || !this.editedNode.isEditorF2TipOpen()) {
                    this.exitNodeLabelEditMode(false);
                }
            }
            else {
                this.editSelectedNode();
            }
        }
        else if (e.key == "Escape" && this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.exitNodeLabelEditMode(false);
        }
        else if (e.key == "Escape" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.cancelCut();
        }
        else if (e.key == "Enter" && !shiftModifier && this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.exitNodeLabelEditMode(true);
        }
        else if (e.key == "Enter" && (!shiftModifier && !this.isInNodeLabelEditMode()) && this.isInMindmapEditMode()) {
            this.createSiblingNodeBelow();
        }
        else if (e.key == "Enter" && (shiftModifier && !this.isInNodeLabelEditMode()) && this.isInMindmapEditMode()) {
            this.createSiblingNodeAbove();
        }
        else if (e.key == "Tab" && !shiftModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.createChildNode();
        }
        else if (e.key == "Tab" && !shiftModifier && this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.exitNodeLabelEditMode(true);
        }
        else if (e.key == "Tab" && shiftModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.createParentNode();
        }
        else if (e.key == "Delete" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.deleteSelectedNodes();
        }
        else if (e.key.toUpperCase() == "X" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.cutSelectedNodes();
        }
        else if (e.key.toUpperCase() == "C" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.copySelectedNodes();
        }
        else if (e.key.toUpperCase() == "C" && ctrlModifier && !this.isInNodeLabelEditMode()) {
            this.copySelectedNodes();
        }
        else if (e.key.toUpperCase() == "V" && ctrlModifier && !shiftModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.pasteNodesFromClipboard();
            this.scrollToPointerNode();
        }
        else if (e.key.toUpperCase() == "V" && ctrlModifier && shiftModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.pasteNodesFromClipboard(true);
            this.scrollToPointerNode();
        }
        else if (e.key.toUpperCase() == "Z" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.undo();
        }
        else if (e.key.toUpperCase() == "Y" && ctrlModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.redo();
        }
        else if (e.key == "F1" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.setSelectedNodesStyle(null);
        }
        else if (e.key == "F3" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.setSelectedNodesStyle(MindmapNodeStyle.Style1);
        }
        else if (e.key == "F4" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.setSelectedNodesStyle(MindmapNodeStyle.Style2);
        }
        else if (e.key == "F5" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.setSelectedNodesStyle(MindmapNodeStyle.Style3);
        }
        else if (e.key == "F6" && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) {
            this.setSelectedNodesStyle(MindmapNodeStyle.Style4);
        }
        else if ((e.keyCode == 49 || e.keyCode == 97) && shiftModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) { // Shift + 1
            this.toggleSelectedNodesImportant();
        }
        else if ((e.keyCode == 50 || e.keyCode == 98) && shiftModifier && !this.isInNodeLabelEditMode() && this.isInMindmapEditMode()) { // Shift + 2
            this.toggleSelectedNodesTaskState();
        }
        else if (e.key == "[" && ctrlModifier) {
            this.setSmallerFontSize();
        }
        else if (e.key == "]" && ctrlModifier) {
            this.setLargerFontSize();
        }
        else {
            if (this.isAlphaumericKeyCode(e.keyCode)) {
                if (this.isInMindmapEditMode() && !this.isInNodeLabelEditMode()) {
                    this.editSelectedNode(true, true);
                }
            }
        }
    }
    
    copyPasteKeydownHandler(e: KeyboardEvent): void {
    }
    
    isAlphaumericKeyCode(keyCode: number) {
        return keyCode === 8 || keyCode === 9 || keyCode === 13 || keyCode === 32 || (keyCode >= 48 && keyCode <= 57) || keyCode === 59 || keyCode === 61 || (keyCode >= 65 && keyCode <= 90) || (keyCode >= 96 && keyCode <= 111) || keyCode === 173 || keyCode === 188 || keyCode === 190 || keyCode === 191 || keyCode === 192 || keyCode === 219 || keyCode === 220 || keyCode === 222;
    };
    
    setMindmap(mindmapStr: string, relatedHostHash: string, relatedSectionId: string): void {
        this.release();
        this.mindmap = Mindmap.fromJson(mindmapStr);
        this.renderer.mindmap = this.mindmap;
        this.setEditorFontSize(this.mindmap.getFontSize());
        this.render();
        this._savedSignature = this.mindmap.getSignature();
        this._prevIsDirty = false;
        this.relatedHostHash = relatedHostHash;
        this.relatedSectionId = relatedSectionId;
    }
    
    rerender(): void {
        if (!this.$component.is(":visible")) {
            return;
        }
        if (this.mindmap) {
            for (let element of this.mindmap.elements) {
                element.spec.getRenderer().delete();
            }
        }
        this.render();
    }
    
    release(): void {
        if (this.mindmap) {
            for (let element of this.mindmap.elements) {
                element.spec.getRenderer().delete();
            }
        }
    }
    
    setStyle(styleName: string, fontSize: string): void {
        let prevStyle = this.mindmap.style;
        if (!styleName) {
            styleName = prevStyle && prevStyle.name && prevStyle.name in Mindmap.AVAILABLE_STYLES ? prevStyle.name : Mindmap.DEFAULT_STYLE_NAME;
        }
        if (!fontSize) {
            fontSize = prevStyle && prevStyle.fontSize && prevStyle.fontSize in Mindmap.AVAILABLE_FONT_SIZES ? prevStyle.fontSize : Mindmap.DEFAULT_FONT_SIZE;
        }
        let prevStyleName = prevStyle ? prevStyle.name : null;
        let prevFontSize = prevStyle ? prevStyle.fontSize : null;
        let newStyle = styleName ? { name: styleName, fontSize: fontSize } : null;
        let newStyleName = newStyle ? newStyle.name : null;
        let newFontSize = newStyle ? newStyle.fontSize : null;
        if (prevStyleName != newStyleName || prevFontSize != newFontSize) {
            let operation = new ChangeMindmapPropertyOperation(this.mindmap, "style", prevStyle, newStyle);
            this.performOperation(operation);
        }
        if (this.$component) {
            this.setEditorFontSize(fontSize);
        }
    }
    
    render(): void {
        this.renderer.render();
        this.triggerEvent("mindmapRendered");
    }
    
    getAvailableNotesStyles(): {[name: string]: string} {
        return JSON.parse(JSON.stringify(Mindmap.AVAILABLE_STYLES));
    }
    
    getStyleSwitcherTemplateModel(): StyleSwitcherTemplateModel {
        return {
            style: this.mindmap ? this.mindmap.getStyle() : { name: Mindmap.DEFAULT_STYLE_NAME, fontSize: Mindmap.DEFAULT_FONT_SIZE },
            availableNotesStyles: this.getAvailableNotesStyles(),
        };
    }
    
    getCustomToolbarMenuHtml(): string {
        let model = this.getStyleSwitcherTemplateModel();
        return this.viewManager.getTemplateManager().createTemplate(customToolbarMindmapTemplate).render(model);
    }
    
    getCustomToolbarRightSideMenuHtml(): string {
        return this.viewManager.getTemplateManager().createTemplate(rightSideToolbarMindmapTemplate).render();
    }
    
    clearSingleClickTimeout(): void {
        if (this._singleClickTimeout !== null) {
            clearTimeout(this._singleClickTimeout);
            this._singleClickTimeout = null;
        }
    }
    
    setNewLabelTexts(newTextsStr: string, metaDataStr: string): void {
        let newTexts: { [path: string]: string } = JSON.parse(newTextsStr);
        let newMetaData: { [path: string]: string } = JSON.parse(metaDataStr || "{}");
        for (let path in newTexts) {
            let node = this.mindmap.getTargetNodeFromPath(path);
            if (node) {
                node.label = newTexts[path];
                node.metaDataStr = newMetaData[path];
                node.triggerNodeContentChanged();
            }
        }
    }
    
    setEditorFontSize(fontSize: string): void {
        let css = `.mindmap .node { font-size: ${fontSize} !important; }`;
        let $style = $("#" + this._uniqueId);
        if ($style.length == 0) {
            $style = $(`<style type="text/css" id="${this._uniqueId}"></style>`);
            $("head").append($style);
        }
        $style.text(css);
    }
    
    
    
    
    
    /**************************************************
    ****************** Finding nodes ******************
    ***************************************************/
    findNode(path: string): MindmapNode {
        return this.mindmap.getTargetNodeFromPath(path);
    }
    
    findAdjacentNode(node: MindmapNode, direction: number, childDepth: number = 0): MindmapNode {
        if (!node.parentNode) {
            return null;
        }
        let parentNode = node.parentNode;
        let index = parentNode.nodes.indexOf(node);
        let targetIndex = index + direction;
        if (targetIndex >= 0 && targetIndex < parentNode.nodes.length) {
            let potentialNode = parentNode.nodes[targetIndex];
            for (let i = 0; i < childDepth; ++i) {
                if (potentialNode.nodes.length > 0 && !potentialNode.collapsed) {
                    potentialNode = potentialNode.nodes[direction > 0 ? 0 : potentialNode.nodes.length - 1];
                }
            }
            return potentialNode;
        }
        return this.findAdjacentNode(node.parentNode, direction, childDepth + 1);
    }
    
    findPreviousNode(node: MindmapNode): MindmapNode {
        return this.findAdjacentNode(node, -1);
    }
    
    findNextNode(node: MindmapNode): MindmapNode {
        return this.findAdjacentNode(node, 1);
    }
    
    
    
    
    
    /**************************************************
    ****************** Node selection *****************
    ***************************************************/
    isNodeSelected(node: MindmapNode): boolean {
        return this.selectedNodes.indexOf(node) >= 0;
    }
    
    isAncestorSelected(node: MindmapNode): boolean {
        let ancestor = node.parentNode;
        while (ancestor) {
            if (this.selectedNodes.indexOf(ancestor) >= 0) {
                return true;
            }
            ancestor = ancestor.parentNode;
        }
        return false;
    }
    
    toggleNodeSelection(node: MindmapNode, selected: boolean = null, clearSelection: boolean = false): void {
        if (this.isInNodeLabelEditMode()) {
            if (this.selectedNodes.length == 1 && this.selectedNodes[0] == node && selected) {
                return;
            }
            this.exitNodeLabelEditMode(true);
        }
        let isSelected = this.isNodeSelected(node);
        if (clearSelection) {
            this.clearSelection();
        }
        let select: boolean;
        if (selected !== null) {
            select = selected;
        }
        else {
            select = !isSelected;
        }
        if (select) {
            if (!isSelected || clearSelection) {
                this.selectedNodes.push(node);
                if (node.parentNode) {
                    node.parentNode.onChildNodeSelected(node);
                }
            }
        }
        else {
            let idx: number = this.selectedNodes.indexOf(node);
            if (idx >= 0) {
                this.selectedNodes.splice(idx, 1);
            }
        }
        this.renderer.updateSelection(this.selectedNodes);
    }
    
    selectNode(node: MindmapNode, clearSelection: boolean = false, updatePointer: boolean = false): void {
        this.toggleNodeSelection(node, true, clearSelection);
        if (updatePointer) {
            this.selectionPointerNode = node;
            this.selectionPointerPath = this.selectionPointerNode.getPath();
            if (this.selectionPointerNode) {
                this.selectionPointerNode.focus();
            }
        }
    }
    
    deselectNode(node: MindmapNode, newPointerNode: MindmapNode = undefined): void {
        this.toggleNodeSelection(node, false);
        if (newPointerNode !== undefined) {
            this.selectionPointerNode = newPointerNode;
            this.selectionPointerPath = this.selectionPointerNode ? this.selectionPointerNode.getPath() : null;
            if (this.selectionPointerNode) {
                this.selectionPointerNode.focus();
            }
        }
    }
    
    isPathSelected(path: string): boolean {
        return this.selectedNodes.filter(x => x.getPath() == path).length > 0;
    }
    
    togglePathSelection(path: string, selected: boolean = null, clearSelection: boolean = false): void {
        let node = this.findNode(path);
        this.toggleNodeSelection(node, selected, clearSelection);
    }
    
    selectPath(path: string, clearSelection: boolean = false): void {
        this.togglePathSelection(path, true, clearSelection);
    }
    
    deselectPath(path: string): void {
        this.togglePathSelection(path, false);
    }
    
    clearSelection(): void {
        if (this.isInNodeLabelEditMode()) {
            this.exitNodeLabelEditMode(false);
        }
        this.selectedNodes.length = 0;
    }
    
    setSelection(selectedNodes: MindmapNode[]): void {
        this.clearSelection();
        if (selectedNodes) {
            for (let node of selectedNodes) {
                this.selectNode(node, false, false);
            }
        }
    }
    
    selectPreviousNode(): void {
        if (!this.selectionPointerNode) {
            this.selectClosestNode("/0");
            return;
        }
        let previousNode = this.findPreviousNode(this.selectionPointerNode);
        if (previousNode) {
            this.selectNode(previousNode, true, true);
        }
        else {
            this.selectClosestNode(this.selectionPointerPath);
        }
    }
    
    selectNextNode(): void {
        if (!this.selectionPointerNode) {
            this.selectClosestNode("/0");
            return;
        }
        let nextNode = this.findNextNode(this.selectionPointerNode);
        if (nextNode) {
            this.selectNode(nextNode, true, true);
        }
        else {
            this.selectClosestNode(this.selectionPointerPath);
        }
    }
    
    selectPreviousNodeInBlock(): void {
        if (!this.selectionPointerNode) {
            this.selectClosestNode("/0");
            return;
        }
        let prevNotSelected = this.selectionPointerNode.getPreviousNode(node => !this.isNodeSelected(node));
        if (!prevNotSelected) {
            return;
        }
        this.selectNode(prevNotSelected, false, true);
    }
    
    selectNextNodeInBlock(): void {
        if (!this.selectionPointerNode) {
            this.selectClosestNode("/0");
            return;
        }
        let nextNotSelected = this.selectionPointerNode.getNextNode(node => !this.isNodeSelected(node));
        if (!nextNotSelected) {
            return;
        }
        this.selectNode(nextNotSelected, false, true);
    }
    
    deselectFirstNodeInBlock(): void {
        if (!this.selectionPointerNode || !this.selectedNodes || this.selectedNodes.length < 2) {
            return;
        }
        let firstNotSelected = this.selectionPointerNode.getPreviousNode(node => !this.isNodeSelected(node));
        let firstSelected = firstNotSelected ? firstNotSelected.getNextNode() : null;
        if (!firstSelected) {
            firstSelected = this.selectionPointerNode.parentNode.nodes[0];
        }
        this.deselectNode(firstSelected, firstSelected.getNextNode() || firstSelected);
    }
    
    deselectLastNodeInBlock(): void {
        if (!this.selectionPointerNode || !this.selectedNodes || this.selectedNodes.length < 2) {
            return;
        }
        let lastNotSelected = this.selectionPointerNode.getNextNode(node => !this.isNodeSelected(node));
        let lastSelected = lastNotSelected ? lastNotSelected.getPreviousNode() : null;
        if (!lastSelected) {
            lastSelected = this.selectionPointerNode.parentNode.nodes[this.selectionPointerNode.parentNode.nodes.length - 1];
        }
        this.deselectNode(lastSelected, lastSelected.getPreviousNode() || lastSelected);
    }
    
    selectParentNode(): void {
        if (!this.selectionPointerNode) {
            this.selectClosestNode("/0");
            return;
        }
        if (this.selectionPointerNode.parentNode) {
            this.selectNode(this.selectionPointerNode.parentNode, true, true);
        }
        else {
            this.selectClosestNode(this.selectionPointerPath);
        }
    }
    
    selectChildNode(): void {
        if (!this.selectionPointerNode) {
            this.selectClosestNode("/0");
            return;
        }
        this.selectNode(this.selectionPointerNode.getChildNodeToSelect(), true, true);
        // if (this.selectionPointerNode.nodes[0]) {
        //     this.selectNode(this.selectionPointerNode.nodes[0], true, true);
        // }
        // else {
        //     this.selectClosestNode(this.selectionPointerPath);
        // }
    }
    
    selectClosestNode(pathOrNode: string|MindmapNode): void {
        let path: string = ((pathOrNode instanceof MindmapNode) ? pathOrNode.getPath() : pathOrNode);
        let nodeToSelect: MindmapNode = null;
        this.mindmap.visitPath(path, {
            missingNode: (missingNodePath, missingNodeParent) => {
                if (missingNodeParent) {
                    // if (missingNodeParent.nodes.length > 0) {
                    //     nodeToSelect = missingNodeParent.nodes[missingNodeParent.nodes.length - 1];
                    // }
                    // else {
                    //     nodeToSelect = missingNodeParent;
                    // }
                    nodeToSelect = missingNodeParent.getChildNodeToSelect();
                }
            },
            visitFinalNode: node => {
                if (node) {
                    nodeToSelect = node;
                }
            },
        });
        if (nodeToSelect) {
            this.selectNode(nodeToSelect, true, true);
        }
    }
    
    scrollToPointerNode(): void {
        if (!this.selectionPointerNode) {
            return;
        }
        this.expandAncestors(this.selectionPointerNode);
        let labelBox: Rect = this.selectionPointerNode.getRenderer().labelBox;
        let viewport: Rect = new Rect(this.$scrollableH.scrollLeft(), this.$scrollableV.scrollTop(), this.$component.width(), this.$component.height());
        let margin = 50;
        if (labelBox.y1 + margin > viewport.y1) {
            this.$scrollableV.scrollTop(labelBox.y1 + margin - viewport.height);
        }
        else if (labelBox.y0 - margin < viewport.y0) {
            this.$scrollableV.scrollTop(labelBox.y0 - margin);
        }
        if (labelBox.x1 + margin > viewport.x1) {
            this.$scrollableH.scrollLeft(labelBox.x1 + margin - viewport.width);
        }
        else if (labelBox.x0 - margin < viewport.x0) {
            this.$scrollableH.scrollLeft(labelBox.x0 - margin);
        }
    }
    
    goToImportantDescendant(): void {
        if (!this.selectionPointerNode) {
            return;
        }
        let nodesToProcess: MindmapNode[] = [this.selectionPointerNode];
        let importantNode: MindmapNode = null;
        while (nodesToProcess.length > 0) {
            let node = nodesToProcess.pop();
            if (node.important && node != this.selectionPointerNode) {
                importantNode = node;
                break;
            }
            for (let i = node.nodes.length - 1; i >= 0; --i) {
                nodesToProcess.push(node.nodes[i]);
            }
        }
        if (importantNode) {
            this.selectNode(importantNode, true, true);
            this.scrollToPointerNode();
        }
    }
    
    
    
    
    
    /**************************************************
    ************ Node collapsing/expanding ************
    ***************************************************/
    collapseNode(node: MindmapNode): void {
        this.toggleNodeCollapsed(node, true);
    }
    
    expandNode(node: MindmapNode): void {
        this.toggleNodeCollapsed(node, false);
    }
    
    toggleNodeCollapsed(node: MindmapNode, collapsed: boolean = null): void {
        let collapse: boolean;
        if (collapsed === null) {
            collapse = !node.collapsed;
        }
        else {
            collapse = collapsed;
        }
        if (node.collapsed != collapse) {
            if (collapse && node.nodes.length == 0) {
                return;
            }
            let oldValue = node.collapsed;
            let newValue = collapse;
            let operation: ChangeNodePropertyOperation = new ChangeNodePropertyOperation(this.mindmap, node.getPath(), "collapsed", oldValue, newValue);
            this.performOperation(operation);
        }
    }
    
    expandAncestors(node: MindmapNode): void {
        let parentNode = node.parentNode;
        while (parentNode) {
            if (parentNode.collapsed) {
                this.expandNode(parentNode);
            }
            parentNode = parentNode.parentNode;
        }
    }
    
    expandNodeAndAncestors(node: MindmapNode): void {
        if (node.collapsed) {
            this.expandNode(node);
        }
        this.expandAncestors(node);
    }
    
    
    
    
    
    /**************************************************
    **************** Node manipulation ****************
    ***************************************************/
    setSelectedNodesProperty(property: KeyOfMindmapNode, value: any): void {
        let operations: ChangeNodePropertyOperation[] = this.selectedNodes.slice()
            .map(x => {
                let oldValue = x[property];
                let newValue = value;
                return new ChangeNodePropertyOperation(this.mindmap, x.getPath(), property, oldValue, newValue);
            })
            .filter(x => x != null);
        if (operations.length == 0) {
            return;
        }
        let operation: ComplexNodeOperation = new ComplexNodeOperation(this.mindmap, operations);
        this.performOperation(operation);
    }
    
    setSelectedNodesStyle(style: MindmapNodeStyle): void {
        this.setSelectedNodesProperty("style", style);
    }
    
    setSelectedNodesTaskState(taskState: MindmapNodeTaskState): void {
        this.setSelectedNodesProperty("taskState", taskState);
    }
    
    toggleSelectedNodesCollapsed(): void {
        let collapsibleNodes = this.selectedNodes.filter(x => x.nodes.length > 0);
        if (collapsibleNodes.length == 0) {
            return;
        }
        let collapsed: boolean = !collapsibleNodes[collapsibleNodes.length - 1].collapsed;
        this.setSelectedNodesProperty("collapsed", collapsed);
        this.scrollToPointerNode();
    }
    
    toggleSelectedNodesImportant(): void {
        if (this.selectedNodes.length == 0) {
            return;
        }
        let important: boolean = !this.selectedNodes[this.selectedNodes.length - 1].important;
        this.setSelectedNodesProperty("important", important);
    }
    
    toggleSelectedNodesTaskState(): void {
        if (this.selectedNodes.length == 0) {
            return;
        }
        let taskState: MindmapNodeTaskState = this.mindmap.nextTaskState(this.selectedNodes[this.selectedNodes.length - 1].taskState);
        this.setSelectedNodesProperty("taskState", taskState);
    }
    
    deleteSelectedNodes(): void {
        if (this.selectedNodes.length == 0) {
            return;
        }
        
        // Ignore selected nodes that are descendants of a selected node
        let paths = this.selectedNodes.map(x => x.getPath() + "/").sort();
        for (let i = 0; i < paths.length - 1; ++i) {
            let j = i + 1;
            while (j < paths.length && paths[j].substr(0, paths[i].length) == paths[i]) {
                paths.splice(j, 1);
            }
        }
        paths = paths.map(x => x.substr(0, x.length - 1));
        
        let operations: DeleteNodeOperation[] = [];
        for (let path of paths) {
            let node: MindmapNode = this.mindmap.getTargetNodeFromPath(path);
            operations.push(new DeleteNodeOperation(this.mindmap, path, node))
        }
        let operation: ComplexNodeOperation = new ComplexNodeOperation(this.mindmap, operations);
        this.performOperation(operation);
        this.clearSelection();
        this.exitNodeLabelEditMode(false);
        this.selectClosestNode(this.selectionPointerPath);
    }
    
    moveSelectedNodesSameLevel(direction: number): void {
        let operations: SwapNodesOperation[] = this.selectedNodes.slice()
            .map(x => <[MindmapNode, string]>[x, x.getSortablePath()])
            .sort((a, b) => -direction * a[1].localeCompare(b[1]))
            .map(x => x[0])
            .map(x => {
                let index0 = x.parentNode.nodes.indexOf(x);
                let index1 = index0 + direction;
                if (index1 >= 0 && index1 < x.parentNode.nodes.length) {
                    let path0 = x.getPath();
                    let path1 = MindmapPath.modifyLastPathPosition(x.getPath(), direction);
                    return new SwapNodesOperation(this.mindmap, path0, path1);
                }
                return null;
            })
            .filter(x => x != null);
        if (operations.length == 0) {
            return;
        }
        let operation: ComplexNodeOperation = new ComplexNodeOperation(this.mindmap, operations);
        this.performOperation(operation);
    }
    
    moveSelectedNodesUpSameLevel(): void {
        this.moveSelectedNodesSameLevel(-1);
    }
    
    moveSelectedNodesDownSameLevel(): void {
        this.moveSelectedNodesSameLevel(1);
    }
    
    moveSelectedNodesUpInHierarchy(): void {
        let operations: MoveNodeOperation[] = this.selectedNodes.slice()
            .map(x => {
                if (x.parentNode && x.parentNode.parentNode) {
                    let path0 = x.getPath();
                    let parentIndex = MindmapPath.getNodeIndexFromPath(x.parentNode.getPath());
                    let destinationIndex = parentIndex + 1;
                    let path1 = x.parentNode.parentNode.getPath() + "/" + destinationIndex;
                    return new MoveNodeOperation(this.mindmap, path0, path1);
                }
                return null;
            })
            .filter(x => x != null);
        if (operations.length == 0) {
            return;
        }
        let operation: ComplexNodeOperation = new ComplexNodeOperation(this.mindmap, operations);
        this.performOperation(operation);
    }
    
    moveSelectedNodesDownInHierarchy(): void {
        let operations: MoveNodeOperation[] = this.selectedNodes.slice()
            .map(x => {
                if (x.parentNode && x.parentNode.nodes.length >= 2) {
                    let path0 = x.getPath();
                    let index = MindmapPath.getNodeIndexFromPath(path0);
                    let newParentIndex = index == 0 ? index : (index - 1);
                    let destinationIndex = index == 0 ? 0 : -1;
                    let path1 = x.parentNode.getPath() + "/" + newParentIndex + "/" + destinationIndex;
                    return new MoveNodeOperation(this.mindmap, path0, path1);
                }
                return null;
            })
            .filter(x => x != null);
        if (operations.length == 0) {
            return;
        }
        let operation: ComplexNodeOperation = new ComplexNodeOperation(this.mindmap, operations);
        this.performOperation(operation);
    }
    
    createNewNode(targetNode: MindmapNode, index: number, takeExistingNodeAsChild: boolean = false): MindmapNode {
        let originalSelection = this.selectedNodes.slice();
        let originalPointerNode = this.selectionPointerNode;
        this.expandNodeAndAncestors(targetNode);
        
        // Create node
        let newNodeTemplate: MindmapNode = new MindmapNode(this.mindmap);
        
        // Insert node
        let operation: MindmapOperation;
        if (takeExistingNodeAsChild) {
            let childNode: MindmapNode = targetNode;
            let midNode: MindmapNode = newNodeTemplate;
            let destinationPath = childNode.getPath();
            operation = new CreateNewParentOperation(this.mindmap, destinationPath, midNode);
        }
        else {
            let parentNode: MindmapNode = targetNode;
            let childNode: MindmapNode = newNodeTemplate;
            let destinationPath = parentNode.getPath() + "/" + index;
            operation = new CreateNodeOperation(this.mindmap, destinationPath, childNode);
        }
        let result: MindmapOperationResult = this.performOperation(operation);
        let newNode: MindmapNode = result && result.nodesCreated && result.nodesCreated.length > 0 ? result.nodesCreated[0] : null;
        if (!newNode) {
            return null;
        }
        
        // Select node and enter label edit edit mode
        this.selectNode(newNode, true, true);
        this.editSelectedNode().then(() => {
            // Commit
            // Nothing to do
        })
        .catch(e => {
            // Rollback
            let reverseOperation: MindmapOperation = operation.getReverseOperation();
            this.performOperation(reverseOperation);
            if (e && e.restoreOriginalSelection) {
                this.setSelection(originalSelection);
                this.selectionPointerNode = originalPointerNode;
                this.selectionPointerPath = originalPointerNode ? originalPointerNode.getPath() : null;
                if (this.selectionPointerNode) {
                    this.selectionPointerNode.focus();
                }
            }
        });
        
        return newNode;
    }
    
    createSiblingNodeAbove(): void {
        this.createSiblingNode(-1);
    }
    
    createSiblingNodeBelow(): void {
        this.createSiblingNode(1);
    }
    
    createSiblingNode(direction: number): void {
        if (this.selectedNodes.length != 1) {
            return;
        }
        let node: MindmapNode = this.selectedNodes[0];
        let parentNode = node.parentNode;
        if (!parentNode) {
            return;
        }
        let index = parentNode.nodes.indexOf(node) + (direction > 0 ? direction : 0);
        this.createNewNode(parentNode, index);
    }
    
    createChildNode(): void {
        if (this.selectedNodes.length != 1) {
            return;
        }
        let node: MindmapNode = this.selectedNodes[0];
        let index = node.nodes.length;
        this.createNewNode(node, index);
    }
    
    createParentNode(): void {
        if (this.selectedNodes.length != 1) {
            return;
        }
        let node: MindmapNode = this.selectedNodes[0];
        let parentNode = node.parentNode;
        if (!parentNode) {
            return;
        }
        let index = parentNode.nodes.indexOf(node);
        this.createNewNode(node, index, true);
    }
    
    triggerNodeContentChanged(modifiedNodes: MindmapNode[]): void {
        let needsFreezing = modifiedNodes.length >= MindmapEditorView.BATCH_MODIFICATION_FULL_RENDER_THRESHOLD && !this.renderer.isFrozen();
        if (needsFreezing) {
            this.renderer.freeze();
        }
        for (let node of modifiedNodes) {
            node.getRenderer().triggerContentChanged();
        }
        if (needsFreezing) {
            this.renderer.unfreeze();
            this.renderer.render();
        }
    }
    
    triggerNodeStyleChanged(modifiedNodes: MindmapNode[]): void {
        let needsFreezing = modifiedNodes.length >= MindmapEditorView.BATCH_MODIFICATION_FULL_RENDER_THRESHOLD && !this.renderer.isFrozen();
        if (needsFreezing) {
            this.renderer.freeze();
        }
        for (let node of modifiedNodes) {
            node.getRenderer().triggerStyleChanged();
        }
        if (needsFreezing) {
            this.renderer.unfreeze();
            this.renderer.render();
        }
    }
    
    triggerNodeCollapsedChanged(modifiedNodes: MindmapNode[]): void {
        let needsFreezing = modifiedNodes.length >= MindmapEditorView.BATCH_MODIFICATION_FULL_RENDER_THRESHOLD && !this.renderer.isFrozen();
        if (needsFreezing) {
            this.renderer.freeze();
        }
        for (let node of modifiedNodes) {
            node.getRenderer().triggerCollapsedChanged();
        }
        if (needsFreezing) {
            this.renderer.unfreeze();
            this.renderer.render();
        }
    }
    
    triggerNodeChildListChanged(affectedParents: MindmapNode[]): void {
        let needsFreezing = affectedParents.length >= MindmapEditorView.BATCH_MODIFICATION_FULL_RENDER_THRESHOLD && !this.renderer.isFrozen();
        if (needsFreezing) {
            this.renderer.freeze();
        }
        for (let affectedParent of affectedParents) {
            affectedParent.triggerChildListChanged();
        }
        if (needsFreezing) {
            this.renderer.unfreeze();
            this.renderer.render();
        }
    }
    
    triggerNodesCreated(newNodes: MindmapNode[]): void {
        let needsFreezing = newNodes.length >= MindmapEditorView.BATCH_MODIFICATION_FULL_RENDER_THRESHOLD && !this.renderer.isFrozen();
        if (needsFreezing) {
            this.renderer.freeze();
        }
        for (let newNode of newNodes) {
            if (!newNode.getRenderer()) {
                let nodeRenderer: NodeRenderer = new NodeRenderer(newNode, this.renderer);
                newNode.setRenderer(nodeRenderer);
            }
            newNode.triggerNodeCreated();
        }
        if (needsFreezing) {
            this.renderer.unfreeze();
            this.renderer.render();
        }
    }
    
    
    
    
    
    /**************************************************
    *************** Node label edit mode **************
    ***************************************************/
    enterNodeLabelEditMode(node: MindmapNode, focusImmediately: boolean = false, clearCurrentValue: boolean = false): Q.Promise<string> {
        if (this.isInNodeLabelEditMode()) {
            this.exitNodeLabelEditMode(false);
        }
        node.enterEditMode(focusImmediately, clearCurrentValue, this.relatedHostHash, this.relatedSectionId, this.parent);
        this.editedNode = node;
        this.editedNodeDeferred = Q.defer();
        return this.editedNodeDeferred.promise;
    }
    
    exitNodeLabelEditMode(saveChanges: boolean, restoreOriginalSelectionOnCancel: boolean = true): void {
        if (!this.isInNodeLabelEditMode()) {
            return;
        }
        let oldValue = this.editedNode.label;
        let newValue = this.editedNode.exitEditMode(saveChanges);
        if (newValue !== null) {
            let oldMetaDataStr = this.editedNode.metaDataStr;
            let newMetaDataStr = undefined;
            let { metaData, html } = ContentEditableEditorMetaData.extractMetaFromHtml(newValue);
            if (metaData && metaData.filePickerData && metaData.filePickerData.length > 0) {
                newMetaDataStr = JSON.stringify(metaData);
                newValue = html;
                this.editedNode.metaDataStr = newMetaDataStr;
                this.editedNode.label = html;
            }
            let metaDataStrOperation: ChangeNodePropertyOperation = new ChangeNodePropertyOperation(this.mindmap, this.editedNode.getPath(), "metaDataStr", oldMetaDataStr, newMetaDataStr);
            let labelOperation: ChangeNodePropertyOperation = new ChangeNodePropertyOperation(this.mindmap, this.editedNode.getPath(), "label", oldValue, newValue);
            let operation = new ComplexNodeOperation(this.mindmap, [
                labelOperation,
                metaDataStrOperation,
            ]);
            this.performOperation(operation);
            this.editedNodeDeferred.resolve(newValue);
        }
        else {
            this.editedNodeDeferred.reject({ restoreOriginalSelection: restoreOriginalSelectionOnCancel });
        }
        this.editedNode.focus();
        this.editedNode = null;
        this.editedNodeDeferred = null;
    }
    
    isInNodeLabelEditMode(): boolean {
        return this.editedNode != null;
    }
    
    editSelectedNode(focusImmediately: boolean = false, clearCurrentValue: boolean = false): Q.Promise<string> {
        if (this.selectedNodes.length != 1) {
            return;
        }
        return this.enterNodeLabelEditMode(this.selectedNodes[0], focusImmediately, clearCurrentValue);
    }
    
    
    
    
    
    /**************************************************
    **************** Mindmap edit mode ****************
    ***************************************************/
    enterMindmapEditMode(): void {
        if (this.isInMindmapEditMode()) {
            return;
        }
        this.editable = true;
    }
    
    exitMindmapEditMode(): void {
        if (!this.isInMindmapEditMode()) {
            return;
        }
        this.editable = false;
    }
    
    isInMindmapEditMode(): boolean {
        return this.editable;
    }
    
    isEditable(): boolean {
        return this.isInMindmapEditMode();
    }
    
    
    
    
    
    /**************************************************
    ****************** Cut/copy/paste *****************
    ***************************************************/
    storeSelectionInClipboard(): boolean {
        if (this.selectedNodes.length == 0) {
            return false;
        }
        this.clipboard.length = 0;
        for (let node of this.selectedNodes) {
            this.clipboard.push(node);
        }
        this.triggerEvent("setClipboardNodes", JSON.stringify(this.clipboard), this.getSelectedNodesString());
        return true;
    }
    
    cutSelectedNodes(): void {
        if (this.storeSelectionInClipboard()) {
            this.clipboardIsCut = true;
        }
        // this.updateRendererCutNodes(); // Removing nodes instead of marking as cut 1/3
        this.deleteSelectedNodes();
    }
    
    copySelectedNodes(): void {
        if (this.storeSelectionInClipboard()) {
            this.clipboardIsCut = false;
        }
        this.updateRendererCutNodes();
    }
    
    getSelectedNodesString(): string {
        let str: string;
        if (this.selectedNodes.length == 0) {
            str = this.mindmap.toString();
        }
        else {
            str = this.selectedNodes
                .filter(x => !this.isAncestorSelected(x))
                .map(x => x.toString(0))
                .join("\n");
        }
        return str;
    }
    
    pasteNodesFromClipboard(alternativeTarget: boolean = null): void {
        if (this.clipboard.length == 0 || this.selectedNodes.length == 0) {
            if (this.clipboardString) {
                this.pasteFromClipboardString();
            }
            return;
        }
        
        // Get sorted clipboard and selectedNodes arrays
        let clipboard = MindmapPath.sortNodesByPath(this.clipboard);
        let selectedNodes = MindmapPath.sortNodesByPath(this.selectedNodes);
        
        // Paste
        let operations: MindmapOperation[] = [];
        // if (this.clipboardIsCut) { // Removing nodes instead of marking as cut 2/3
        //     // Cut+paste into multiple nodes is not allowed
        //     if (selectedNodes.length > 1) {
        //         return;
        //     }
            
        //     // Pasting into a cut node is not allowed (including it's tree)
        //     if (clipboard.filter(x => selectedNodes[0] == x || selectedNodes[0].isDescendantOf(x)).length > 0) {
        //         return;
        //     }
            
        //     // Create operations
        //     let destinationPath = this.getPasteDestinationPath(selectedNodes[0], alternativeTarget);
        //     for (let cutNode of clipboard) {
        //         if (MindmapPath.getParentPath(cutNode.getPath()) == MindmapPath.getParentPath(destinationPath)) {
        //             continue;
        //         }
        //         operations.push(new MoveNodeOperation(this.mindmap, cutNode.getPath(), destinationPath));
        //     }
        // }
        // else {
            if (Utils.arraysEqual(clipboard, selectedNodes)) {
                // clipboard == selected nodes => duplicate each node
                for (let node of clipboard) {
                    let destinationPath = this.getPasteDestinationPath(node, !alternativeTarget);
                    let nodeCopy: MindmapNode = MindmapNode.fromObject(node, this.mindmap);
                    operations.push(new CreateNodeOperation(this.mindmap, destinationPath, nodeCopy));
                }
            }
            else if (selectedNodes.length > 1) {
                // Pasting into multiple nodes is allowed only if clipboard == selected (case processed above)
                return;
            }
            else {
                let targetNode = selectedNodes[0];
                for (let node of clipboard) {
                    let destinationPath = this.getPasteDestinationPath(targetNode, alternativeTarget);
                    let nodeCopy: MindmapNode = MindmapNode.fromObject(node, this.mindmap);
                    operations.push(new CreateNodeOperation(this.mindmap, destinationPath, nodeCopy));
                }
            }
        // } // Removing nodes instead of marking as cut 3/3
        
        // Fix destination paths in case adding/deleting nodes would affect target paths of consecutive operations
        MindmapPath.fixTargetPathsForConsecutiveOperations(operations);
        
        if (operations.length > 0) {
            let operation = new ComplexNodeOperation(this.mindmap, operations);
            this.performOperation(operation);
            if (this.clipboardIsCut) {
                this.clipboard.length = 0;
            }
        }
        
        this.updateRendererCutNodes();
    }
    
    getPasteDestinationPath(targetNode: MindmapNode, pasteAsSibling: boolean): string {
        if (pasteAsSibling) {
            return targetNode.parentNode.getPath() + "/" + (MindmapPath.getNodeIndexFromPath(targetNode.getPath()) + 1);
        }
        else {
            return targetNode.getPath() + "/" + targetNode.nodes.length;
        }
    }
    
    updateRendererCutNodes(): void {
        if (this.clipboardIsCut) {
            let cutNodesWithDescendants: MindmapNode[] = [];
            let nodesToProcess: MindmapNode[] = this.clipboard.slice();
            while (nodesToProcess.length > 0) {
                let node = nodesToProcess.pop();
                cutNodesWithDescendants.push(node);
                for (let childNode of node.nodes) {
                    nodesToProcess.push(childNode);
                }
            }
            this.renderer.updateCutNodes(cutNodesWithDescendants);
        }
        else {
            this.renderer.updateCutNodes([]);
        }
    }
    
    cancelCut(): void {
        if (this.clipboardIsCut) {
            this.clipboardIsCut = false;
            this.clipboard.length = 0;
            this.updateRendererCutNodes();
        }
    }
    
    setClipboardStr(str: string): void {
        if (this.clipboard.length > 0) {
            this.clipboard.length = 0;
            this.clipboardIsCut = false;
        }
        this.clipboardString = str;
    }
    
    pasteFromClipboardString(): void {
        if (!this.clipboardString) {
            return;
        }
        let str = this.clipboardString;
        let lines = <[[number, MindmapNode]]>str.split("\n").map(x => {
            let level = 0;
            while ((<any>x).startsWith("\t") || (<any>x).startsWith("    ")) {
                ++level;
                if ((<any>x).startsWith("\t")) {
                    x = x.substr(1);
                }
                else if ((<any>x).startsWith("    ")) {
                    x = x.substr(4);
                }
            }
            let node = new MindmapNode(this.mindmap);
            node.label = x;
            return [level, node];
        });
        let clipboard: MindmapNode[] = [];
        let parent: MindmapNode = null;
        let parentLevel: number = 0;
        let formatOk: boolean = true;
        for (let [level, node] of lines) {
            if (level == 0) {
                parentLevel = level;
                parent = node;
                clipboard.push(node);
            }
            else {
                if (level > parentLevel + 1) {
                    formatOk = false;
                    break;
                }
                while (level != parentLevel + 1) {
                    parent = parent.parentNode;
                    --parentLevel;
                }
                parent.nodes.push(node);
                node.parentNode = parent;
                parent = node;
                parentLevel = level;
            }
        }
        if (!formatOk) {
            this.clipboardString = null;
            return;
        }
        // console.log(this.clipboardString);
        // let d = (n: MindmapNode, l: number) => {
        //     console.log((<any>"____").repeat(l) + n.label);
        //     for (let n2 of n.nodes) {
        //         d(n2, l+1);
        //     }
        // };
        // for (let n of clipboard) {
        //     d(n, 0);
        // }
        
        let operations: MindmapOperation[] = [];
        let selectedNodes = MindmapPath.sortNodesByPath(this.selectedNodes);
        let targetNode = selectedNodes[0];
        for (let node of clipboard) {
            let destinationPath = this.getPasteDestinationPath(targetNode, false);
            let nodeCopy: MindmapNode = MindmapNode.fromObject(node, this.mindmap);
            operations.push(new CreateNodeOperation(this.mindmap, destinationPath, nodeCopy));
        }
        MindmapPath.fixTargetPathsForConsecutiveOperations(operations);
        if (operations.length > 0) {
            let operation = new ComplexNodeOperation(this.mindmap, operations);
            this.performOperation(operation);
        }
    }
    
    setClipboardNodes(str: string): void {
        this.clipboard = JSON.parse(str).map((x: any) => MindmapNode.fromObject(x, this.mindmap));
        this.clipboardIsCut = false;
    }
    
    
    
    
    
    /**************************************************
    ************* Operations and undo/redo ************
    ***************************************************/
    performOperation(operation: MindmapOperation, mode: OperationExecutionMode = OperationExecutionMode.NORMAL): MindmapOperationResult {
        let result = operation.perform();
        if (mode == OperationExecutionMode.UNDO) {
            this.redoStack.push(operation);
        }
        else if (mode == OperationExecutionMode.REDO) {
            this.undoStack.push(operation);
        }
        else if (mode == OperationExecutionMode.NORMAL) {
            this.redoStack.length = 0;
            this.undoStack.push(operation);
        }
        this.triggerEvent("performOperation", JSON.stringify(operation));
        if (result.mindmapPropertiesChanged && result.mindmapPropertiesChanged.length > 0) {
            if (result.mindmapPropertiesChanged.indexOf("style") >= 0) {
                let styleName = this.mindmap.style ? this.mindmap.style.name : null;
                if (styleName) {
                    this.$component.attr("data-style-name", styleName);
                }
                else {
                    this.$component.removeAttr("data-style-name");
                }
                this.setEditorFontSize(this.mindmap.getFontSize());
                this.renderer.render();
                if ("setStyle" in this.parent) {
                    let style: { styleName: string, fontSize: string } = {
                        styleName,
                        fontSize: this.mindmap.style && this.mindmap.style.fontSize && this.mindmap.style.fontSize in Mindmap.AVAILABLE_FONT_SIZES ? this.mindmap.style.fontSize : Mindmap.DEFAULT_FONT_SIZE,
                    };
                    (<any>this.parent).setStyle(JSON.stringify(style), false);
                }
            }
        }
        if (result.nodesCreated && result.nodesCreated.length > 0) {
            this.triggerNodesCreated(result.nodesCreated);
        }
        if (result.nodesContentChanged && result.nodesContentChanged.length > 0) {
            this.triggerNodeContentChanged(result.nodesContentChanged);
        }
        if (result.nodesStyleChanged && result.nodesStyleChanged.length > 0) {
            this.triggerNodeStyleChanged(result.nodesStyleChanged);
        }
        if (result.nodesCollapsedChanged && result.nodesCollapsedChanged.length > 0) {
            this.triggerNodeCollapsedChanged(result.nodesCollapsedChanged);
        }
        if (result.nodesChildListChanged && result.nodesChildListChanged.length > 0) {
            this.triggerNodeChildListChanged(result.nodesChildListChanged);
        }
        this.updateDirtyState();
        return result;
    }
    
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }
    
    undo(): void {
        if (!this.canUndo()) {
            return;
        }
        let operation = this.undoStack.pop().getReverseOperation();
        this.performOperation(operation, OperationExecutionMode.UNDO);
    }
    
    redo(): void {
        if (!this.canRedo()) {
            return;
        }
        let operation = this.redoStack.pop().getReverseOperation();
        this.performOperation(operation, OperationExecutionMode.REDO);
    }
    
    
    
    
    
    /**************************************************
    ******************* Dirty state *******************
    ***************************************************/
    isDirty(): boolean {
        let signature = this.mindmap.getSignature();
        if (signature != this._savedSignature) {
            return true;
        }
        return false;
    }
    
    updateDirtyState(): void {
        if (!this.isInMindmapEditMode()) {
            return;
        }
        let isDirty = this.isDirty();
        if (isDirty != this._prevIsDirty) {
            this.triggerEvent("setIsDirty", isDirty);
            this._prevIsDirty = isDirty;
        }
    }
    
    afterSaved(): void {
        this._prevIsDirty = false;
        this._savedSignature = this.mindmap.getSignature();
        this.updateDirtyState();
    }
    
    
    
    
    
    /**************************************************
    **************** Task/file pickers ****************
    ***************************************************/
    setTaskStatuses(taskStatusesStr: string, nodePathsToReRenderStr: string): void {
        let taskStatuses: { [taskId: string]: string } = JSON.parse(taskStatusesStr);
        let nodePathsToReRender: string[] = JSON.parse(nodePathsToReRenderStr);
        this.taskStatuses = taskStatuses;
        
        if (this.mindmap) {
            let nodes: MindmapNode[] = [];
            for (let nodePath of nodePathsToReRender.sort((a, b) => b.localeCompare(a))) {
                let node = this.mindmap.getTargetNodeFromPath(MindmapPath.convertSortablePathToPath(nodePath));
                if (node) {
                    nodes.push(node);
                }
            }
            if (nodes.length > 0) {
                this.triggerNodeContentChanged(nodes);
            }
        }
    }
    
    
    
    
    
    /**************************************************
    ******************** Font size ********************
    ***************************************************/
    setSmallerFontSize(): void {
        this.setAdjacentFontSize(-1);
    }
    
    setLargerFontSize(): void {
        this.setAdjacentFontSize(1);
    }
    
    setAdjacentFontSize(direction: -1|1): void {
        if (!this.mindmap) {
            return;
        }
        let availableSizes = this.getAvailableFontSizesArray();
        let currSizeStr = this.mindmap.getFontSize();
        let currSize = availableSizes.filter(x => x.cssSize == currSizeStr)[0];
        if (!currSize) {
            return;
        }
        let idx = availableSizes.indexOf(currSize);
        let newIdx = idx + direction;
        if (newIdx < 0 || newIdx > (availableSizes.length - 1)) {
            return;
        }
        let newSize = availableSizes[newIdx];
        // this.setEditorFontSize(newSize.cssSize);
        if ("setFontSize" in this.parent) {
            (<any>this.parent).setFontSize(newSize.cssSize);
        }
    }
    
    getAvailableFontSizesArray(): { cssSize: string, displayedSize: string }[] {
        let arr: { cssSize: string, displayedSize: string }[] = [];
        for (let cssSize in Mindmap.AVAILABLE_FONT_SIZES) {
            let displayedSize = Mindmap.AVAILABLE_FONT_SIZES[cssSize];
            arr.push({ cssSize, displayedSize });
        }
        return arr.sort((a, b) => parseFloat(a.cssSize) - parseFloat(b.cssSize));
    }
    
}
