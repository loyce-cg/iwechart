import { TaskModel } from "../component/taskGroupsPanel/TaskGroupsPanelController";
import { Task } from "./data/Task";

interface SizeAndString {
    size: number;
    str: string;
}

interface Comparable<T> {
    comparable: T;
    origId: string;
    pinned: boolean;
    tId: number;
}

export class TasksSorter {
    
    static statuses: { [key: string]: number } = null;
    
    static sort(tasks: TaskModel[], by: string, asc: boolean, ctxTgId: string): TaskModel[] {
        if (TasksSorter.statuses == null) {
            TasksSorter.statuses = {};
            let i = 0;
            for (let status of Task.getStatuses()) {
                TasksSorter.statuses[status] = i++;
            }
        }
        let funcCollect: (a: TaskModel) => any = null;
        let funcCmp: (a: any, b: any) => number = null;
        if (by == "hash-id") {
            funcCollect = this.collectId;
            funcCmp = asc ? this.compareByIdAsc : this.compareByIdDesc;
        }
        else if (by == "task") {
            funcCollect = this.collectId;
            funcCollect = this.collectTask;
            funcCmp = asc ? this.compareByTaskAsc : this.compareByTaskDesc;
        }
        else if (by == "status") {
            funcCollect = this.collectStatus;
            funcCmp = asc ? this.compareByStatusAsc : this.compareByStatusDesc;
        }
        else if (by == "assigned-to") {
            funcCollect = this.collectAssignedTo;
            funcCmp = asc ? this.compareByAssignedToAsc : this.compareByAssignedToDesc;
        }
        else if (by == "attachments") {
            funcCollect = this.collectAttachments;
            funcCmp = asc ? this.compareByAttachmentsAsc : this.compareByAttachmentsDesc;
        }
        else if (by == "created") {
            funcCollect = this.collectCreated;
            funcCmp = asc ? this.compareByCreatedAsc : this.compareByCreatedDesc;
        }
        else if (by == "modified") {
            funcCollect = this.collectModified;
            funcCmp = asc ? this.compareByModifiedAsc : this.compareByModifiedDesc;
        }
        
        let sortable: Comparable<any>[] = [];
        let map: { [taskId: string]: TaskModel } = {};
        for (let task of tasks) {
            sortable.push({
                origId: task.id,
                comparable: funcCollect(task),
                pinned: task.pinnedInTaskGroupIds.indexOf(ctxTgId) >= 0,
                tId: parseInt(task.id),
            });
            map[task.id] = task;
        }
        
        sortable.sort((a, b) => {
            if (a.pinned != b.pinned) {
                let ap = a.pinned ? 1 : 0;
                let bp = b.pinned ? 1 : 0;
                return bp - ap;
            }
            let val = funcCmp(a, b);
            if (val != 0) {
                return val;
            }
            return asc ? (a.tId - b.tId) : (b.tId - a.tId);
        });
        
        let sorted: TaskModel[] = [];
        for (let entry of sortable) {
            sorted.push(map[entry.origId]);
        }
        return sorted;
    }
    
    protected static collectId(a: TaskModel): number {
        return parseInt(a.id);
    }
    protected static collectTask(a: TaskModel): string {
        return a.title + " " + a.description;
    }
    protected static collectStatus(a: TaskModel): number {
        return TasksSorter.statuses[a.status];
    }
    protected static collectAssignedTo(a: TaskModel): SizeAndString {
        return { size: a.assignedTo.length, str: a.assignedTo.sort().join(", ") };
    }
    protected static collectAttachments(a: TaskModel): SizeAndString {
        return { size: a.attachments.length, str: a.attachments.map(x => JSON.parse(x).name).sort().join(", ") };
    }
    protected static collectCreated(a: TaskModel): number {
        return a.createdAt;
    }
    protected static collectModified(a: TaskModel): number {
        return a.modifiedAt;
    }
    
    protected static compareByIdAsc(a: Comparable<number>, b: Comparable<number>): number {
        return a.comparable - b.comparable;
    }
    protected static compareByIdDesc(a: Comparable<number>, b: Comparable<number>): number {
        return b.comparable - a.comparable;
    }
    protected static compareByTaskAsc(a: Comparable<string>, b: Comparable<string>): number {
        return a.comparable.localeCompare(b.comparable);
    }
    protected static compareByTaskDesc(a: Comparable<string>, b: Comparable<string>): number {
        return b.comparable.localeCompare(a.comparable);
    }
    protected static compareByStatusAsc(a: Comparable<number>, b: Comparable<number>): number {
        return a.comparable - b.comparable;
    }
    protected static compareByStatusDesc(a: Comparable<number>, b: Comparable<number>): number {
        return b.comparable - a.comparable;
    }
    protected static compareByAssignedToAsc(a: Comparable<SizeAndString>, b: Comparable<SizeAndString>): number {
        if (a.comparable.size != b.comparable.size) {
            return a.comparable.size - b.comparable.size;
        }
        return a.comparable.str.localeCompare(b.comparable.str);
    }
    protected static compareByAssignedToDesc(a: Comparable<SizeAndString>, b: Comparable<SizeAndString>): number {
        if (a.comparable.size != b.comparable.size) {
            return b.comparable.size - a.comparable.size;
        }
        return b.comparable.str.localeCompare(a.comparable.str);
    }
    protected static compareByAttachmentsAsc(a: Comparable<SizeAndString>, b: Comparable<SizeAndString>): number {
        if (a.comparable.size != b.comparable.size) {
            return a.comparable.size - b.comparable.size;
        }
        return a.comparable.str.localeCompare(b.comparable.str);
    }
    protected static compareByAttachmentsDesc(a: Comparable<SizeAndString>, b: Comparable<SizeAndString>): number {
        if (a.comparable.size != b.comparable.size) {
            return b.comparable.size - a.comparable.size;
        }
        return b.comparable.str.localeCompare(a.comparable.str);
    }
    protected static compareByCreatedAsc(a: Comparable<number>, b: Comparable<number>): number {
        return a.comparable - b.comparable;
    }
    protected static compareByCreatedDesc(a: Comparable<number>, b: Comparable<number>): number {
        return b.comparable - a.comparable;
    }
    protected static compareByModifiedAsc(a: Comparable<number>, b: Comparable<number>): number {
        return a.comparable - b.comparable;
    }
    protected static compareByModifiedDesc(a: Comparable<number>, b: Comparable<number>): number {
        return b.comparable - a.comparable;
    }
    
}
