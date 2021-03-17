import { TreeItem } from "./TreeItem";
export class Leaf implements TreeItem {
    id: string;
    parentId: string;
    type: string;
    checked: boolean;
    visited: boolean;
    size: number;
    parent: Leaf;
    children: {[id: string]: Leaf};

    constructor(treeItem: TreeItem, parent: Leaf) {
        this.id = treeItem.id;
        this.parentId = treeItem.parentId;
        this.type = treeItem.type;
        this.checked = treeItem.checked;
        this.visited = false;
        this.size = 0;
        this.children = {};
        this.parent = parent;
    }

    getLeaf(relativeId: string): Leaf {
        if (this.isLeafExists(relativeId)) {
            return this.children[relativeId];
        }
        throw new Error("leaf with relativeId: "+relativeId+" does not exist on parent: " + this.id);
    }

    isLeafExists(relativeId: string): boolean {
        return relativeId in this.children;
    }

    addLeaf(leaf: Leaf): void {
        this.children[Leaf.getIdLastPart(leaf.id)] = leaf;
    }

    removeLeaf(leaf: Leaf): void {
        for (let id in this.children) {
            if (leaf.id == this.children[id].id) {
                this.children[id] = null;
                delete this.children[id];
            }
        }
    }

    static getIdLastPart(id: string): string {
        return id.split("/").splice(-1, 1)[0];
    }

    static getIdFirstPart(id: string): string {
        return id.split("/").slice(0, 1)[0];
    }

    static getIdRelativeToParent(id: string, parentId: string): string {
        let idWithoutParent = id.replace(parentId, "");
        return idWithoutParent.startsWith("/") ? idWithoutParent.slice(1) : idWithoutParent;
    }
}

export class FilesTree {
    root: Leaf;

    constructor() {
        this.root = new Leaf({
            id: "",
            parentId: null,
            type: "directory",
            checked: false
        }, null)
    }

    addFileToTree(fileItem: TreeItem, parent: Leaf = this.root) {
        let idRelativeToParent = Leaf.getIdRelativeToParent(fileItem.id, parent.id);
        let idFirstPart = Leaf.getIdFirstPart(idRelativeToParent);
        let idLastPart = Leaf.getIdLastPart(idRelativeToParent);

        if (parent.isLeafExists(idFirstPart)) {
            if (idFirstPart == idLastPart) {
                this.updateFileInTree(fileItem, parent.getLeaf(idFirstPart));
            }
            else {
                this.addFileToTree(fileItem, parent.getLeaf(idFirstPart));
            }
        }
        else if (idFirstPart == Leaf.getIdLastPart(fileItem.id)) {
            let leaf = new Leaf(fileItem, parent);
            parent.addLeaf(leaf);
        }
        else {
            let dummyLeafId = parent.id + "/" + idFirstPart;
            parent.addLeaf(new Leaf({
                parentId: parent.id,
                id: dummyLeafId,
                type: "directory",
                checked: false
            }, parent));
            this.addFileToTree(fileItem, parent.getLeaf(idFirstPart));
        }
    }



    removePathFromTree(path: string): void {
        let leaf = this.findLeaf(path);
        if (! leaf) {
            return;
        }
        const id = leaf.id;
        const parent = leaf.parent;
        parent.removeLeaf(leaf);

        leaf = null;
    }

    deleteLeaf(id: string, parent: Leaf = this.root): void {
        let leaf = this.findLeaf(id, parent);
        if (! leaf) {
            return;
        }
        const relativeId = Leaf.getIdRelativeToParent(id, parent.id);
        if (leaf.parent && leaf.parent.id == parent.id) {
            parent.removeLeaf(leaf);
            return;
        }
        else {
            for (let item in parent.children) {
                this.deleteLeaf(id, parent.children[item]);
            }
        }
    }

    getDirectoriesToVisit(leaf: Leaf = this.root): string[] {
        let pathsList: string[] = [];
        if (leaf.type == "directory" && leaf.checked == true && leaf.visited == false) {
            pathsList.push(leaf.id);
        }
        for (let child in leaf.children) {
            let childPaths = this.getDirectoriesToVisit(leaf.children[child]);
            pathsList = pathsList.concat(childPaths);
        }
        return pathsList;
    }

    getSelectedFiles(leaf: Leaf = this.root): string[] {
        let pathsList: string[] = [];
        if (leaf.checked == true) {
            pathsList.push(leaf.id);
        }
        for (let child in leaf.children) {
            let childPaths = this.getSelectedFiles(leaf.children[child]);
            pathsList = pathsList.concat(childPaths);
        }
        return pathsList;
    }

    getSelectedRootLeafs(leaf: Leaf = this.root): Leaf[] {
        let roots: Leaf[] = [];
        if (leaf.parent) {
            if (leaf.checked && leaf.parent.checked == false) {
                // thats a root dir/file
                roots.push(leaf);
            }
        }
        else {
            if (leaf.checked) {
                roots.push(leaf);
            }
        }
        for (let item in leaf.children) {
            let childRoots = this.getSelectedRootLeafs(leaf.children[item]);
            roots = roots.concat(childRoots);
        }
        return roots;
    }

    setFileSize(path: string, size: number, leaf: Leaf = this.root): void {
        if (leaf.id == path) {
            leaf.size = size;
            if (leaf.parent) {
                this.updateFileSizeUpTree(leaf.parent);
            }
        }
        else {
            for (let item in leaf.children) {
                this.setFileSize(path, size, leaf.children[item]);
            }
        }
    }

    findLeaf(path: string, leaf: Leaf = this.root): Leaf {
        if (leaf.id == path) {
            return leaf;
        }
        if (leaf.children == {}) {
            return null;
        }
        else {
            let found: Leaf;
            for (let item in leaf.children) {
                found = this.findLeaf(path, leaf.children[item]);
                if (found) {
                    break;
                }
            }
            return found;
        }
    }

    getFileSize(path: string, leaf: Leaf = this.root): number {
        const leafByPath = this.findLeaf(path, leaf);
        if (! leafByPath) {
            throw new Error("No leaf by given path: " + path);
        }
        return leafByPath.size;
    }


    getCheckedTotalSize(leaf: Leaf = this.root) {
        let totalSize: number = 0;
        if (leaf.checked && leaf.type == "file") {
            totalSize += leaf.size;
        }
        else {
            for (let item in leaf.children) {
                const child = leaf.children[item];
                if (child.checked && child.type == "file") {
                    totalSize += child.size;
                }
                else {
                    totalSize += this.getCheckedTotalSize(child);
                }
            }
            return totalSize;
        }
    }

    getCheckedCount(leaf: Leaf = this.root) {
        let count: number = 0;
        if (leaf.checked && leaf.type == "file") {
            count ++;
        }
        else {
            for (let item in leaf.children) {
                const child = leaf.children[item];
                if (child.checked && child.type == "file") {
                    count ++;
                }
                else {
                    count += this.getCheckedCount(child);
                }
            }
            return count;
        }
    }


    setFileVisited(path: string, leaf: Leaf = this.root): void {
        if (leaf.id == path) {
            leaf.visited = true;
        }
        else {
            for (let item in leaf.children) {
                this.setFileVisited(path, leaf.children[item]);
            }
        }
    }

    setFileChecked(path: string, checked: boolean, leaf: Leaf = this.root): void {
        if (leaf.id == path) {
            leaf.checked = checked;
            for (let item in leaf.children) {
                this.setFileChecked(path, checked, leaf.children[item]);
            }
        }
        else {
            for (let item in leaf.children) {
                this.setFileChecked(path, checked, leaf.children[item]);
            }
        }
    }



    updateFileSizeUpTree(leaf: Leaf): void {
        leaf.size = 0;
        for (let id in leaf.children) {
            leaf.size += leaf.children[id].size;
        }
        if (leaf.parent && leaf.parent.checked) {
            this.updateFileSizeUpTree(leaf.parent);
        }
    }


    updateFileInTree(fileItem: TreeItem, leafToUpdate: Leaf): void {
        leafToUpdate.checked = fileItem.checked;
        leafToUpdate.type = fileItem.type;
    }

    printSubTree(leaf: Leaf = this.root): void {
        console.log("Parent: ", leaf.parentId);
        console.log("leaf: ", leaf.id, "parent: ", leaf.parent ? leaf.parent.id : "null", "size", leaf.size, "(", "checked: ", leaf.checked, "visited", leaf.visited,"type", leaf.type, ")");
        for (let item in leaf.children) {
            this.printSubTree(leaf.children[item]);
        }
    }

    fireTest(): void {
        this.addFileToTree({id: "/Users/kamil/Documents/lala.txt", parentId: "/Users/kamil/Documents", type: "file", checked: true});
        this.addFileToTree({id: "/Users/kamil/Documents/ble.txt", parentId: "/Users/kamil/Documents", type: "file", checked: true});
        this.addFileToTree({id: "/Users/kamil/test.txt", parentId: "/Users/kamil", type: "file", checked: true});
        this.addFileToTree({id: "/var/bin/file1.txt", parentId: "/var/bin", type: "file", checked: true});
        this.addFileToTree({id: "/var/bin/file2.txt", parentId: "/var/bin", type: "file", checked: true});
        this.addFileToTree({id: "/Users/kamil", parentId: "/Users", type: "directory", checked: true});

        this.setFileSize("/Users/kamil/Documents/lala.txt", 8);
        this.setFileSize("/Users/kamil/Documents/ble.txt", 16);
        this.setFileSize("/Users/kamil/test.txt", 32);
        this.setFileSize("/var/bin/file1.txt", 64);
   
        
        this.printSubTree();

        console.log("dirs to visit:");
        this.getDirectoriesToVisit().forEach(x => console.log(x));
    }
}