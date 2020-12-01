import { MindmapNode } from "./MindmapNode";
import { Mindmap } from "./Mindmap";

export class MindmapElement {
    
    spec: MindmapNode = null;
    klass: string = "MindMapElement";
    
    static fromJson(json: string, mindmap: Mindmap): MindmapElement {
        let obj = JSON.parse(json);
        return this.fromObject(obj, mindmap);
    }
    
    static fromObject(obj: any, mindmap: Mindmap): MindmapElement {
        let element: MindmapElement = new MindmapElement();
        element.spec = MindmapNode.fromObject(obj.spec, mindmap);
        return element;
    }
    
    constructor() {
        
    }
    
    getSignature(): string {
        return "<" + this.spec.getSignature() + ">";
    }
    
    collectStrings(strings: { [nodePath: string]: string } = {}): { [nodePath: string]: string } {
        this.spec.collectStrings(strings);
        return strings;
    }
    
    
    
    
    
    /**************************************************
    **************** String conversion ****************
    ***************************************************/
    toString(depth: number): string {
        return this.spec.toString(depth);
    }
    
}
