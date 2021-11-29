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
var IconPickerData_1 = require("../../component/iconPicker/IconPickerData");
var TaskGroup = (function (_super) {
    __extends(TaskGroup, _super);
    function TaskGroup(obj) {
        if (obj === void 0) { obj = null; }
        var _this = _super.call(this, obj) || this;
        _this.ensureFieldsAreArrays([
            "taskIds",
        ]);
        return _this;
    }
    TaskGroup.prototype.getId = function () {
        return this.id;
    };
    TaskGroup.prototype.setId = function (value) {
        this.id = value;
    };
    TaskGroup.prototype.getName = function () {
        return this.name;
    };
    TaskGroup.prototype.setName = function (value) {
        this.name = value;
    };
    TaskGroup.prototype.getDueDate = function () {
        return this.dueDate;
    };
    TaskGroup.prototype.setDueDate = function (value) {
        this.dueDate = value;
    };
    TaskGroup.prototype.getTaskIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.taskIds.slice() : this.taskIds;
    };
    TaskGroup.prototype.setTaskIds = function (value) {
        this.taskIds = value;
    };
    TaskGroup.prototype.addTaskId = function (taskId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.taskIds, taskId, ensureUnique);
    };
    TaskGroup.prototype.removeTaskId = function (taskId) {
        return this.removeFromProperty(this.taskIds, taskId);
    };
    TaskGroup.prototype.getProjectId = function () {
        return this.projectId;
    };
    TaskGroup.prototype.setProjectId = function (value) {
        this.projectId = value;
    };
    TaskGroup.prototype.getDetached = function () {
        return this.detached;
    };
    TaskGroup.prototype.setDetached = function (value) {
        this.detached = value;
    };
    TaskGroup.prototype.getIcon = function () {
        if (this.icon) {
            if (typeof (this.icon) == "string") {
                if (this.icon.length > 0) {
                    var icon = JSON.parse(this.icon);
                    var str = "";
                    if (icon.type == "fa" || icon.type == "shape") {
                        if (icon.type == "fa") {
                            str = '{"type":"fa","fa":"' + icon.fa + '"}';
                        }
                        else if (icon.type == "shape") {
                            str = '{"type":"shape","fa":"' + icon.shape + '"}';
                        }
                        if (IconPickerData_1.IconPickerData.items.indexOf(str) < 0 || IconPickerData_1.IconPickerData.colors.indexOf(icon.color) < 0) {
                            this.icon = null;
                        }
                    }
                    else {
                        this.icon = null;
                    }
                }
            }
            else {
                this.icon = null;
            }
        }
        return this.icon;
    };
    TaskGroup.prototype.setIcon = function (value) {
        this.icon = value;
    };
    TaskGroup.prototype.diff = function (other) {
        var diffs = [];
        if (this.getId() != other.getId()) {
            diffs.push("id");
        }
        if (this.getName() != other.getName()) {
            diffs.push("name");
        }
        if (this.getDueDate() != other.getDueDate()) {
            diffs.push("dueDate");
        }
        if (!Utils_1.Utils.arraysEqual(this.getTaskIds(), other.getTaskIds())) {
            diffs.push("taskIds");
        }
        if (this.getProjectId() != other.getProjectId()) {
            diffs.push("projectId");
        }
        if (this.getDetached() != other.getDetached()) {
            diffs.push("detached");
        }
        if (this.getIcon() != other.getIcon()) {
            diffs.push("icon");
        }
        return diffs;
    };
    return TaskGroup;
}(DataObject_1.DataObject));
exports.TaskGroup = TaskGroup;
TaskGroup.prototype.className = "com.privmx.plugin.tasks.main.data.TaskGroup";

//# sourceMappingURL=TaskGroup.js.map
