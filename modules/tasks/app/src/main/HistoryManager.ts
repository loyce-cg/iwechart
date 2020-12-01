import { Task } from "./data/Task";
import { TasksPlugin } from "./TasksPlugin";
import { Utils } from "./utils/Utils";
import { AttachmentInfo } from "./AttachmentsManager";
import {mail} from "pmc-mail";

export class HistoryManager {
    
    protected tasksPlugin: TasksPlugin;
    protected myId: string;
    protected isNewTask: boolean = false;
    
    constructor(public session: mail.session.Session, tasksPlugin: TasksPlugin) {
        this.tasksPlugin = tasksPlugin;
        this.setSession(session);
    }
    
    setSession(session: mail.session.Session): void {
        if (session) {
            this.session = session;
            this.myId = this.tasksPlugin.getMyId(this.session);
        }
    }
    
    setIsNewTask(isNewTask: boolean): void {
        this.isNewTask = isNewTask;
    }
    
    addFromAttachmentArrays(task: Task, previousAttachmentStrings: string[], newAttachmentStrings: string[], suppressAttachmentAddedHistory: string[] = [], suppressAttachmentRemovedHistory: string[] = []): void {
        if (this.isNewTask) {
            return;
        }
        
        let now = new Date().getTime();
        
        let previousAttachments: AttachmentInfo[] = previousAttachmentStrings.map(x => JSON.parse(x));
        let newAttachments: AttachmentInfo[] = newAttachmentStrings.map(x => JSON.parse(x));
        let previousAttachmentDids = previousAttachments.map(x => x.did);
        let newAttachmentDids = newAttachments.map(x => x.did);
        
        let differences = Utils.arrayDiff(previousAttachmentDids, newAttachmentDids);
        for (let addedDid of differences.added) {
            if (suppressAttachmentAddedHistory.indexOf(addedDid) >= 0) {
                continue;
            }
            let addedAttachment = newAttachments.filter(x => x.did == addedDid)[0];
            task.addHistory({
                when: now,
                who: this.myId,
                what: "added",
                arg: "attachment",
                newVal: JSON.stringify(addedAttachment),
            });
        }
        for (let removedDid of differences.removed) {
            if (suppressAttachmentRemovedHistory.indexOf(removedDid) >= 0) {
                continue;
            }
            let removedAttachment = previousAttachments.filter(x => x.did == removedDid)[0];
            task.addHistory({
                when: now,
                who: this.myId,
                what: "removed",
                arg: "attachment",
                oldVal: JSON.stringify(removedAttachment),
            });
        }
    }
    
}
