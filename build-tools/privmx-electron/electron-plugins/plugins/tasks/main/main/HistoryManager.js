"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Utils_1 = require("./utils/Utils");
var HistoryManager = (function () {
    function HistoryManager(session, tasksPlugin) {
        this.session = session;
        this.isNewTask = false;
        this.tasksPlugin = tasksPlugin;
        this.setSession(session);
    }
    HistoryManager.prototype.setSession = function (session) {
        if (session) {
            this.session = session;
            this.myId = this.tasksPlugin.getMyId(this.session);
        }
    };
    HistoryManager.prototype.setIsNewTask = function (isNewTask) {
        this.isNewTask = isNewTask;
    };
    HistoryManager.prototype.addFromAttachmentArrays = function (task, previousAttachmentStrings, newAttachmentStrings, suppressAttachmentAddedHistory, suppressAttachmentRemovedHistory) {
        if (suppressAttachmentAddedHistory === void 0) { suppressAttachmentAddedHistory = []; }
        if (suppressAttachmentRemovedHistory === void 0) { suppressAttachmentRemovedHistory = []; }
        if (this.isNewTask) {
            return;
        }
        var now = new Date().getTime();
        var previousAttachments = previousAttachmentStrings.map(function (x) { return JSON.parse(x); });
        var newAttachments = newAttachmentStrings.map(function (x) { return JSON.parse(x); });
        var previousAttachmentDids = previousAttachments.map(function (x) { return x.did; });
        var newAttachmentDids = newAttachments.map(function (x) { return x.did; });
        var differences = Utils_1.Utils.arrayDiff(previousAttachmentDids, newAttachmentDids);
        var _loop_1 = function (addedDid) {
            if (suppressAttachmentAddedHistory.indexOf(addedDid) >= 0) {
                return "continue";
            }
            var addedAttachment = newAttachments.filter(function (x) { return x.did == addedDid; })[0];
            task.addHistory({
                when: now,
                who: this_1.myId,
                what: "added",
                arg: "attachment",
                newVal: JSON.stringify(addedAttachment),
            });
        };
        var this_1 = this;
        for (var _i = 0, _a = differences.added; _i < _a.length; _i++) {
            var addedDid = _a[_i];
            _loop_1(addedDid);
        }
        var _loop_2 = function (removedDid) {
            if (suppressAttachmentRemovedHistory.indexOf(removedDid) >= 0) {
                return "continue";
            }
            var removedAttachment = previousAttachments.filter(function (x) { return x.did == removedDid; })[0];
            task.addHistory({
                when: now,
                who: this_2.myId,
                what: "removed",
                arg: "attachment",
                oldVal: JSON.stringify(removedAttachment),
            });
        };
        var this_2 = this;
        for (var _b = 0, _c = differences.removed; _b < _c.length; _b++) {
            var removedDid = _c[_b];
            _loop_2(removedDid);
        }
    };
    return HistoryManager;
}());
exports.HistoryManager = HistoryManager;
HistoryManager.prototype.className = "com.privmx.plugin.tasks.main.HistoryManager";

//# sourceMappingURL=HistoryManager.js.map
