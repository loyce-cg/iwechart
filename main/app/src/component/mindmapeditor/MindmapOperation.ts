import { MindmapNode } from "./MindmapNode";
import { Mindmap } from "./Mindmap";
import { PrivmxSet } from "./PrivmxSet";
import { MindmapPath } from "./MindmapPath";

export type KeyOfMindmap = Extract<keyof Mindmap, string>;
export type KeyOfMindmapNode = Extract<keyof MindmapNode, string>;
export type KeyOfOperationResult = Extract<keyof MindmapOperationResult, string>;

export interface MindmapOperationResult {
    
    mindmapPropertiesChanged?: string[];
    nodesContentChanged?: MindmapNode[];
    nodesStyleChanged?: MindmapNode[];
    nodesCollapsedChanged?: MindmapNode[];
    nodesChildListChanged?: MindmapNode[];
    nodesCreated?: MindmapNode[];
    nodesDeleted?: MindmapNode[];
    
}

export abstract class MindmapOperation {
    
    static resultPropertyNames: KeyOfOperationResult[] = ["nodesContentChanged", "nodesStyleChanged", "nodesCollapsedChanged", "nodesChildListChanged", "nodesCreated", "nodesDeleted"];
    
    constructor(public mindmap: Mindmap) {
    }
    
    abstract perform(): MindmapOperationResult;
    
    abstract getReverseOperation(): MindmapOperation;
    
    toJSON(): any {
        let res: any = {};
        for (let k in this) {
            if (k != "mindmap") {
                res[k] = this[k];
            }
        }
        return res;
    }
    
    static Classes: { [key: string]: any };
    
    static fromJson(json: string, mindmap: Mindmap): MindmapOperation {
        let obj = JSON.parse(json);
        obj.mindmap = mindmap;
        return this.fromObject(obj);
    }
    
    static fromObject(obj: any): MindmapOperation {
        let operation: MindmapOperation = this.Classes[obj.className].createInstance(obj);
        return operation;
    }
    
    static createInstance(obj: Partial<MindmapOperation>): MindmapOperation {
        throw new Error("NotImplemented");
    }
    
}

export class ChangeMindmapPropertyOperation extends MindmapOperation {
    
    propertyName: KeyOfMindmap;
    propertyOldValue: any;
    propertyNewValue: any;
    
    constructor(mindmap: Mindmap, propertyName: KeyOfMindmap, propertyOldValue: any, propertyNewValue: any) {
        super(mindmap);
        this.propertyName = propertyName;
        this.propertyOldValue = propertyOldValue;
        this.propertyNewValue = propertyNewValue;
    }
    
    perform(): MindmapOperationResult {
        (<any>this.mindmap[this.propertyName]) = this.propertyNewValue;
        
        let result: MindmapOperationResult = {};
        if (this.propertyName == "style") {
            result.mindmapPropertiesChanged = ["style"];
        }
        return result;
    }
    
    getReverseOperation(): MindmapOperation {
        let propertyOldValue = this.propertyNewValue;
        let propertyNewValue = this.propertyOldValue;
        return new ChangeMindmapPropertyOperation(this.mindmap, this.propertyName, propertyOldValue, propertyNewValue);
    }
    
    static createInstance(obj: Partial<ChangeMindmapPropertyOperation>): ChangeMindmapPropertyOperation {
        return new ChangeMindmapPropertyOperation(obj.mindmap, obj.propertyName, obj.propertyOldValue, obj.propertyNewValue);
    }
    
}

export class CreateNodeOperation extends MindmapOperation {
    
    nodePath: string;
    serializedNode: string;
    
    constructor(mindmap: Mindmap, nodePath: string, node: MindmapNode) {
        super(mindmap);
        this.nodePath = nodePath;
        this.serializedNode = JSON.stringify(node);
    }
    
    perform(): MindmapOperationResult {
        let newNode: MindmapNode = MindmapNode.fromJson(this.serializedNode, this.mindmap);
        this.mindmap.insertNode(this.nodePath, newNode);
        
        let createdNodes: MindmapNode[] = [];
        let nodesToProcess: MindmapNode[] = [];
        nodesToProcess.push(newNode);
        while (nodesToProcess.length > 0) {
            let node = nodesToProcess.pop();
            createdNodes.push(node);
            for (let childNode of node.nodes) {
                nodesToProcess.push(childNode);
            }
        }
        
        return { nodesCreated: createdNodes, nodesChildListChanged: [newNode.parentNode] };
    }
    
    getReverseOperation(): MindmapOperation {
        return new DeleteNodeOperation(this.mindmap, this.nodePath, MindmapNode.fromJson(this.serializedNode, this.mindmap));
    }
    
    static createInstance(obj: Partial<CreateNodeOperation>): CreateNodeOperation {
        return new CreateNodeOperation(obj.mindmap, obj.nodePath, MindmapNode.fromJson(obj.serializedNode, obj.mindmap));
    }
    
}

export class ChangeNodePropertyOperation extends MindmapOperation {
    
    nodePath: string;
    propertyName: KeyOfMindmapNode;
    propertyOldValue: any;
    propertyNewValue: any;
    
    constructor(mindmap: Mindmap, nodePath: string, propertyName: KeyOfMindmapNode, propertyOldValue: any, propertyNewValue: any) {
        super(mindmap);
        this.nodePath = nodePath;
        this.propertyName = propertyName;
        this.propertyOldValue = propertyOldValue;
        this.propertyNewValue = propertyNewValue;
    }
    
    perform(): MindmapOperationResult {
        let node = this.mindmap.getTargetNodeFromPath(this.nodePath);
        (<any>node[this.propertyName]) = this.propertyNewValue;
        
        let result: MindmapOperationResult = {};
        if (this.propertyName == "label") {
            result.nodesContentChanged = [node];
        }
        else if (this.propertyName == "collapsed") {
            result.nodesCollapsedChanged = [node];
        }
        else {
            result.nodesStyleChanged = [node];
        }
        return result;
    }
    
    getReverseOperation(): MindmapOperation {
        let propertyOldValue = this.propertyNewValue;
        let propertyNewValue = this.propertyOldValue;
        return new ChangeNodePropertyOperation(this.mindmap, this.nodePath, this.propertyName, propertyOldValue, propertyNewValue);
    }
    
    static createInstance(obj: Partial<ChangeNodePropertyOperation>): ChangeNodePropertyOperation {
        return new ChangeNodePropertyOperation(obj.mindmap, obj.nodePath, obj.propertyName, obj.propertyOldValue, obj.propertyNewValue);
    }
    
}

export class MoveNodeOperation extends MindmapOperation {
    
    nodeOldPath: string;
    nodeNewPath: string;
    
    constructor(mindmap: Mindmap, nodeOldPath: string, nodeNewPath: string) {
        super(mindmap);
        this.nodeOldPath = nodeOldPath;
        this.nodeNewPath = nodeNewPath;
    }
    
    perform(): MindmapOperationResult {
        let affectedParents: PrivmxSet<MindmapNode> = new PrivmxSet<MindmapNode>();
        
        [this.nodeOldPath, this.nodeNewPath]
            .map(x => MindmapPath.getParentPath(x))
            .map(x => this.mindmap.getTargetNodeFromPath(x))
            .map(x => affectedParents.add(x));
        
        this.mindmap.moveNode(this.nodeOldPath, this.nodeNewPath);
        
        return { nodesChildListChanged: affectedParents.toArray() };
    }
    
    getReverseOperation(): MindmapOperation {
        let nodeOldPath = this.nodeNewPath;
        let nodeNewPath = this.nodeOldPath;
        return new MoveNodeOperation(this.mindmap, nodeOldPath, nodeNewPath);
    }
    
    static createInstance(obj: Partial<MoveNodeOperation>): MoveNodeOperation {
        return new MoveNodeOperation(obj.mindmap, obj.nodeOldPath, obj.nodeNewPath);
    }
    
}

export class DeleteNodeOperation extends MindmapOperation {
    
    nodePath: string;
    serializedNode: string;
    
    constructor(mindmap: Mindmap, nodePath: string, node: MindmapNode) {
        super(mindmap);
        this.nodePath = nodePath;
        this.serializedNode = JSON.stringify(node);
    }
    
    perform(): MindmapOperationResult {
        let deletedNode = this.mindmap.getTargetNodeFromPath(this.nodePath);
        this.mindmap.deleteNode(this.nodePath);
        
        let parentNodePath = MindmapPath.getParentPath(this.nodePath);
        let parentNode = this.mindmap.getTargetNodeFromPath(parentNodePath);
        return { nodesChildListChanged: [parentNode], nodesDeleted: [deletedNode] };
    }
    
    getReverseOperation(): MindmapOperation {
        return new CreateNodeOperation(this.mindmap, this.nodePath, MindmapNode.fromJson(this.serializedNode, this.mindmap))
    }
    
    static createInstance(obj: Partial<DeleteNodeOperation>): DeleteNodeOperation {
        return new DeleteNodeOperation(obj.mindmap, obj.nodePath, MindmapNode.fromJson(obj.serializedNode, obj.mindmap));
    }
    
}

export class ComplexNodeOperation extends MindmapOperation {
    
    operations: MindmapOperation[] = [];
    
    constructor(mindmap: Mindmap, operations: MindmapOperation[]) {
        super(mindmap);
        this.operations = operations;
    }
    
    perform(): MindmapOperationResult {
        let propertyNames: KeyOfOperationResult[] = MindmapOperation.resultPropertyNames;
        let sets: { [key: string]: PrivmxSet<string|MindmapNode> } = {};
        for (let propertyName of propertyNames) {
            sets[propertyName] = new PrivmxSet<string|MindmapNode>();
        }
        
        for (let operation of this.operations) {
            let operationResult: MindmapOperationResult = operation.perform();
            for (let propertyName of propertyNames) {
                if (operationResult[propertyName]) {
                    sets[propertyName].addMany(operationResult[propertyName]);
                }
            }
        }
        
        let result: MindmapOperationResult = {};
        let nodesDeleted: MindmapNode[] = (<PrivmxSet<MindmapNode>>sets["nodesDeleted"]).toArray();
        for (let propertyName of propertyNames) {
            if (propertyName != "nodesDeleted") {
                for (let deletedNode of nodesDeleted) {
                    sets[propertyName].remove(deletedNode);
                }
            }
            if (sets[propertyName].size() > 0) {
                result[propertyName] = <any>sets[propertyName].toArray();
            }
        }
        return result;
    }
    
    getReverseOperation(): MindmapOperation {
        let reverseOperations: MindmapOperation[] = this.operations.slice().reverse().map(x => x.getReverseOperation());
        return new ComplexNodeOperation(this.mindmap, reverseOperations)
    }
    
    static createInstance(obj: Partial<ComplexNodeOperation>): ComplexNodeOperation {
        let inst = new ComplexNodeOperation(obj.mindmap, obj.operations);
        for (let i = 0; i < inst.operations.length; ++i) {
            inst.operations[i].mindmap = obj.mindmap;
            inst.operations[i] = MindmapOperation.Classes[(<any>inst.operations[i]).className].createInstance(inst.operations[i]);
        }
        return inst;
    }
    
}

export class SwapNodesOperation extends ComplexNodeOperation {
    
    constructor(mindmap: Mindmap, nodePath0: string, nodePath1: string) {
        super(mindmap, []);
        
        if (nodePath0 == nodePath1) {
            return;
        }
        
        // Special case: nodes are siblings
        let parentPath0 = MindmapPath.getParentPath(nodePath0);
        let parentPath1 = MindmapPath.getParentPath(nodePath1);
        if (parentPath0 == parentPath1) {
            let nodeIndex0 = MindmapPath.getNodeIndexFromPath(nodePath0);
            let nodeIndex1 = MindmapPath.getNodeIndexFromPath(nodePath1);
            let swap = nodeIndex0 > nodeIndex1;
            if (swap) {
                let tmp = nodePath0;
                nodePath0 = nodePath1;
                nodePath1 = tmp;
            }
        }
        
        // A -> B
        this.operations.push(new MoveNodeOperation(this.mindmap, nodePath1, nodePath0));
        
        // B+1 -> A
        let modifiedPath = MindmapPath.modifyLastPathPosition(nodePath0, 1);
        if (modifiedPath != nodePath1) {
            this.operations.push(new MoveNodeOperation(this.mindmap, modifiedPath, nodePath1));
        }
    }
    
}

export class CreateNewParentOperation extends ComplexNodeOperation {
    
    constructor(mindmap: Mindmap, nodePath: string, newParentNode: MindmapNode) {
        super(mindmap, []);
        
        // INS(P)
        this.operations.push(new CreateNodeOperation(this.mindmap, nodePath, newParentNode));
        
        // P+1 -> P/0
        this.operations.push(new MoveNodeOperation(this.mindmap, MindmapPath.modifyLastPathPosition(nodePath, 1), nodePath + "/0"));
    }
    
}

MindmapOperation.Classes = {
    "com.privmx.core.component.mindmapeditor.CreateNodeOperation": CreateNodeOperation,
    "com.privmx.core.component.mindmapeditor.ChangeMindmapPropertyOperation": ChangeMindmapPropertyOperation,
    "com.privmx.core.component.mindmapeditor.ChangeNodePropertyOperation": ChangeNodePropertyOperation,
    "com.privmx.core.component.mindmapeditor.MoveNodeOperation": MoveNodeOperation,
    "com.privmx.core.component.mindmapeditor.DeleteNodeOperation": DeleteNodeOperation,
    "com.privmx.core.component.mindmapeditor.ComplexNodeOperation": ComplexNodeOperation,
    "com.privmx.core.component.mindmapeditor.SwapNodesOperation": ComplexNodeOperation,
    "com.privmx.core.component.mindmapeditor.CreateNewParentOperation": ComplexNodeOperation,
};
