import { mail, Q, privfs } from "pmc-mail";
import { TaskGroupId, StoredObjectTypes, TaskId, PersonId, Person, AttachmentId } from "./Types";
import { TaskGroup } from "./data/TaskGroup";
import { Project } from "./data/Project";
import { Task, TaskStatus } from "./data/Task";
import { DataMigration } from "./DataMigration";
import { AttachmentsManager } from "./AttachmentsManager";

export interface CalendarInfo {
    startTimestamp: number;
    endTimestamp: number;
    wholeDays: boolean;
}

export class SimpleTaskService {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public sectionManager: mail.section.SectionManager,
        public identity: privfs.identity.Identity,
        public localeService: mail.LocaleService
    ) {
        
    }
    
    nextId(key: string): Q.Promise<string> {
        return Q().then(() => {
            return this.srpSecure.request("nextUniqueId", {key: key});
        })
        .then(x => {
            let s = "" + x;
            while (s.length < 3) {
                s = "0" + s;
            }
            return s;
        });
    }
    
    nextTaskGroupId(): Q.Promise<TaskGroupId> {
        return this.nextId(StoredObjectTypes.tasksList);
    }
    
    nextTaskId(): Q.Promise<TaskId> {
        return this.nextId(StoredObjectTypes.tasksTask);
    }
    
    getKvdb(sectionId: string) {
        return this.sectionManager.getSection(sectionId).getKvdbCollection();
    }
    
    getMyId(): PersonId {
        return this.getMyself().id;
    }
    
    getMyself(): Person {
        return {
            id: this.identity.hashmail,
            name: this.identity.user,
            avatar: null,
            isBasic: false,
        };
    }
    
    createAttachmentInfo(did: string, name: string): string {
        return AttachmentsManager.createAttachmentInfoString(did, name);
    }
    
    setKvdbElement(collectionId: string, key: string, element:Project|TaskGroup|Task): Q.Promise<void> {
        return this.getKvdb(collectionId).then(kvdb => {
            let element2 = JSON.parse(JSON.stringify(element));
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
            return kvdb.set(key, {secured:{payload:element2}});
        });
    }
    
    saveProject(project: Project): Q.Promise<void> {
        return this.setKvdbElement(project.getId(), "p_" + project.getId(), project);
    }
    
    saveTaskGroup(taskGroup: TaskGroup): Q.Promise<void> {
        return this.setKvdbElement(taskGroup.getProjectId(), "g_" + taskGroup.getId(), taskGroup);
    }
    
    saveTask(task: Task): Q.Promise<void> {
        return this.setKvdbElement(task.getProjectId(), "t_" + task.getId(), task);
    }
    
    createProject(projectId: string, projectName: string, defaultViewMode?: "rm"|"groupped", defaultIsKanban?: boolean, defaultIsHorizontal?: boolean): Q.Promise<string> {
        let p = new Project();
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
        .then(() => {
            return projectId;
        });
    }
    
    createTaskGroup(projectId: string, name: string, icon: string): Q.Promise<TaskGroupId> {
        return this.nextTaskGroupId()
        .then(id => {
            let tg = new TaskGroup();
            DataMigration.setVersion(tg);
            tg.setId(id);
            tg.setName(name);
            tg.setProjectId(projectId);
            tg.setIcon(icon);
            return this.saveTaskGroup(tg)
            .then(() => {
                return id;
            });
        });
    }
    
    createTask(projectId: string, taskGroupIds: string[], description: string, status: TaskStatus, calendarInfo?: CalendarInfo, attachments?: AttachmentId[], comments?: { message: string, user: string, date: number }[]): Q.Promise<TaskId> {
        return this.nextTaskId()
        .then(id => {
            let nowTimestamp = new Date().getTime();
            let t = new Task();
            DataMigration.setVersion(t);
            t.setId(id);
            t.setDescription(description);
            t.setStatus(status);
            t.setProjectId(projectId);
            t.setTaskGroupIds(taskGroupIds);
            t.setCreatedBy(this.getMyId());
            t.setCreatedDateTime(nowTimestamp);
            t.setModifiedBy(this.getMyId());
            t.setModifiedDateTime(nowTimestamp);
            t.setAssignedTo([this.getMyId()]);
            if (calendarInfo) {
                t.setStartTimestamp(calendarInfo.startTimestamp);
                t.setEndTimestamp(calendarInfo.endTimestamp);
                t.setWholeDays(calendarInfo.wholeDays);
            }
            t.addHistory({
                when: nowTimestamp,
                who: this.getMyId(),
                what: "created",
            });
            (attachments || []).forEach(x => {
                t.addAttachment(x);
            });
            
            return this.addTaskComments(t, comments).then(() => {
                return this.saveTask(t).then(() => {
                    return id;
                });
            });
        });
    }
    
    afterImport(sectionId: string): Q.Promise<void> {
        return Q().then(() => {
            return this.moveTasksWithoutListToEnd(sectionId);
        })
    }
    
    moveTasksWithoutListToEnd(projectId: string): Q.Promise<void> {
        let key = "p_" + projectId;
        return this.getKvdb(projectId).then(kvdb => {
            let tgIds: string[] = kvdb.collection.list.filter(x => x.secured.key.substr(0, 2) == "g_").map(x => x.secured.key.substr(2));
            return kvdb.get(key).then(element => {
                let project: Project = new Project(JSON.parse(JSON.stringify(element.secured.payload)));
                
                tgIds = tgIds.filter(x => x != "__orphans__");
                tgIds.push("__orphans__");
                project.setTaskGroupsOrder(tgIds);
                
                this.saveProject(project);
            });
        });
    }
    
    addTaskComments(task: Task, comments: { message: string, user: string, date: number }[]): Q.Promise<void> {
        let chatModule = this.sectionManager.getSection(task.getProjectId()).getChatModule();
        if (!chatModule) {
            return Q();
        }
        if (! comments) {
            return Q();
        }
        let prom = Q();
        for (let comment of comments) {
            prom = prom.then(() => {
                return this.sendTaskCommentMessage(task, chatModule, comment.message);
            });
        }
        return prom;
    }
    
    sendTaskCommentMessage(task: Task, chatModule: mail.section.ChatModuleService, comment: string): Q.Promise<void> {
        return chatModule.sendTaggedJsonMessage(
            {data: {
                type: "task-comment",
                who: this.getMyId(),
                id: task.getId(),
                label: "#" + task.getId().substr(0,5),
                comment: comment,
                status: task.getStatus(),
                statusLocaleName: this.localeService.i18n("plugin.tasks.status-" + task.getStatus()),
                numOfStatuses: Task.getStatuses().length,
                statusColor: Task.getLabelClass(task.getStatus())
            }},
            ["taskid:" + task.getId()]
        ).then(result => {
            task.addCommentTag(result.message.mainReceiver.sink.id + "/" + result.message.id);
        });
    }
    
}