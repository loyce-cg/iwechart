import * as Mail from "pmc-mail";
import { ConflictResolver, ConflictResolutionResult, ConflictResolutionStatus } from "./ConflictResolver";
import { Task } from "./Task";
import { TaskHistoryEntry } from "../Types";
let Logger = Mail.Logger.get("privfs-tasks-plugin.main.data.TaskConflictResolver");

export class TaskConflictResolver extends ConflictResolver<Task> {
    
    simpleProperties: string[] = [
        "name", "description", "type", "status", "priority",
        "projectId", "createdBy", "createdDateTime", "isTrashed",
        "startTimestamp" ,"endTimestamp", "wholeDays",
    ];
    simpleArrayProperties: string[] = [
        "attachments", "assignedTo", "taskGroupIds", "commentTags",
        "pinnedInTaskGroupIds", "preDetachTaskGroupIds", "comments",
    ];
    
    resolve(): ConflictResolutionResult<Task> {
        let a = this.first;
        let b = this.second;
        let aDiffs = a.diff(this.original);
        let bDiffs = b.diff(this.original);
        let abDiffs = b.diff(a);
        let resolvedObject: Task = new Task(JSON.parse(JSON.stringify(this.original)));
        
        if (abDiffs.length == 0) {
            return { status: ConflictResolutionStatus.IDENTICAL };
        }
        if (abDiffs.indexOf("id") >= 0) {
            return { status: ConflictResolutionStatus.DIFFERENT_OBJECT };
        }
        if (abDiffs.length == 3 && abDiffs.indexOf("history") >= 0 && abDiffs.indexOf("modifiedDateTime") >= 0 && abDiffs.indexOf("modifiedBy") >= 0) {
            return { status: ConflictResolutionStatus.IDENTICAL };
        }
        for (let propertyName of this.simpleProperties) {
            if (this.tryResolveSimplePropertyConflict(propertyName, resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolutionStatus.UNRESOLVED) {
                return { status: ConflictResolutionStatus.UNRESOLVED };
            }
        }
        for (let propertyName of this.simpleArrayProperties) {
            if (this.tryResolveSimpleArrayPropertyConflict(propertyName, resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolutionStatus.UNRESOLVED) {
                return { status: ConflictResolutionStatus.UNRESOLVED };
            }
        }
        
        // Handle modifiedBy and modifiedDateTime
        let t1 = this.first.getModifiedDateTime();
        let t2 = this.second.getModifiedDateTime();
        if (t1 == t2) {
            return { status: ConflictResolutionStatus.UNRESOLVED };
        }
        else if (t1 > t2) {
            resolvedObject.setModifiedDateTime(this.first.getModifiedDateTime());
            resolvedObject.setModifiedBy(this.first.getModifiedBy());
        }
        else if (t1 < t2) {
            resolvedObject.setModifiedDateTime(this.second.getModifiedDateTime());
            resolvedObject.setModifiedBy(this.second.getModifiedBy());
        }
        
        // Merge history
        resolvedObject.getHistory().push(...this.first.getHistory().slice(this.original.getHistory().length));
        resolvedObject.getHistory().push(...this.second.getHistory().slice(this.original.getHistory().length));
        
        return { status: ConflictResolutionStatus.RESOLVED, resolvedObject: resolvedObject };
    }
    
}
