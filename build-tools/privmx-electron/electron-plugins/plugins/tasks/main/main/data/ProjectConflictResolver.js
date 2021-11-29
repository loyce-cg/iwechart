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
var Project_1 = require("./Project");
var Logger = Mail.Logger.get("privfs-tasks-plugin.main.data.ProjectConflictResolver");
var ProjectConflictResolver = (function (_super) {
    __extends(ProjectConflictResolver, _super);
    function ProjectConflictResolver() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.simpleProperties = ["name"];
        _this.simpleArrayProperties = [
            "taskTypes", "taskStatuses", "taskPriorities", "taskGroupIds",
            "orphanedTaskIds", "pinnedTaskGroupIds"
        ];
        return _this;
    }
    ProjectConflictResolver.prototype.resolve = function () {
        var a = this.first;
        var b = this.second;
        var aDiffs = a.diff(this.original);
        var bDiffs = b.diff(this.original);
        var abDiffs = b.diff(a);
        var resolvedObject = new Project_1.Project(JSON.parse(JSON.stringify(this.original)));
        if (abDiffs.length == 0) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.IDENTICAL };
        }
        if (abDiffs.indexOf("id") >= 0) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.DIFFERENT_OBJECT };
        }
        for (var _i = 0, _a = this.simpleProperties; _i < _a.length; _i++) {
            var propertyName = _a[_i];
            if (this.tryResolveSimplePropertyConflict(propertyName, resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED) {
                return { status: ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED };
            }
        }
        for (var _b = 0, _c = this.simpleArrayProperties; _b < _c.length; _b++) {
            var propertyName = _c[_b];
            if (this.tryResolveSimpleArrayPropertyConflict(propertyName, resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED) {
                return { status: ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED };
            }
        }
        if (this.tryResolveSimpleOrderedArrayPropertyConflict("taskGroupsOrder", resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED) {
            return { status: ConflictResolver_1.ConflictResolutionStatus.UNRESOLVED };
        }
        return { status: ConflictResolver_1.ConflictResolutionStatus.RESOLVED, resolvedObject: resolvedObject };
    };
    return ProjectConflictResolver;
}(ConflictResolver_1.ConflictResolver));
exports.ProjectConflictResolver = ProjectConflictResolver;
ProjectConflictResolver.prototype.className = "com.privmx.plugin.tasks.main.data.ProjectConflictResolver";

//# sourceMappingURL=ProjectConflictResolver.js.map
