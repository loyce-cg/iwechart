import { MindmapElement } from "./MindmapElement";
import { MindmapNode, MindmapNodeTaskState } from "./MindmapNode";
import { MindmapRenderer } from "./MindmapRenderer";
import { MindmapPath } from "./MindmapPath";
import { LocaleService } from "../../mail/LocaleService";

export interface VisitPathOptions {
    
    allowNegativeIndexes?: boolean;
    
    visitNode?: (node: MindmapNode, nodePath: string) => void;
    visitFinalNode?: (node: MindmapNode, nodePath: string) => void;
    missingNode?: (missingNodePath: string, missingNodeParent: MindmapNode, missingNodeParentPath: string) => void,
    missingFinalNode?: (missingNodePath: string, missingNodeParent: MindmapNode, missingNodeParentPath: string) => void,
    
}

export type KeyOfVisitPathOptions = Extract<keyof VisitPathOptions, string>;

export class Mindmap {
    
    static AVAILABLE_STYLES: { [key: string]: string } = {
        "default": "Default",
        "terminal": "Terminal",
        "black-on-white": "Black on white",
        "white-on-black": "White on black",
        "papyrus": "Papyrus"
    };
    static STYLE_BACKGROUNDS: { [key: string]: string } = {
        "default": "#fff",
        "terminal": "#111",
        "black-on-white": "#fff",
        "white-on-black": "#000",
        "papyrus": "#eae39f"
    };
    static DEFAULT_STYLE_NAME = "default";
    static AVAILABLE_FONT_SIZES: { [key: string]: string } = {
        "11.2px": "80%",
        "14px": "100%",
        "16.8px": "120%",
        "19.6px": "140%",
        "22.4px": "160%",
    };
    static DEFAULT_FONT_SIZE = "14px";
    static AVAILABLE_MARGINS: { [key: string]: string } = {
        "0%": "editors.style.margins.0",
        "10%": "editors.style.margins.10",
        "20%": "editors.style.margins.20",
    };
    static DEFAULT_MARGIN = "0%";
    
    protected _renderer: MindmapRenderer;
    elements: MindmapElement[] = [];
    version: number;
    style?: { name: string, fontSize: string };
    
    constructor() {
    }
    
    nextTaskState(state: MindmapNodeTaskState): MindmapNodeTaskState {
        if (state == MindmapNodeTaskState.ToDo) {
            return MindmapNodeTaskState.Done;
        }
        else if (state == MindmapNodeTaskState.Done) {
            return null;
        }
        return MindmapNodeTaskState.ToDo;
    }
    
    setRenderer(renderer: MindmapRenderer): void {
        this._renderer = renderer;
    }
    
    getSignature(): string {
        let styleName = this.getStyleName();
        let fontSize = this.getFontSize();
        let elementSignatures = this.elements.map(x => x.getSignature()).join(",");
        return `${this.version},${styleName},${fontSize},[${elementSignatures}]`;
    }
    
    getStyle(): { name: string, fontSize: string } {
        return { name: this.getStyleName(), fontSize: this.getFontSize() };
    }
    
    getStyleName(): string {
        return this.style && this.style.name && this.style.name in Mindmap.AVAILABLE_STYLES ? this.style.name : Mindmap.DEFAULT_STYLE_NAME;
    }
    
    getFontSize(): string {
        return this.style && this.style.fontSize && this.style.fontSize in Mindmap.AVAILABLE_FONT_SIZES ? this.style.fontSize : Mindmap.DEFAULT_FONT_SIZE;
    }
    
    
    
    
    
    /**************************************************
    *********************** Path **********************
    ***************************************************/
    visitPath(path: string, options: VisitPathOptions): void {
        // Default funcs
        let keys: KeyOfVisitPathOptions[] = ["visitNode", "visitFinalNode", "missingNode", "missingFinalNode"];
        for (let key of keys) {
            if (!options[key]) {
                options[key] = <any>(() => {});
            }
        }
        
        // Parse the path
        let nodeIds: number[] = MindmapPath.parsePath(path);
        
        // Create virtual root node
        let virtualRoot: MindmapNode = new MindmapNode(this);
        let node: MindmapNode = virtualRoot;
        node.nodes = this.elements.map(x => x.spec);
        
        // Visit
        let currPath = "";
        for (let i = 0; i < nodeIds.length; ++i) {
            let id = nodeIds[i];
            currPath += "/" + id;
            if (id < 0 && options.allowNegativeIndexes) {
                id = node.nodes.length + id;
            }
            if (id in node.nodes) {
                node = node.nodes[id];
                options.visitNode(node, node.getPath());
                if (currPath == path) {
                    options.visitFinalNode(node, node.getPath());
                }
            }
            else {
                let parentNode = node == virtualRoot ? null : node;
                let parentPath = node == virtualRoot ? null : node.getPath();
                options.missingNode(currPath, parentNode, parentPath);
                if (currPath == path) {
                    options.missingFinalNode(currPath, parentNode, parentPath);
                }
                break;
            }
        }
    }
    
    getTargetNodeFromPath(path: string): MindmapNode {
        let node: MindmapNode = null;
        this.visitPath(path, {
            visitFinalNode: finalNode => {
                node = finalNode;
            },
        });
        return node;
    }
    
    getOrCreateTargetNodeFromPath(path: string, defaultNode: MindmapNode): MindmapNode {
        let node: MindmapNode = null;
        this.visitPath(path, {
            visitFinalNode: finalNode => {
                node = finalNode;
            },
            missingFinalNode: (missingNodePath, missingNodeParent) => {
                let index = MindmapPath.getNodeIndexFromPath(path);
                if (index < 0) {
                    index = missingNodeParent.nodes.length + index + 1;
                }
                missingNodeParent.nodes.splice(index, 0, defaultNode);
                node = defaultNode;
                node.parentNode = missingNodeParent;
            },
        });
        return node;
    }
    
    collectStrings(strings: { [nodePath: string]: string } = {}): { [nodePath: string]: string } {
        for (let element of this.elements) {
            element.collectStrings(strings);
        }
        return strings;
    }
    
    
    
    
    
    /**************************************************
    **************** Node manipulation ****************
    ***************************************************/
    insertNode(path: string, node: MindmapNode): void {
        let nodeAtDestination = this.getOrCreateTargetNodeFromPath(path, node);
        if (nodeAtDestination != node) {
            let parentNode = nodeAtDestination.parentNode;
            let index = MindmapPath.getNodeIndexFromPath(path);
            parentNode.nodes.splice(index, 0, node);
            node.parentNode = parentNode;
            node.parentNode.invalidateChildrenCachedPaths(index);
        }
    }
    
    deleteNode(path: string): boolean {
        let node: MindmapNode = this.getTargetNodeFromPath(path);
        if (node) {
            let idx = node.parentNode.nodes.indexOf(node);
            node.parentNode.nodes.splice(idx, 1);
            node.parentNode.invalidateChildrenCachedPaths(idx);
            node.parentNode = null;
            let renderer = node.getRenderer();
            if (renderer) {
                renderer.delete();
            }
            return true;
        }
        return false;
    }
    
    updateNodeProperties(path: string, partialNode: Partial<MindmapNode>): boolean {
        let node = this.getTargetNodeFromPath(path);
        if (node) {
            MindmapNode.copyProperties(node, partialNode);
            return true;
        }
        return false;
    }
    
    moveNode(sourcePath: string, destinationPath: string): boolean {
        let node = this.getTargetNodeFromPath(sourcePath);
        if (!node && sourcePath.indexOf("-") >= 0) {
            sourcePath = MindmapPath.convertNegativeIndexes(sourcePath, this);
            node = this.getTargetNodeFromPath(sourcePath);
        }
        if (node) {
            // Remove
            if (node.parentNode) {
                let index = node.parentNode.nodes.indexOf(node);
                node.parentNode.nodes.splice(index, 1);
                node.parentNode.invalidateChildrenCachedPaths();
            }
            
            // Insert
            let nodeAtDestination: MindmapNode = this.getOrCreateTargetNodeFromPath(destinationPath, node);
            if (nodeAtDestination != node) {
                let index = nodeAtDestination.parentNode.nodes.indexOf(nodeAtDestination);
                nodeAtDestination.parentNode.nodes.splice(index, 0, node);
                node.parentNode = nodeAtDestination.parentNode;
                node.parentNode.invalidateChildrenCachedPaths();
            }
            return true;
        }
        return false;
    }
    
    getAllNodes(): MindmapNode[] {
        let allNodes: MindmapNode[] = [];
        let st: MindmapNode[] = [];
        for (let el of this.elements) {
            st.push(el.spec);
        }
        while (st.length > 0) {
            let el = st.pop();
            allNodes.push(el);
            for (let el2 of el.nodes) {
                st.push(el2);
            }
        }
        return allNodes;
    }
    
    
    
    
    
    /**************************************************
    **************** String conversion ****************
    ***************************************************/
    toString(): string {
        return this.elements.map(x => x.toString(0)).join("\n");
    }
    
    
    
    
    
    /**************************************************
    **************** JSON-related stuff ***************
    ***************************************************/
    static fromJson(json: string): Mindmap {
        let obj = JSON.parse(json);
        return this.fromObject(obj);
    }
    
    static fromObject(obj: any): Mindmap {
        let mindmap: Mindmap = new Mindmap();
        mindmap.version = obj.version;
        if (obj.style) {
            mindmap.style = obj.style;
        }
        for (let elementObj of obj.elements) {
            mindmap.elements.push(MindmapElement.fromObject(elementObj, mindmap));
        }
        return mindmap;
    }
    
}
