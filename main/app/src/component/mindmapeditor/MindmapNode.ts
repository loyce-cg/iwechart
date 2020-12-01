import { NodeRenderer } from "./NodeRenderer";
import { MindmapRenderer } from "./MindmapRenderer";
import Q = require("q");
import { Mindmap } from "./Mindmap";

export enum MindmapNodeStyle {
    Style1 = 1,
    Style2 = 2,
    Style3 = 3,
    Style4 = 4,
}

export enum MindmapNodeTaskState {
    ToDo = "todo",
    Done = "done",
}

export class MindmapNode {
    
    protected _metaDataStr?: string;
    protected _label: string = "";
    protected _collapsed?: boolean;
    protected _style?: MindmapNodeStyle;
    protected _important?: boolean;
    protected _taskState?: MindmapNodeTaskState;
    protected _parentNode?: MindmapNode;
    protected _renderer?: NodeRenderer;
    protected _mindmap?: Mindmap;
    nodes: MindmapNode[] = [];
    
    protected _mostRecentlySelectedChild: MindmapNode = null;
    protected _mostRecentlySelectedChildIndex: number = null;
    protected _cachedPath?: string;
    
    get metaDataStr(): string {
        return this._metaDataStr || "";
    }
    
    set metaDataStr(value: string) {
        this._metaDataStr = value || "";
    }
    
    get label(): string {
        return this._label;
    }
    set label(value: string) {
        this._label = value;
    }
    
    get collapsed(): boolean {
        return this._collapsed;
    }
    set collapsed(value: boolean) {
        if (value) {
            this._collapsed = true;
        }
        else {
            delete this._collapsed;
        }
    }
    
    get style(): MindmapNodeStyle {
        return this._style;
    }
    set style(value: MindmapNodeStyle) {
        if (value) {
            this._style = value;
        }
        else {
            delete this._style;
        }
    }
    
    get important(): boolean {
        return this._important;
    }
    set important(value: boolean) {
        if (value) {
            this._important = true;
        }
        else {
            delete this._important;
        }
    }
    
    get taskState(): MindmapNodeTaskState {
        return this._taskState;
    }
    set taskState(value: MindmapNodeTaskState) {
        if (value) {
            this._taskState = value;
        }
        else {
            delete this._taskState;
        }
    }
    
    get parentNode(): MindmapNode {
        return this._parentNode;
    }
    set parentNode(value: MindmapNode) {
        this._parentNode = value;
        this.invalidateCachedPath();
    }
    
    get mindmap(): Mindmap {
        return this._mindmap;
    }
    set mindmap(value: Mindmap) {
        this._mindmap = value;
        this.invalidateCachedPath();
    }
    
    constructor(mindmap: Mindmap) {
        this._mindmap = mindmap;
    }
    
    setRenderer(renderer: NodeRenderer): void {
        this._renderer = renderer;
    }
    
    getRenderer(): NodeRenderer {
        return this._renderer;
    }
    
    getParents(): MindmapNode[] {
        let parents: MindmapNode[] = [];
        let parent = this.parentNode;
        while (parent != null) {
            parents.push(parent);
            parent = parent.parentNode;
        }
        return parents;
    }
    
    getIndex(): number {
        if (!this.parentNode) {
            let elements = this.mindmap.elements;
            let nodes = elements.map(x => x.spec);
            return nodes.indexOf(this);
        }
        return this.parentNode.nodes.indexOf(this);
    }
    
    getPath(): string {
        if (this._cachedPath) {
            return this._cachedPath;
        }
        let nodesIds = this.getParents().reverse().map(x => x.getIndex());
        nodesIds.push(this.getIndex());
        let path = "/" + nodesIds.join("/");
        this._cachedPath = path;
        return path;
    }
    
    getSortablePath(): string {
        let nodesIds = this.getParents().reverse().map(x => x.getIndex());
        nodesIds.push(this.getIndex());
        let path = "/" + nodesIds.map(x => (<any>x.toString()).padStart(5, "0")).join("/");
        return path;
    }
    
    invalidateCachedPath(): void {
        delete this._cachedPath;
        this.invalidateChildrenCachedPaths();
    }
    
    invalidateChildrenCachedPaths(firstIndex: number = 0, lastIndex: number = null): void {
        if (lastIndex === null) {
            lastIndex = this.nodes.length - 1;
        }
        for (let i = firstIndex; i <= lastIndex; ++i) {
            this.nodes[i].invalidateCachedPath();
        }
    }
    
    isVisible(): boolean {
        if (this.parentNode == null) {
            return true;
        }
        if (this.parentNode.collapsed || !this.parentNode.isVisible()) {
            return false;
        }
        return true;
    }
    
    swapChildren(node0: MindmapNode, node1: MindmapNode): boolean {
        let idx0 = this.nodes.indexOf(node0);
        let idx1 = this.nodes.indexOf(node1);
        if (idx0 >= 0 && idx1 >= 0) {
            this.swapChildrenByIndex(idx0, idx1);
            return true;
        }
        return false;
    }
    
    swapChildrenByIndex(idx0: number, idx1: number): void {
        this.nodes.splice(idx0, 0, this.nodes.splice(idx1, 1)[0]);
        this.nodes[idx0].invalidateCachedPath();
        this.nodes[idx1].invalidateCachedPath();
    }
    
    insertChild(node: MindmapNode, index: number = null): void {
        if (index === null) {
            this.nodes.push(node);
        }
        else {
            this.nodes.splice(index, 0, node);
        }
        if (node.parentNode) {
            let idx = node.parentNode.nodes.indexOf(node);
            node.parentNode.nodes.splice(idx, 1);
            node.parentNode.invalidateChildrenCachedPaths(idx);
        }
        node.parentNode = this;
        this.invalidateChildrenCachedPaths(index === null ? this.nodes.length - 1 : index);
    }
    
    removeChild(nodeOrIndex: MindmapNode|number): boolean {
        let node: MindmapNode = (nodeOrIndex instanceof MindmapNode ? nodeOrIndex : this.nodes[nodeOrIndex]);
        let index: number = (nodeOrIndex instanceof MindmapNode ? this.nodes.indexOf(nodeOrIndex) : nodeOrIndex);
        if (node && index >= 0) {
            this.nodes.splice(index, 1);
            node.parentNode = null;
            return true;
        }
        return false;
    }
    
    addParent(midNode: MindmapNode): boolean {
        if (!this.parentNode) {
            return false;
        }
        let childNode: MindmapNode = this;
        let parentNode: MindmapNode = this.parentNode;
        let index = parentNode.nodes.indexOf(childNode);
        parentNode.removeChild(childNode);
        parentNode.insertChild(midNode, index);
        midNode.insertChild(childNode, 0);
    }
    
    getAllDescendants(): MindmapNode[] {
        let descendants: MindmapNode[] = [];
        let nodesToProcess: MindmapNode[] = [];
        nodesToProcess.push(this);
        while (nodesToProcess.length > 0) {
            let nodeToProcess = nodesToProcess.pop();
            for (let childNode of nodeToProcess.nodes) {
                nodesToProcess.push(childNode);
                descendants.push(childNode);
            }
        }
        return descendants;
    }
    
    isDescendantOf(node: MindmapNode): boolean {
        let parent = this.parentNode;
        while (parent != null) {
            if (parent == node) {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
    }
    
    getSignature(): string {
        let flags = 0;
        if (this.collapsed) {
            flags += 1;
        }
        if (this.important) {
            flags += 2;
        }
        
        let nodesSignatures: string[] = this.nodes.map(x => x.getSignature());
        let nodesSignaturesStrings: string = nodesSignatures.join(",");
        
        let signature = `{${flags},${this.taskState},${this.style},${this.label},[${nodesSignaturesStrings}]}`;
        return signature;
    }
    
    focus(): void {
        if (this._renderer && this._renderer.$node) {
            this._renderer.$node.focus();
        }
    }
    
    collectStrings(strings: { [nodePath: string]: string } = {}): { [nodePath: string]: string } {
        strings[this.getSortablePath()] = this.label;
        for (let node of this.nodes) {
            node.collectStrings(strings);
        }
        return strings;
    }
    
    getPreviousNode(matchFunction: (node: MindmapNode) => boolean = () => true): MindmapNode {
        if (!this.parentNode) {
            return null;
        }
        let myIdx = this.parentNode.nodes.indexOf(this);
        if (myIdx < 0) {
            return null;
        }
        for (let idx = myIdx - 1; idx >= 0; --idx) {
            let node = this.parentNode.nodes[idx];
            if (matchFunction(node)) {
                return node;
            }
        }
        return null;
    }
    
    getNextNode(matchFunction: (node: MindmapNode) => boolean = () => true): MindmapNode {
        if (!this.parentNode) {
            return null;
        }
        let myIdx = this.parentNode.nodes.indexOf(this);
        if (myIdx < 0) {
            return null;
        }
        for (let idx = myIdx + 1; idx < this.parentNode.nodes.length; ++idx) {
            let node = this.parentNode.nodes[idx];
            if (matchFunction(node)) {
                return node;
            }
        }
        return null;
    }
    
    
    
    
    
    /**************************************************
    ********************* Triggers ********************
    ***************************************************/
    triggerNodeStyleChanged(): void {
        if (this._renderer) {
            this._renderer.triggerStyleChanged();
        }
    }
    
    triggerNodeContentChanged(): void {
        if (this._renderer) {
            this._renderer.triggerContentChanged();
        }
    }
    
    triggerChildSizeChanged(): void {
        if (this._renderer) {
            this._renderer.triggerChildSizeChanged();
        }
    }
    
    triggerChildListChanged(): void {
        if (this._renderer) {
            this._renderer.triggerChildListChanged();
        }
    }
    
    triggerChildrenChanged(): void {
        if (this._renderer) {
            this._renderer.triggerChildrenChanged();
        }
    }
    
    triggerNodeCreated(): void {
        if (this._renderer) {
            this._renderer.triggerNodeCreated();
        }
    }
    
    
    
    
    
    /**************************************************
    ******************** Edit mode ********************
    ***************************************************/
    enterEditMode(focusImmediately: boolean = false, clearCurrentValue: boolean = false, relatedHostHash: string = null, relatedSectionId: string = null, parentWindow: any = null): void {
        if (this._renderer) {
            this._renderer.enterEditMode(focusImmediately, clearCurrentValue, relatedHostHash, relatedSectionId, parentWindow);
        }
    }
    
    exitEditMode(saveChanges: boolean): string {
        if (this._renderer) {
            let str = this._renderer.exitEditMode().trim();
            if (saveChanges && this.label != str) {
                // this.label = str;
                // this.triggerNodeContentChanged();
                return str;
            }
        }
        return null;
    }
    
    isEditorF2TipOpen(): boolean {
        return this._renderer && this._renderer.isEditorF2TipOpen();
    }
    
    
    
    
    
    /**************************************************
    **************** String conversion ****************
    ***************************************************/
    toString(depth: number): string {
        let paddingStr = (<any>"\t").repeat(depth);
        let nodeStr = `${paddingStr}${this._toStringWithoutChildren()}`;
        let childrenStr = this.nodes.map(x => x.toString(depth + 1)).join("\n");
        return `${nodeStr}${childrenStr.length > 0 ? "\n" : ""}${childrenStr}`;
    }
    
    protected _toStringWithoutChildren(): string {
        return this.label;
    }
    
    
    
    
    
    /**************************************************
    ************ Smart child node selection ***********
    ***************************************************/
    getChildNodeToSelect(): MindmapNode {
        let node = this._mostRecentlySelectedChild;
        if (this.nodes.indexOf(node) >= 0) {
            return node;
        }
        
        let idx = Math.min(this._mostRecentlySelectedChildIndex || 0, this.nodes.length - 1);
        return this.nodes[idx] || this;
    }
    
    onChildNodeSelected(childNode: MindmapNode): void {
        let idx = this.nodes.indexOf(childNode);
        if (idx >= 0) {
            this._mostRecentlySelectedChild = childNode;
            this._mostRecentlySelectedChildIndex = idx;
        }
    }
    
    
    
    
    
    /**************************************************
    **************** JSON-related stuff ***************
    ***************************************************/
    static serializableProperties: string[] = ["label", "collapsed", "style", "important", "taskState", "nodes"];
    
    toJSON(): any {
        let res: any = {};
        for (let k in this) {
            if (MindmapNode.serializableProperties.indexOf(k) >= 0) {
                res[k] = this[k];
            }
        }
        return res;
    }
    
    static fromJson(json: string, mindmap: Mindmap): MindmapNode {
        let obj = JSON.parse(json);
        return this.fromObject(obj, mindmap);
    }
    
    static fromObject(obj: any, mindmap: Mindmap): MindmapNode {
        let node: MindmapNode = new MindmapNode(mindmap);
        node.label = obj.label;
        this.copyProperties(node, obj);
        for (let nodeObj of obj.nodes) {
            let childNode = MindmapNode.fromObject(nodeObj, mindmap);
            childNode.parentNode = node;
            node.nodes.push(childNode);
        }
        return node;
    }
    
    static copyProperties(target: MindmapNode, source: Partial<MindmapNode>): void {
        if (source.label) {
            target.label = source.label;
        }
        if (source.collapsed) {
            target.collapsed = source.collapsed;
        }
        if (source.style) {
            target.style = source.style;
        }
        if (source.important) {
            target.important = source.important;
        }
        if (source.taskState) {
            target.taskState = source.taskState;
        }
    }
    
}
