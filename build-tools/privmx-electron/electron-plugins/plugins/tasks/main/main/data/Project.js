"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var DataObject_1 = require("./DataObject");
var Utils_1 = require("../utils/Utils");
var Project = (function (_super) {
    __extends(Project, _super);
    function Project(obj) {
        if (obj === void 0) { obj = null; }
        var _this = _super.call(this, obj) || this;
        _this.ensureFieldsAreArrays([
            "taskTypes",
            "taskStatuses",
            "taskPriorities",
            "taskGroupIds",
            "orphanedTaskIds",
            "taskGroupsOrder",
            "pinnedTaskGroupIds",
        ]);
        return _this;
    }
    Project.prototype.getId = function () {
        return this.id;
    };
    Project.prototype.setId = function (value) {
        this.id = value;
    };
    Project.prototype.getName = function () {
        return this.name;
    };
    Project.prototype.setName = function (value) {
        this.name = value;
    };
    Project.prototype.getTaskTypes = function (newArray, stripDefaultIndicator) {
        if (newArray === void 0) { newArray = false; }
        if (stripDefaultIndicator === void 0) { stripDefaultIndicator = false; }
        return stripDefaultIndicator ? this._stripDefaultIndicator(this.taskTypes) : (newArray ? this.taskTypes.slice() : this.taskTypes);
    };
    Project.prototype.setTaskTypes = function (value) {
        this.taskTypes = value;
    };
    Project.prototype.getDefaultTaskTypeId = function () {
        return this._getDefaultElementId(this.taskTypes);
    };
    Project.prototype.getTaskStatuses = function (newArray, stripDefaultIndicator) {
        if (newArray === void 0) { newArray = false; }
        if (stripDefaultIndicator === void 0) { stripDefaultIndicator = false; }
        return stripDefaultIndicator ? this._stripDefaultIndicator(this.taskStatuses) : (newArray ? this.taskStatuses.slice() : this.taskStatuses);
    };
    Project.prototype.setTaskStatuses = function (value) {
        this.taskStatuses = value;
    };
    Project.prototype.getDefaultTaskStatusId = function () {
        return this._getDefaultElementId(this.taskStatuses);
    };
    Project.prototype.getTaskPriorities = function (newArray, stripDefaultIndicator) {
        if (newArray === void 0) { newArray = false; }
        if (stripDefaultIndicator === void 0) { stripDefaultIndicator = false; }
        return stripDefaultIndicator ? this._stripDefaultIndicator(this.taskPriorities) : (newArray ? this.taskPriorities.slice() : this.taskPriorities);
    };
    Project.prototype.setTaskPriorities = function (value) {
        this.taskPriorities = value;
    };
    Project.prototype.getDefaultTaskPriorityId = function () {
        return this._getDefaultElementId(this.taskPriorities);
    };
    Project.prototype.getTaskGroupIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.taskGroupIds.slice() : this.taskGroupIds;
    };
    Project.prototype.setTaskGroupIds = function (value) {
        this.taskGroupIds = value;
    };
    Project.prototype.addTaskGroupId = function (taskGroupId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.taskGroupIds, taskGroupId, ensureUnique, true);
    };
    Project.prototype.removeTaskGroupId = function (taskGroupId) {
        return this.removeFromProperty(this.taskGroupIds, taskGroupId);
    };
    Project.prototype.getOrphanedTaskIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.orphanedTaskIds.slice() : this.orphanedTaskIds;
    };
    Project.prototype.setOrphanedTaskIds = function (value) {
        this.orphanedTaskIds = value;
    };
    Project.prototype.addOrphanedTasksId = function (orphanedTaskId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.orphanedTaskIds, orphanedTaskId, ensureUnique);
    };
    Project.prototype.removeOrphanedTasksId = function (orphanedTaskId) {
        return this.removeFromProperty(this.orphanedTaskIds, orphanedTaskId);
    };
    Project.prototype.getTaskGroupsOrder = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.taskGroupsOrder.slice() : this.taskGroupsOrder;
    };
    Project.prototype.setTaskGroupsOrder = function (value) {
        this.taskGroupsOrder = value;
    };
    Project.prototype.addTaskGroupsOrder = function (taskGroupId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.taskGroupsOrder, taskGroupId, ensureUnique, true);
    };
    Project.prototype.removeTaskGroupsOrder = function (taskGroupId) {
        return this.removeFromProperty(this.taskGroupsOrder, taskGroupId);
    };
    Project.prototype.getPinnedTaskGroupIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.pinnedTaskGroupIds.slice() : this.pinnedTaskGroupIds;
    };
    Project.prototype.setPinnedTaskGroupIds = function (value) {
        this.pinnedTaskGroupIds = value;
    };
    Project.prototype.addPinnedTaskGroupId = function (taskGroupId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.pinnedTaskGroupIds, taskGroupId, ensureUnique, true);
    };
    Project.prototype.removePinnedTaskGroupId = function (taskGroupId) {
        return this.removeFromProperty(this.pinnedTaskGroupIds, taskGroupId);
    };
    Project.prototype.getDefaultViewMode = function () {
        return this.defaultViewMode;
    };
    Project.prototype.setDefaultViewMode = function (value) {
        this.defaultViewMode = value;
    };
    Project.prototype.getDefaultIsKanban = function () {
        return this.defaultIsKanban;
    };
    Project.prototype.setDefaultIsKanban = function (value) {
        this.defaultIsKanban = value;
    };
    Project.prototype.getDefaultIsHorizontal = function () {
        return this.defaultIsHorizontal;
    };
    Project.prototype.setDefaultIsHorizontal = function (value) {
        this.defaultIsHorizontal = value;
    };
    Project.prototype.syncTaskGroupsIdsOrder = function (taskGroups) {
        var idsToShow = this.taskGroupIds;
        var idsOrdered = this.taskGroupsOrder;
        var newIds = [];
        var detached = [];
        for (var _i = 0, idsToShow_1 = idsToShow; _i < idsToShow_1.length; _i++) {
            var k = idsToShow_1[_i];
            if (idsOrdered.indexOf(k) < 0) {
                newIds.push(k);
            }
        }
        for (var _a = 0, idsOrdered_1 = idsOrdered; _a < idsOrdered_1.length; _a++) {
            var k = idsOrdered_1[_a];
            if (idsToShow.indexOf(k) >= 0 || k == "__orphans__") {
                if (taskGroups[k] && taskGroups[k].getDetached()) {
                    detached.push(k);
                }
                else {
                    newIds.push(k);
                }
            }
        }
        for (var _b = 0, detached_1 = detached; _b < detached_1.length; _b++) {
            var k = detached_1[_b];
            newIds.push(k);
        }
        this.taskGroupIds = JSON.parse(JSON.stringify(newIds));
        if (newIds.indexOf("__orphans__") < 0) {
            newIds.push("__orphans__");
        }
        this.taskGroupsOrder = JSON.parse(JSON.stringify(newIds));
    };
    Project.prototype._getDefaultElementId = function (list) {
        var idx = 0;
        for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
            var el = list_1[_i];
            if (el.length > 2 && el[0] == "[" && el[el.length - 1] == "]") {
                return idx;
            }
            ++idx;
        }
        return 0;
    };
    Project.prototype._stripDefaultIndicator = function (list) {
        var newList = [];
        for (var _i = 0, list_2 = list; _i < list_2.length; _i++) {
            var el = list_2[_i];
            if (el.length > 2 && el[0] == "[" && el[el.length - 1] == "]") {
                newList.push(el.substr(1, el.length - 2));
            }
            else {
                newList.push(el);
            }
        }
        return newList;
    };
    Project.prototype.toJSON = function () {
        var res = {};
        for (var k in this) {
            if (k.length > 0 && k[0] == "_" && k != "__version__") {
            }
            else {
                res[k] = this[k];
            }
        }
        return res;
    };
    Project.prototype.diff = function (other) {
        var diffs = [];
        if (this.getId() != other.getId()) {
            diffs.push("id");
        }
        if (this.getName() != other.getName()) {
            diffs.push("name");
        }
        if (!Utils_1.Utils.arraysEqual(this.getTaskTypes(), other.getTaskTypes())) {
            diffs.push("taskTypes");
        }
        if (!Utils_1.Utils.arraysEqual(this.getTaskStatuses(), other.getTaskStatuses())) {
            diffs.push("taskStatuses");
        }
        if (!Utils_1.Utils.arraysEqual(this.getTaskPriorities(), other.getTaskPriorities())) {
            diffs.push("taskPriorities");
        }
        if (!Utils_1.Utils.arraysEqual(this.getTaskGroupIds(), other.getTaskGroupIds())) {
            diffs.push("taskGroupIds");
        }
        if (!Utils_1.Utils.arraysEqual(this.getOrphanedTaskIds(), other.getOrphanedTaskIds())) {
            diffs.push("orphanedTaskIds");
        }
        if (!Utils_1.Utils.orderedArraysEqual(this.getTaskGroupsOrder(), other.getTaskGroupsOrder())) {
            diffs.push("taskGroupsOrder");
        }
        if (!Utils_1.Utils.arraysEqual(this.getPinnedTaskGroupIds(), other.getPinnedTaskGroupIds())) {
            diffs.push("pinnedTaskGroupIds");
        }
        return diffs;
    };
    return Project;
}(DataObject_1.DataObject));
exports.Project = Project;
Project.prototype.className = "com.privmx.plugin.tasks.main.data.Project";

//# sourceMappingURL=Project.js.map
