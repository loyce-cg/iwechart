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
var SearchFilter_1 = require("../SearchFilter");
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["UNKNOWN"] = "unknown";
    TaskStatus["TODO"] = "todo";
    TaskStatus["INPROGRESS"] = "inprogress";
    TaskStatus["DONE"] = "done";
    TaskStatus["IDEA"] = "idea";
})(TaskStatus = exports.TaskStatus || (exports.TaskStatus = {}));
var Task = (function (_super) {
    __extends(Task, _super);
    function Task(obj) {
        if (obj === void 0) { obj = null; }
        var _this = _super.call(this, obj) || this;
        _this._cachedSearchString = null;
        _this.ensureFieldsAreArrays([
            "attachments",
            "assignedTo",
            "history",
            "taskGroupIds",
            "commentTags",
            "pinnedInTaskGroupIds",
        ]);
        if (_this.duration) {
            if (_this.startTimestamp && !_this.endTimestamp) {
                _this.endTimestamp = _this.startTimestamp + _this.duration;
            }
            delete _this.duration;
        }
        else if (_this.startTimestamp && !_this.endTimestamp) {
            _this.endTimestamp = _this.startTimestamp + 3600000;
            _this.wholeDays = true;
        }
        return _this;
    }
    Task.prototype.getId = function () {
        return this.id;
    };
    Task.prototype.setId = function (value) {
        this.id = value;
    };
    Task.prototype.getName = function () {
        return this.name;
    };
    Task.prototype.setName = function (value) {
        this.name = value;
    };
    Task.prototype.getDescription = function () {
        return this.description;
    };
    Task.prototype.setDescription = function (value) {
        value = value.replace(/\n/g, " ");
        this.setName(value.split("<br>")[0].trim());
        this.description = value;
        this._cachedSearchString = null;
    };
    Task.prototype.getType = function () {
        return this.type;
    };
    Task.prototype.setType = function (value) {
        this.type = value;
    };
    Task.prototype.getStatus = function () {
        if (!this.status2) {
            var newDataVersion = this.__data_version__ > 1;
            this.status2 = Task.convertStatus(this.status, newDataVersion);
        }
        return this.status2;
    };
    Task.prototype.setStatus = function (value) {
        this.status = 0;
        this.status2 = value;
    };
    Task.prototype.getPriority = function () {
        return this.priority;
    };
    Task.prototype.setPriority = function (value) {
        this.priority = value;
    };
    Task.prototype.getAssignedTo = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.assignedTo.slice() : this.assignedTo;
    };
    Task.prototype.setAssignedTo = function (value) {
        this.assignedTo = value;
    };
    Task.prototype.addAssignedTo = function (person, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.assignedTo, person, ensureUnique);
    };
    Task.prototype.removeAssignedTo = function (person) {
        return this.removeFromProperty(this.assignedTo, person);
    };
    Task.prototype.isAssignedTo = function (person) {
        return this.assignedTo.indexOf(person) >= 0;
    };
    Task.prototype.getAttachments = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.attachments.slice() : this.attachments;
    };
    Task.prototype.setAttachments = function (value) {
        this.attachments = value;
    };
    Task.prototype.addAttachment = function (attachment, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.attachments, attachment, ensureUnique);
    };
    Task.prototype.removeAttachment = function (attachment) {
        return this.removeFromProperty(this.attachments, attachment);
    };
    Task.prototype.getHistory = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.history.slice() : this.history;
    };
    Task.prototype.setHistory = function (value) {
        this.history = value;
    };
    Task.prototype.addHistory = function (historyEntry, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.history, historyEntry, ensureUnique);
    };
    Task.prototype.getTaskGroupIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.taskGroupIds.slice() : this.taskGroupIds;
    };
    Task.prototype.setTaskGroupIds = function (value) {
        this.taskGroupIds = value;
    };
    Task.prototype.addTaskGroupId = function (taskGroupId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.taskGroupIds, taskGroupId, ensureUnique);
    };
    Task.prototype.removeTaskGroupId = function (taskGroupId) {
        return this.removeFromProperty(this.taskGroupIds, taskGroupId);
    };
    Task.prototype.getProjectId = function () {
        return this.projectId;
    };
    Task.prototype.setProjectId = function (value) {
        this.projectId = value;
    };
    Task.prototype.getCreatedBy = function () {
        return this.createdBy;
    };
    Task.prototype.setCreatedBy = function (value) {
        this.createdBy = value;
    };
    Task.prototype.getCreatedDateTime = function () {
        return this.createdDateTime;
    };
    Task.prototype.setCreatedDateTime = function (value) {
        this.createdDateTime = value;
    };
    Task.prototype.getModifiedBy = function () {
        return this.modifiedBy;
    };
    Task.prototype.setModifiedBy = function (value) {
        this.modifiedBy = value;
    };
    Task.prototype.getModifiedDateTime = function () {
        return this.modifiedDateTime;
    };
    Task.prototype.setModifiedDateTime = function (value) {
        this.modifiedDateTime = value;
    };
    Task.prototype.getCommentTags = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.commentTags.slice() : this.commentTags;
    };
    Task.prototype.setCommentTags = function (value) {
        this.commentTags = value;
    };
    Task.prototype.getComments = function () {
        var deserialized = [];
        try {
            deserialized = JSON.parse(this.comments);
        }
        catch (e) { }
        return deserialized;
    };
    Task.prototype.setComments = function (comments) {
        this.comments = JSON.stringify(comments);
    };
    Task.prototype.addCommentTag = function (taskCommentTag, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.commentTags, taskCommentTag, ensureUnique);
    };
    Task.prototype.removeCommentTag = function (taskCommentTag) {
        return this.removeFromProperty(this.commentTags, taskCommentTag);
    };
    Task.prototype.getPinnedInTaskGroupIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.pinnedInTaskGroupIds.slice() : this.pinnedInTaskGroupIds;
    };
    Task.prototype.setPinnedInTaskGroupIds = function (value) {
        this.pinnedInTaskGroupIds = value;
    };
    Task.prototype.addPinnedInTaskGroupId = function (taskGroupId, ensureUnique) {
        if (ensureUnique === void 0) { ensureUnique = false; }
        return this.addToProperty(this.pinnedInTaskGroupIds, taskGroupId, ensureUnique, true);
    };
    Task.prototype.removePinnedInTaskGroupId = function (taskGroupId) {
        return this.removeFromProperty(this.pinnedInTaskGroupIds, taskGroupId);
    };
    Task.prototype.getCachedSearchString = function () {
        if (this._cachedSearchString === null) {
            var description = this.description;
            var preparedDescription = SearchFilter_1.SearchFilter.prepareHaystack(description);
            this._cachedSearchString = preparedDescription.replace(/<(?:.|\n)*?>/gm, '');
        }
        return this._cachedSearchString;
    };
    Task.prototype.getPreDetachTaskGroupIds = function (newArray) {
        if (newArray === void 0) { newArray = false; }
        return newArray ? this.preDetachTaskGroupIds.slice() : this.preDetachTaskGroupIds;
    };
    Task.prototype.setPreDetachTaskGroupIds = function (value) {
        this.preDetachTaskGroupIds = value;
    };
    Task.prototype.getIsTrashed = function () {
        return typeof (this.isTrashed) == "undefined" ? false : this.isTrashed;
    };
    Task.prototype.setIsTrashed = function (value) {
        this.isTrashed = value;
    };
    Task.prototype.getMetaDataStr = function () {
        return typeof (this.metaDataStr) == "undefined" ? null : this.metaDataStr;
    };
    Task.prototype.setMetaDataStr = function (value) {
        this.metaDataStr = value;
    };
    Task.prototype.getLabelClass = function () {
        return Task.getLabelClass(this.getStatus());
    };
    Task.getLabelClass = function (status) {
        return "task-status-" + status;
    };
    Task.getDefaultStatus = function () {
        return TaskStatus.TODO;
    };
    Task.getStatusText = function (status) {
        if (status == TaskStatus.UNKNOWN) {
            return "unknown";
        }
        else if (status == TaskStatus.TODO) {
            return "Todo";
        }
        else if (status == TaskStatus.INPROGRESS) {
            return "In progress";
        }
        else if (status == TaskStatus.DONE) {
            return "Done";
        }
        else if (status == TaskStatus.IDEA) {
            return "Idea";
        }
    };
    Task.convertStatus = function (old, newDataVersion) {
        if (newDataVersion) {
            if (old == 0 || old == 1) {
                return TaskStatus.TODO;
            }
            else if (old == 2) {
                return TaskStatus.INPROGRESS;
            }
            else if (old == 3) {
                return TaskStatus.DONE;
            }
        }
        else {
            if (old == 0) {
                return TaskStatus.TODO;
            }
            else if (old == 1) {
                return TaskStatus.INPROGRESS;
            }
            else if (old == 2) {
                return TaskStatus.DONE;
            }
        }
        return TaskStatus.UNKNOWN;
    };
    Task.getStatuses = function () {
        return [
            TaskStatus.IDEA,
            TaskStatus.TODO,
            TaskStatus.INPROGRESS,
            TaskStatus.DONE,
        ];
    };
    Task.prepareHaystack = function (str) {
        return SearchFilter_1.SearchFilter.prepareHaystack(str);
    };
    Task.prototype.wasUnread = function (sectionId, watchedTasksHistory, myId) {
        var unread = false;
        var inHistory = watchedTasksHistory[sectionId] ? watchedTasksHistory[sectionId][this.getId()] : null;
        var taskHistory = this.getHistory();
        var last = taskHistory[taskHistory.length - 1];
        var modifier = last.when > this.getModifiedDateTime() ? last.who : this.getModifiedBy();
        if (modifier != myId) {
            if (!inHistory || inHistory.lastWatched < this.getModifiedDateTime()) {
                unread = (sectionId && sectionId == this.getProjectId()) || sectionId == null;
            }
        }
        return unread;
    };
    Task.prototype.getStartTimestamp = function () {
        return this.startTimestamp;
    };
    Task.prototype.setStartTimestamp = function (value) {
        this.startTimestamp = value;
    };
    Task.prototype.getEndTimestamp = function () {
        return this.endTimestamp;
    };
    Task.prototype.setEndTimestamp = function (value) {
        this.endTimestamp = value;
    };
    Task.prototype.getWholeDays = function () {
        return this.wholeDays;
    };
    Task.prototype.setWholeDays = function (value) {
        this.wholeDays = value;
    };
    Task.prototype.matchesSearchString = function (searchStr) {
        return Task.matchesSearchString(this.id, this.getCachedSearchString(), searchStr);
    };
    Task.matchesSearchString = function (taskId, cachedSearchString, searchStr) {
        if (searchStr.length > 0 && searchStr[0] == "#") {
            return taskId.indexOf(searchStr.substr(1)) == 0;
        }
        return cachedSearchString.indexOf(searchStr) >= 0;
    };
    Task.prototype.updateModifiedServerDateTime = function (dt) {
        var _this = this;
        if (this.modifiedDateTime) {
            this.history.filter(function (x) { return x.when == _this.modifiedDateTime; }).forEach(function (x) { return x.when = dt; });
        }
        this.setModifiedDateTime(dt);
    };
    Task.prototype.diff = function (other) {
        var diffs = [];
        if (this.getId() != other.getId()) {
            diffs.push("id");
        }
        if (this.getName() != other.getName()) {
            diffs.push("name");
        }
        if (this.getDescription() != other.getDescription()) {
            diffs.push("description");
        }
        if (this.getType() != other.getType()) {
            diffs.push("type");
        }
        if (this.getStatus() != other.getStatus()) {
            diffs.push("status");
        }
        if (this.getPriority() != other.getPriority()) {
            diffs.push("priority");
        }
        if (!Utils_1.Utils.arraysEqual(this.getAttachments(), other.getAttachments())) {
            diffs.push("attachments");
        }
        if (!Utils_1.Utils.arraysEqual(this.getAssignedTo(), other.getAssignedTo())) {
            diffs.push("assignedTo");
        }
        if (!Utils_1.Utils.arraysEqual(this.getHistory(), other.getHistory(), function (a, b) { return a.when == b.when && a.who == b.who; })) {
            diffs.push("history");
        }
        if (!Utils_1.Utils.arraysEqual(this.getTaskGroupIds(), other.getTaskGroupIds())) {
            diffs.push("taskGroupIds");
        }
        if (this.getProjectId() != other.getProjectId()) {
            diffs.push("projectId");
        }
        if (this.getCreatedBy() != other.getCreatedBy()) {
            diffs.push("createdBy");
        }
        if (this.getCreatedDateTime() != other.getCreatedDateTime()) {
            diffs.push("createdDateTime");
        }
        if (this.getModifiedBy() != other.getModifiedBy()) {
            diffs.push("modifiedBy");
        }
        if (this.getModifiedDateTime() != other.getModifiedDateTime()) {
            diffs.push("modifiedDateTime");
        }
        if (!Utils_1.Utils.arraysEqual(this.getCommentTags(), other.getCommentTags())) {
            diffs.push("commentTags");
        }
        if (this.getIsTrashed() != other.getIsTrashed()) {
            diffs.push("isTrashed");
        }
        if (this.getStartTimestamp() != other.getStartTimestamp()) {
            diffs.push("startTimestamp");
        }
        if (this.getEndTimestamp() != other.getEndTimestamp()) {
            diffs.push("endTimestamp");
        }
        if (this.getWholeDays() != other.getWholeDays()) {
            diffs.push("wholeDays");
        }
        if (this.getComments() != other.getComments()) {
            diffs.push("comments");
        }
        return diffs;
    };
    return Task;
}(DataObject_1.DataObject));
exports.Task = Task;
Task.prototype.className = "com.privmx.plugin.tasks.main.data.Task";

//# sourceMappingURL=Task.js.map
