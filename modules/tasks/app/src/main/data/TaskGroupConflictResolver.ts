import * as Mail from "pmc-mail";
import { ConflictResolver, ConflictResolutionResult, ConflictResolutionStatus } from "./ConflictResolver";
import { TaskGroup } from "./TaskGroup";
let Logger = Mail.Logger.get("privfs-tasks-plugin.main.data.TaskGroupConflictResolver");

export class TaskGroupConflictResolver extends ConflictResolver<TaskGroup> {
    
    simpleProperties: string[] = ["name", "dueDate", "projectId", "detached", "icon"];
    simpleArrayProperties: string[] = ["taskIds"];
    
    resolve(): ConflictResolutionResult<TaskGroup> {
        let a = this.first;
        let b = this.second;
        let aDiffs = a.diff(this.original);
        let bDiffs = b.diff(this.original);
        let abDiffs = b.diff(a);
        let resolvedObject: TaskGroup = new TaskGroup(JSON.parse(JSON.stringify(this.original)));
        
        if (abDiffs.length == 0) {
            return { status: ConflictResolutionStatus.IDENTICAL };
        }
        if (abDiffs.indexOf("id") >= 0) {
            return { status: ConflictResolutionStatus.DIFFERENT_OBJECT };
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
        
        return { status: ConflictResolutionStatus.RESOLVED, resolvedObject: resolvedObject };
    }
    
}
