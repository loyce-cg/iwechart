"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var MindmapConverter = (function () {
    function MindmapConverter() {
    }
    MindmapConverter.convertTextToMindMap = function (textElements) {
        var mindmap = [];
        var parentsMap = [];
        if (textElements.length == 0) {
            return null;
        }
        var baseLevel = MindmapConverter.getTabLevel(textElements[0]);
        var currentLevel = baseLevel;
        var currentNodes = mindmap;
        for (var i = 0; i < textElements.length; i++) {
            var elementLevel = MindmapConverter.getTabLevel(textElements[i]);
            var parentMapElem = MindmapConverter.getParentElem(i, elementLevel, parentsMap);
            currentNodes = parentMapElem ? parentMapElem.childrenObjs : mindmap;
            var elemName = MindmapConverter.removeR(textElements[i].trim());
            if (elemName.length > 0) {
                currentNodes.push({ label: elemName, nodes: [] });
                parentsMap.push({ id: i, level: elementLevel, childrenObjs: currentNodes[currentNodes.length - 1].nodes });
            }
        }
        return mindmap;
    };
    MindmapConverter.getParentElem = function (childId, childLevel, parentsMap) {
        for (var i = parentsMap.length - 1; i >= 0; --i) {
            if (parentsMap[i].id < childId && parentsMap[i].level < childLevel) {
                return parentsMap[i];
            }
        }
        return null;
    };
    MindmapConverter.removeR = function (elem) {
        return elem.replace("\r", "");
    };
    MindmapConverter.getTabLevel = function (text) {
        var level = 0;
        for (var i = 0; i < text.length; i++) {
            if (text.charAt(i) == "\t" || text.charAt(i) == " ") {
                level++;
            }
            else {
                break;
            }
        }
        return level;
    };
    MindmapConverter.reduceTabs = function (elements) {
        var reduced = [];
        if (elements.length == 0) {
            return [];
        }
        var qty = MindmapConverter.getTabLevel(elements[0]);
        var toReduce = "";
        for (var j = 0; j < qty; j++) {
            toReduce += "\t";
        }
        for (var i = 0; i < elements.length; i++) {
            if (elements[i].indexOf(toReduce) == 0) {
                reduced.push(elements[i].substr(qty));
            }
            else {
                break;
            }
        }
        return reduced;
    };
    MindmapConverter.getChildElements = function (elements, parentIndex) {
        var parentLevel = MindmapConverter.getTabLevel(elements[parentIndex]);
        var children = [];
        for (var i = parentIndex + 1; i < elements.length; i++) {
            var level = MindmapConverter.getTabLevel(elements[i]);
            if (level > parentLevel) {
                children.push(elements[i]);
            }
            else {
                break;
            }
        }
        return children;
    };
    MindmapConverter.getRawAsFlatText = function (data) {
        return MindmapConverter.singleElementAsText(data, 1) + "\n";
    };
    MindmapConverter.singleElementAsText = function (element, level) {
        if (!element) {
            return "";
        }
        var parent = element.label;
        var gap = Array(level + 1).join("\t");
        if (element.nodes && element.nodes.length > 0) {
            element.nodes.forEach(function (node) {
                parent += "\n" + gap + MindmapConverter.singleElementAsText(node, level + 1);
            });
        }
        return parent;
    };
    return MindmapConverter;
}());
exports.MindmapConverter = MindmapConverter;
MindmapConverter.prototype.className = "com.privmx.plugin.editor.window.editor.editors.MindmapConverter";

//# sourceMappingURL=MindmapConverter.js.map
