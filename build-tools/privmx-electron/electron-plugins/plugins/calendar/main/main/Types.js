"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ViewContext;
(function (ViewContext) {
    ViewContext["Global"] = "global";
    ViewContext["CalendarWindow"] = "calendar";
    ViewContext["SummaryWindow"] = "summary";
})(ViewContext = exports.ViewContext || (exports.ViewContext = {}));
var CustomTasksElements = (function () {
    function CustomTasksElements() {
    }
    CustomTasksElements.ALL_TASKS_ID = "all-tasks";
    CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID = "tasks-assigned-to-me";
    CustomTasksElements.TASKS_CREATED_BY_ME_ID = "tasks-created-by-me";
    CustomTasksElements.TRASH_ID = "trash";
    return CustomTasksElements;
}());
exports.CustomTasksElements = CustomTasksElements;
var Modes = (function () {
    function Modes() {
    }
    Modes.MONTH = "month";
    Modes.WEEK = "week";
    Modes.SINGLE_WEEK = "singleweek";
    Modes.SINGLE_DAY = "singleday";
    return Modes;
}());
exports.Modes = Modes;
var Filter;
(function (Filter) {
    Filter["allTasks"] = "all-tasks";
    Filter["onlyIdea"] = "only-idea";
    Filter["onlyTodo"] = "only-todo";
    Filter["onlyInProgress"] = "only-in-progress";
    Filter["onlyDone"] = "only-done";
    Filter["onlyNotDone"] = "only-not-done";
})(Filter = exports.Filter || (exports.Filter = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["UNKNOWN"] = "unknown";
    TaskStatus["TODO"] = "todo";
    TaskStatus["INPROGRESS"] = "inprogress";
    TaskStatus["DONE"] = "done";
    TaskStatus["IDEA"] = "idea";
})(TaskStatus = exports.TaskStatus || (exports.TaskStatus = {}));
var SortFilesBy;
(function (SortFilesBy) {
    SortFilesBy["CREATED"] = "created";
    SortFilesBy["MODIFIED"] = "modified";
})(SortFilesBy = exports.SortFilesBy || (exports.SortFilesBy = {}));
CustomTasksElements.prototype.className = "com.privmx.plugin.calendar.main.CustomTasksElements";
Modes.prototype.className = "com.privmx.plugin.calendar.main.Modes";

//# sourceMappingURL=Types.js.map
