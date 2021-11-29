"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Leaf = (function () {
    function Leaf(treeItem, parent) {
        this.id = treeItem.id;
        this.parentId = treeItem.parentId;
        this.type = treeItem.type;
        this.checked = treeItem.checked;
        this.visited = false;
        this.size = 0;
        this.children = {};
        this.parent = parent;
    }
    Leaf.prototype.getLeaf = function (relativeId) {
        if (this.isLeafExists(relativeId)) {
            return this.children[relativeId];
        }
        throw new Error("leaf with relativeId: " + relativeId + " does not exist on parent: " + this.id);
    };
    Leaf.prototype.isLeafExists = function (relativeId) {
        return relativeId in this.children;
    };
    Leaf.prototype.addLeaf = function (leaf) {
        this.children[Leaf.getIdLastPart(leaf.id)] = leaf;
    };
    Leaf.prototype.removeLeaf = function (leaf) {
        for (var id in this.children) {
            if (leaf.id == this.children[id].id) {
                this.children[id] = null;
                delete this.children[id];
            }
        }
    };
    Leaf.getIdLastPart = function (id) {
        return id.split("/").splice(-1, 1)[0];
    };
    Leaf.getIdFirstPart = function (id) {
        return id.split("/").slice(0, 1)[0];
    };
    Leaf.getIdRelativeToParent = function (id, parentId) {
        var idWithoutParent = id.replace(parentId, "");
        return idWithoutParent.startsWith("/") ? idWithoutParent.slice(1) : idWithoutParent;
    };
    return Leaf;
}());
exports.Leaf = Leaf;
var FilesTree = (function () {
    function FilesTree() {
        this.root = new Leaf({
            id: "",
            parentId: null,
            type: "directory",
            checked: false
        }, null);
    }
    FilesTree.prototype.addFileToTree = function (fileItem, parent) {
        if (parent === void 0) { parent = this.root; }
        var idRelativeToParent = Leaf.getIdRelativeToParent(fileItem.id, parent.id);
        var idFirstPart = Leaf.getIdFirstPart(idRelativeToParent);
        var idLastPart = Leaf.getIdLastPart(idRelativeToParent);
        if (parent.isLeafExists(idFirstPart)) {
            if (idFirstPart == idLastPart) {
                this.updateFileInTree(fileItem, parent.getLeaf(idFirstPart));
            }
            else {
                this.addFileToTree(fileItem, parent.getLeaf(idFirstPart));
            }
        }
        else if (idFirstPart == Leaf.getIdLastPart(fileItem.id)) {
            var leaf = new Leaf(fileItem, parent);
            parent.addLeaf(leaf);
        }
        else {
            var dummyLeafId = parent.id + "/" + idFirstPart;
            parent.addLeaf(new Leaf({
                parentId: parent.id,
                id: dummyLeafId,
                type: "directory",
                checked: false
            }, parent));
            this.addFileToTree(fileItem, parent.getLeaf(idFirstPart));
        }
    };
    FilesTree.prototype.removePathFromTree = function (path) {
        var leaf = this.findLeaf(path);
        if (!leaf) {
            return;
        }
        var id = leaf.id;
        var parent = leaf.parent;
        parent.removeLeaf(leaf);
        leaf = null;
    };
    FilesTree.prototype.deleteLeaf = function (id, parent) {
        if (parent === void 0) { parent = this.root; }
        var leaf = this.findLeaf(id, parent);
        if (!leaf) {
            return;
        }
        var relativeId = Leaf.getIdRelativeToParent(id, parent.id);
        if (leaf.parent && leaf.parent.id == parent.id) {
            parent.removeLeaf(leaf);
            return;
        }
        else {
            for (var item in parent.children) {
                this.deleteLeaf(id, parent.children[item]);
            }
        }
    };
    FilesTree.prototype.getDirectoriesToVisit = function (leaf) {
        if (leaf === void 0) { leaf = this.root; }
        var pathsList = [];
        if (leaf.type == "directory" && leaf.checked == true && leaf.visited == false) {
            pathsList.push(leaf.id);
        }
        for (var child in leaf.children) {
            var childPaths = this.getDirectoriesToVisit(leaf.children[child]);
            pathsList = pathsList.concat(childPaths);
        }
        return pathsList;
    };
    FilesTree.prototype.getSelectedFiles = function (leaf) {
        if (leaf === void 0) { leaf = this.root; }
        var pathsList = [];
        if (leaf.checked == true) {
            pathsList.push(leaf.id);
        }
        for (var child in leaf.children) {
            var childPaths = this.getSelectedFiles(leaf.children[child]);
            pathsList = pathsList.concat(childPaths);
        }
        return pathsList;
    };
    FilesTree.prototype.getSelectedRootLeafs = function (leaf) {
        if (leaf === void 0) { leaf = this.root; }
        var roots = [];
        if (leaf.parent) {
            if (leaf.checked && leaf.parent.checked == false) {
                roots.push(leaf);
            }
        }
        else {
            if (leaf.checked) {
                roots.push(leaf);
            }
        }
        for (var item in leaf.children) {
            var childRoots = this.getSelectedRootLeafs(leaf.children[item]);
            roots = roots.concat(childRoots);
        }
        return roots;
    };
    FilesTree.prototype.setFileSize = function (path, size, leaf) {
        if (leaf === void 0) { leaf = this.root; }
        if (leaf.id == path) {
            leaf.size = size;
            if (leaf.parent) {
                this.updateFileSizeUpTree(leaf.parent);
            }
        }
        else {
            for (var item in leaf.children) {
                this.setFileSize(path, size, leaf.children[item]);
            }
        }
    };
    FilesTree.prototype.findLeaf = function (path, leaf) {
        if (leaf === void 0) { leaf = this.root; }
        if (leaf.id == path) {
            return leaf;
        }
        if (leaf.children == {}) {
            return null;
        }
        else {
            var found = void 0;
            for (var item in leaf.children) {
                found = this.findLeaf(path, leaf.children[item]);
                if (found) {
                    break;
                }
            }
            return found;
        }
    };
    FilesTree.prototype.getFileSize = function (path, leaf) {
        if (leaf === void 0) { leaf = this.root; }
        var leafByPath = this.findLeaf(path, leaf);
        if (!leafByPath) {
            throw new Error("No leaf by given path: " + path);
        }
        return leafByPath.size;
    };
    FilesTree.prototype.getCheckedTotalSize = function (leaf) {
        if (leaf === void 0) { leaf = this.root; }
        var totalSize = 0;
        if (leaf.checked && leaf.type == "file") {
            totalSize += leaf.size;
        }
        else {
            for (var item in leaf.children) {
                var child = leaf.children[item];
                if (child.checked && child.type == "file") {
                    totalSize += child.size;
                }
                else {
                    totalSize += this.getCheckedTotalSize(child);
                }
            }
            return totalSize;
        }
    };
    FilesTree.prototype.getCheckedCount = function (leaf) {
        if (leaf === void 0) { leaf = this.root; }
        var count = 0;
        if (leaf.checked && leaf.type == "file") {
            count++;
        }
        else {
            for (var item in leaf.children) {
                var child = leaf.children[item];
                if (child.checked && child.type == "file") {
                    count++;
                }
                else {
                    count += this.getCheckedCount(child);
                }
            }
            return count;
        }
    };
    FilesTree.prototype.setFileVisited = function (path, leaf) {
        if (leaf === void 0) { leaf = this.root; }
        if (leaf.id == path) {
            leaf.visited = true;
        }
        else {
            for (var item in leaf.children) {
                this.setFileVisited(path, leaf.children[item]);
            }
        }
    };
    FilesTree.prototype.setFileChecked = function (path, checked, leaf) {
        if (leaf === void 0) { leaf = this.root; }
        if (leaf.id == path) {
            leaf.checked = checked;
            for (var item in leaf.children) {
                this.setFileChecked(path, checked, leaf.children[item]);
            }
        }
        else {
            for (var item in leaf.children) {
                this.setFileChecked(path, checked, leaf.children[item]);
            }
        }
    };
    FilesTree.prototype.updateFileSizeUpTree = function (leaf) {
        leaf.size = 0;
        for (var id in leaf.children) {
            leaf.size += leaf.children[id].size;
        }
        if (leaf.parent && leaf.parent.checked) {
            this.updateFileSizeUpTree(leaf.parent);
        }
    };
    FilesTree.prototype.updateFileInTree = function (fileItem, leafToUpdate) {
        leafToUpdate.checked = fileItem.checked;
        leafToUpdate.type = fileItem.type;
    };
    FilesTree.prototype.printSubTree = function (leaf) {
        if (leaf === void 0) { leaf = this.root; }
        console.log("Parent: ", leaf.parentId);
        console.log("leaf: ", leaf.id, "parent: ", leaf.parent ? leaf.parent.id : "null", "size", leaf.size, "(", "checked: ", leaf.checked, "visited", leaf.visited, "type", leaf.type, ")");
        for (var item in leaf.children) {
            this.printSubTree(leaf.children[item]);
        }
    };
    FilesTree.prototype.fireTest = function () {
        this.addFileToTree({ id: "/Users/kamil/Documents/lala.txt", parentId: "/Users/kamil/Documents", type: "file", checked: true });
        this.addFileToTree({ id: "/Users/kamil/Documents/ble.txt", parentId: "/Users/kamil/Documents", type: "file", checked: true });
        this.addFileToTree({ id: "/Users/kamil/test.txt", parentId: "/Users/kamil", type: "file", checked: true });
        this.addFileToTree({ id: "/var/bin/file1.txt", parentId: "/var/bin", type: "file", checked: true });
        this.addFileToTree({ id: "/var/bin/file2.txt", parentId: "/var/bin", type: "file", checked: true });
        this.addFileToTree({ id: "/Users/kamil", parentId: "/Users", type: "directory", checked: true });
        this.setFileSize("/Users/kamil/Documents/lala.txt", 8);
        this.setFileSize("/Users/kamil/Documents/ble.txt", 16);
        this.setFileSize("/Users/kamil/test.txt", 32);
        this.setFileSize("/var/bin/file1.txt", 64);
        this.printSubTree();
        console.log("dirs to visit:");
        this.getDirectoriesToVisit().forEach(function (x) { return console.log(x); });
    };
    return FilesTree;
}());
exports.FilesTree = FilesTree;
Leaf.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.Leaf";
FilesTree.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.FilesTree";

//# sourceMappingURL=FilesTree.js.map
