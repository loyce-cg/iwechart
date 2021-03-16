import { MindmapNode } from "./MindmapNode";
import { MindmapOperation, CreateNodeOperation, MoveNodeOperation, DeleteNodeOperation } from "./MindmapOperation";
import { Mindmap } from "./Mindmap";

export class MindmapPath {
    
    static parsePath(path: string): number[] {
        path = path.substr(1); // Remove leading "/"
        let nodeIds: number[] = path.split("/").map(x => parseInt(x));
        return nodeIds;
    }
    
    static convertSortablePathToPath(sortablePath: string): string {
        return this.parsePath(sortablePath).map(x => `/${x}`).join("");
    }
    
    static modifyLastPathPosition(path: string, delta: number): string {
        let lastIndex = path.lastIndexOf("/");
        let left = path.substr(0, lastIndex + 1);
        let right = path.substr(lastIndex + 1);
        return left + (parseInt(right) + delta).toString();
    }
    
    static getParentPath(path: string): string {
        return path.substr(0, path.lastIndexOf("/"));
    }
    
    static getNodeIndexFromPath(path: string): number {
        return parseInt(path.substr(path.lastIndexOf("/") + 1));
    }
    
    static sortNodesByPath(arr: MindmapNode[], reverse: boolean = false): MindmapNode[] {
        let d = reverse ? -1 : 1;
        return arr.map(x => <[MindmapNode, string]>[x, x.getSortablePath()])
            .sort((a, b) => d * a[1].localeCompare(b[1]))
            .map(x => x[0]);
    }
    
    static convertNegativeIndexes(path: string, mindmap: Mindmap): string {
        let pathElements: string[] = [];
        mindmap.visitPath(path, {
            allowNegativeIndexes: true,
            visitNode: node => {
                if (node.parentNode) {
                    pathElements.push(node.parentNode.nodes.indexOf(node).toString());
                }
            },
        });
        return "/0/" + pathElements.join("/");
    }
    
    static fixTargetPathsForConsecutiveOperations(operations: MindmapOperation[]): void {
        // Generate a list of basic add/delete operations
        let basicOperations: { operationId: number, type: "add"|"delete", path: string }[] = [];
        for (let i = 0; i < operations.length; ++i) {
            let operation = operations[i];
            if (operation instanceof CreateNodeOperation) {
                basicOperations.push({ operationId: i, type: "add", path: operation.nodePath });
            }
            else if (operation instanceof DeleteNodeOperation) {
                basicOperations.push({ operationId: i, type: "delete", path: operation.nodePath });
            }
            else if (operation instanceof MoveNodeOperation) {
                basicOperations.push({ operationId: i, type: "delete", path: operation.nodeOldPath });
                basicOperations.push({ operationId: i, type: "add", path: operation.nodeNewPath });
            }
        }
        
        // Fix paths in basicOperations
        for (let i = 0; i < basicOperations.length; ++i) {
            let basicOperation = basicOperations[i];
            let nodePath = basicOperation.path;
            let nodeParentPath = this.getParentPath(nodePath);
            let nodeIndex = this.getNodeIndexFromPath(nodePath);
            for (let j = i + 1; j < basicOperations.length; ++j) {
                let basicOperation2 = basicOperations[j];
                let nodePath2 = basicOperation2.path;
                if (nodePath2.substr(0, nodeParentPath.length) == nodeParentPath && parseInt(nodePath2.substr(nodeParentPath.length + 1)) >= nodeIndex) {
                    let pre = nodeParentPath;
                    let index = parseInt(nodePath2.substr(nodeParentPath.length + 1));
                    let midPost = nodePath2.substr(nodeParentPath.length + 1);
                    let post = midPost.indexOf("/") >= 0 ? midPost.substr(midPost.indexOf("/")) : "";
                    let newPath = pre + "/" + (index + (basicOperation.type == "add" ? 1 : -1)) + post;
                    basicOperation2.path = newPath;
                }
            }
        }
        
        // Copy fixed paths from basicOperations to operations
        for (let basicOperation of basicOperations) {
            let operation: MindmapOperation = operations[basicOperation.operationId];
            if (operation instanceof CreateNodeOperation) {
                operation.nodePath = basicOperation.path;
            }
            else if (operation instanceof DeleteNodeOperation) {
                operation.nodePath = basicOperation.path;
            }
            else if (operation instanceof MoveNodeOperation) {
                if (basicOperation.type == "delete") {
                    operation.nodeOldPath = basicOperation.path;
                }
                else if (basicOperation.type == "add") {
                    operation.nodeNewPath = basicOperation.path;
                }
            }
        }
    }
    
    static sortPaths(paths: string[], mindmap: Mindmap, reverse: boolean = false): string[] {
        let nodes = paths
            .map(path => mindmap.getTargetNodeFromPath(path))
            .filter(node => !!node);
        let sortedPaths = this.sortNodesByPath(nodes, reverse).map(node => node.getPath());
        return sortedPaths;
    }
    
}
