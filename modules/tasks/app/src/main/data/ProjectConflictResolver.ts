import * as Mail from "pmc-mail";
import { ConflictResolver, ConflictResolutionResult, ConflictResolutionStatus } from "./ConflictResolver";
import { Project } from "./Project";
let Logger = Mail.Logger.get("privfs-tasks-plugin.main.data.ProjectConflictResolver");

export class ProjectConflictResolver extends ConflictResolver<Project> {
    
    simpleProperties: string[] = ["name"];
    simpleArrayProperties: string[] = [
        "taskTypes", "taskStatuses", "taskPriorities", "taskGroupIds",
        "orphanedTaskIds", "pinnedTaskGroupIds"
    ];
    
    resolve(): ConflictResolutionResult<Project> {
        let a = this.first;
        let b = this.second;
        let aDiffs = a.diff(this.original);
        let bDiffs = b.diff(this.original);
        let abDiffs = b.diff(a);
        let resolvedObject: Project = new Project(JSON.parse(JSON.stringify(this.original)));
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
        
        // taskGroupsOrder
        if (this.tryResolveSimpleOrderedArrayPropertyConflict("taskGroupsOrder", resolvedObject, aDiffs, bDiffs, abDiffs) == ConflictResolutionStatus.UNRESOLVED) {
            return { status: ConflictResolutionStatus.UNRESOLVED };
        }
        
        return { status: ConflictResolutionStatus.RESOLVED, resolvedObject: resolvedObject };
    }
    
}
