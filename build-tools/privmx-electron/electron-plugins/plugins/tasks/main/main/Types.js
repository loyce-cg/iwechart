"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var StoredObjectTypes;
(function (StoredObjectTypes) {
    StoredObjectTypes["tasksSection"] = "tasks-section";
    StoredObjectTypes["tasksList"] = "tasks-list";
    StoredObjectTypes["tasksTask"] = "tasks-task";
})(StoredObjectTypes = exports.StoredObjectTypes || (exports.StoredObjectTypes = {}));
var ViewContext;
(function (ViewContext) {
    ViewContext["Global"] = "global";
    ViewContext["TasksWindow"] = "tasks";
    ViewContext["SummaryWindow"] = "summary";
})(ViewContext = exports.ViewContext || (exports.ViewContext = {}));
var CustomTasksElements = (function () {
    function CustomTasksElements() {
    }
    CustomTasksElements.ALL_TASKS_ID = "all-tasks";
    CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID = "tasks-assigned-to-me";
    CustomTasksElements.TASKS_CREATED_BY_ME_ID = "tasks-created-by-me";
    CustomTasksElements.TRASH_ID = "trash";
    CustomTasksElements.ALL_TASKS_INC_TRASHED_ID = "all-tasks-inc-trashed";
    return CustomTasksElements;
}());
exports.CustomTasksElements = CustomTasksElements;
var FixedNames = (function () {
    function FixedNames() {
    }
    FixedNames.PRIVATE_SECTION_NAME = "<my>";
    return FixedNames;
}());
exports.FixedNames = FixedNames;
var DefaultColWidths = (function () {
    function DefaultColWidths() {
    }
    DefaultColWidths.HASH_ID = 58;
    DefaultColWidths.STATUS = 70;
    DefaultColWidths.ASSIGNED_TO = 65;
    DefaultColWidths.ATTACHMENTS = 100;
    DefaultColWidths.CREATED = 110;
    DefaultColWidths.MODIFIED = 110;
    return DefaultColWidths;
}());
exports.DefaultColWidths = DefaultColWidths;
var Filter;
(function (Filter) {
    Filter["allTasks"] = "all-tasks";
    Filter["onlyUnread"] = "only-unread";
    Filter["onlyIdea"] = "only-idea";
    Filter["onlyTodo"] = "only-todo";
    Filter["onlyInProgress"] = "only-in-progress";
    Filter["onlyDone"] = "only-done";
    Filter["onlyNotDone"] = "only-not-done";
})(Filter = exports.Filter || (exports.Filter = {}));
CustomTasksElements.prototype.className = "com.privmx.plugin.tasks.main.CustomTasksElements";
FixedNames.prototype.className = "com.privmx.plugin.tasks.main.FixedNames";
DefaultColWidths.prototype.className = "com.privmx.plugin.tasks.main.DefaultColWidths";

//# sourceMappingURL=Types.js.map
