"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var Types_1 = require("./Types");
var TaskGroup_1 = require("./data/TaskGroup");
var Project_1 = require("./data/Project");
var Task_1 = require("./data/Task");
var DataMigration_1 = require("./DataMigration");
var AttachmentsManager_1 = require("./AttachmentsManager");
var SimpleTaskService = (function () {
    function SimpleTaskService(srpSecure, sectionManager, identity, localeService) {
        this.srpSecure = srpSecure;
        this.sectionManager = sectionManager;
        this.identity = identity;
        this.localeService = localeService;
    }
    SimpleTaskService.prototype.nextId = function (key) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.srpSecure.request("nextUniqueId", { key: key });
        })
            .then(function (x) {
            var s = "" + x;
            while (s.length < 3) {
                s = "0" + s;
            }
            return s;
        });
    };
    SimpleTaskService.prototype.nextTaskGroupId = function () {
        return this.nextId(Types_1.StoredObjectTypes.tasksList);
    };
    SimpleTaskService.prototype.nextTaskId = function () {
        return this.nextId(Types_1.StoredObjectTypes.tasksTask);
    };
    SimpleTaskService.prototype.getKvdb = function (sectionId) {
        return this.sectionManager.getSection(sectionId).getKvdbCollection();
    };
    SimpleTaskService.prototype.getMyId = function () {
        return this.getMyself().id;
    };
    SimpleTaskService.prototype.getMyself = function () {
        return {
            id: this.identity.hashmail,
            name: this.identity.user,
            avatar: null,
            isBasic: false,
        };
    };
    SimpleTaskService.prototype.createAttachmentInfo = function (did, name) {
        return AttachmentsManager_1.AttachmentsManager.createAttachmentInfoString(did, name);
    };
    SimpleTaskService.prototype.setKvdbElement = function (collectionId, key, element) {
        return this.getKvdb(collectionId).then(function (kvdb) {
            var element2 = JSON.parse(JSON.stringify(element));
            if ("taskGroupIds" in element2 && element2.className == "com.privmx.plugin.tasks.main.data.Project") {
                element2.taskGroupIds = [];
            }
            if ("orphanedTaskIds" in element2) {
                element2.orphanedTaskIds = [];
            }
            if ("taskIds" in element2) {
                element2.taskIds = [];
            }
            if ("__version__" in element2) {
                element2.__version__++;
            }
            else {
                element2.__version__ = 1;
            }
            return kvdb.set(key, { secured: { payload: element2 } });
        });
    };
    SimpleTaskService.prototype.saveProject = function (project) {
        return this.setKvdbElement(project.getId(), "p_" + project.getId(), project);
    };
    SimpleTaskService.prototype.saveTaskGroup = function (taskGroup) {
        return this.setKvdbElement(taskGroup.getProjectId(), "g_" + taskGroup.getId(), taskGroup);
    };
    SimpleTaskService.prototype.saveTask = function (task) {
        return this.setKvdbElement(task.getProjectId(), "t_" + task.getId(), task);
    };
    SimpleTaskService.prototype.createProject = function (projectId, projectName, defaultViewMode, defaultIsKanban, defaultIsHorizontal) {
        var p = new Project_1.Project();
        p.setId(projectId);
        p.setName(projectName);
        p.setTaskPriorities(["Critical", "High", "[Normal]", "Low"]);
        p.setTaskStatuses(["Idea", "[Todo]", "In progress", "Done"]);
        p.setTaskTypes(["Bug", "Feature", "[Other]"]);
        if (defaultViewMode) {
            p.setDefaultViewMode(defaultViewMode);
        }
        if (defaultIsKanban !== null) {
            p.setDefaultIsKanban(defaultIsKanban);
        }
        if (defaultIsHorizontal !== null) {
            p.setDefaultIsHorizontal(defaultIsHorizontal);
        }
        return this.saveProject(p)
            .then(function () {
            return projectId;
        });
    };
    SimpleTaskService.prototype.createTaskGroup = function (projectId, name, icon) {
        var _this = this;
        return this.nextTaskGroupId()
            .then(function (id) {
            var tg = new TaskGroup_1.TaskGroup();
            DataMigration_1.DataMigration.setVersion(tg);
            tg.setId(id);
            tg.setName(name);
            tg.setProjectId(projectId);
            tg.setIcon(icon);
            return _this.saveTaskGroup(tg)
                .then(function () {
                return id;
            });
        });
    };
    SimpleTaskService.prototype.createTask = function (projectId, taskGroupIds, description, status, calendarInfo, attachments, comments) {
        var _this = this;
        return this.nextTaskId()
            .then(function (id) {
            var nowTimestamp = new Date().getTime();
            var t = new Task_1.Task();
            DataMigration_1.DataMigration.setVersion(t);
            t.setId(id);
            t.setDescription(description);
            t.setStatus(status);
            t.setProjectId(projectId);
            t.setTaskGroupIds(taskGroupIds);
            t.setCreatedBy(_this.getMyId());
            t.setCreatedDateTime(nowTimestamp);
            t.setModifiedBy(_this.getMyId());
            t.setModifiedDateTime(nowTimestamp);
            t.setAssignedTo([_this.getMyId()]);
            if (calendarInfo) {
                t.setStartTimestamp(calendarInfo.startTimestamp);
                t.setEndTimestamp(calendarInfo.endTimestamp);
                t.setWholeDays(calendarInfo.wholeDays);
            }
            t.addHistory({
                when: nowTimestamp,
                who: _this.getMyId(),
                what: "created",
            });
            (attachments || []).forEach(function (x) {
                t.addAttachment(x);
            });
            return _this.addTaskComments(t, comments).then(function () {
                return _this.saveTask(t).then(function () {
                    return id;
                });
            });
        });
    };
    SimpleTaskService.prototype.afterImport = function (sectionId) {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.moveTasksWithoutListToEnd(sectionId);
        });
    };
    SimpleTaskService.prototype.moveTasksWithoutListToEnd = function (projectId) {
        var _this = this;
        var key = "p_" + projectId;
        return this.getKvdb(projectId).then(function (kvdb) {
            var tgIds = kvdb.collection.list.filter(function (x) { return x.secured.key.substr(0, 2) == "g_"; }).map(function (x) { return x.secured.key.substr(2); });
            return kvdb.get(key).then(function (element) {
                var project = new Project_1.Project(JSON.parse(JSON.stringify(element.secured.payload)));
                tgIds = tgIds.filter(function (x) { return x != "__orphans__"; });
                tgIds.push("__orphans__");
                project.setTaskGroupsOrder(tgIds);
                _this.saveProject(project);
            });
        });
    };
    SimpleTaskService.prototype.addTaskComments = function (task, comments) {
        var _this = this;
        var chatModule = this.sectionManager.getSection(task.getProjectId()).getChatModule();
        if (!chatModule) {
            return pmc_mail_1.Q();
        }
        if (!comments) {
            return pmc_mail_1.Q();
        }
        var prom = pmc_mail_1.Q();
        var _loop_1 = function (comment) {
            prom = prom.then(function () {
                return _this.sendTaskCommentMessage(task, chatModule, comment.message);
            });
        };
        for (var _i = 0, comments_1 = comments; _i < comments_1.length; _i++) {
            var comment = comments_1[_i];
            _loop_1(comment);
        }
        return prom;
    };
    SimpleTaskService.prototype.sendTaskCommentMessage = function (task, chatModule, comment) {
        return chatModule.sendTaggedJsonMessage({ data: {
                type: "task-comment",
                who: this.getMyId(),
                id: task.getId(),
                label: "#" + task.getId().substr(0, 5),
                comment: comment,
                status: task.getStatus(),
                statusLocaleName: this.localeService.i18n("plugin.tasks.status-" + task.getStatus()),
                numOfStatuses: Task_1.Task.getStatuses().length,
                statusColor: Task_1.Task.getLabelClass(task.getStatus())
            } }, ["taskid:" + task.getId()]).then(function (result) {
            task.addCommentTag(result.message.mainReceiver.sink.id + "/" + result.message.id);
        });
    };
    return SimpleTaskService;
}());
exports.SimpleTaskService = SimpleTaskService;
SimpleTaskService.prototype.className = "com.privmx.plugin.tasks.main.SimpleTaskService";

//# sourceMappingURL=SimpleTaskService.js.map
