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
var Mail = require("pmc-mail");
var ConflictResolver_1 = require("./ConflictResolver");
var Task_1 = require("./Task");
var Logger = Mail.Logger.get("privfs-tasks-plugin.main.data.TaskConflictResolver");
var TaskConflictResolver = (function (_super) {
    __extends(TaskConflictResolver, _super);
    function TaskConflictResolver() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.simpleProperties = [
            "name", "description", "type", "status", "priority",
            "projectId", "createdBy", "createdDateTime", "isTrashed",
            "startTimestamp", "endTimestamp", "wholeDays",
        ];
        _this.simpleArrayProperties = [
            "attachments", "assignedTo", "taskGroupIds", "commentTags",
            "pinnedInTaskGroupIds", "preDetachTaskGroupIds", "comments",
        ];
        return _this;
    }
    TaskConflictResolver.prototype.resolve = function () {
        var _a, _b;
        var a = this.first;
        var b = this.second;
        var aDiffs = a.diff(this.original);
        var bDiffs = b.diff(this.original);
        var abDiffs = b.diff(a);
        var resolvedObject = new Task_1.Task(JSON.parse(JSON.stringify(this.original)));
        if (abDiffs.length == 0) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.IDENTICAL };
        }
        if (abDiffs.indexOf("id") >= 0) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.DIFFERENT_OBJECT };
        }
        if (abDiffs.length == 3 && abDiffs.indexOf("history") >= 0 && abDiffs.indexOf("modifiedDateTime") >= 0 && abDiffs.indexOf("modifiedBy") >= 0) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.IDENTICAL };
        }
        for (var _i = 0, _c = this.simpleProperties; _i < _c.length; _i++) {
            var propertyName = _c[_i];
            if (this.tryResolveSimplePropertyConflict(propertyName, resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED) {
                return { status: ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED };
            }
        }
        for (var _d = 0, _e = this.simpleArrayProperties; _d < _e.length; _d++) {
            var propertyName = _e[_d];
            if (this.tryResolveSimpleArrayPropertyConflict(propertyName, resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED) {
                return { status: ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED };
            }
        }
        var t1 = this.first.getModifiedDateTime();
        var t2 = this.second.getModifiedDateTime();
        if (t1 == t2) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED };
        }
        else if (t1 > t2) {
            resolvedObject.setModifiedDateTime(this.first.getModifiedDateTime());
            resolvedObject.setModifiedBy(this.first.getModifiedBy());
        }
        else if (t1 < t2) {
            resolvedObject.setModifiedDateTime(this.second.getModifiedDateTime());
            resolvedObject.setModifiedBy(this.second.getModifiedBy());
        }
        (_a = resolvedObject.getHistory()).push.apply(_a, this.first.getHistory().slice(this.original.getHistory().length));
        (_b = resolvedObject.getHistory()).push.apply(_b, this.second.getHistory().slice(this.original.getHistory().length));
        return { status: ConflictResolver_1.ConflictResolutionStatus.RESOLVED, resolvedObject: resolvedObject };
    };
    return TaskConflictResolver;
}(ConflictResolver_1.ConflictResolver));
exports.TaskConflictResolver = TaskConflictResolver;
TaskConflictResolver.prototype.className = "com.privmx.plugin.tasks.main.data.TaskConflictResolver";

//# sourceMappingURL=TaskConflictResolver.js.map
