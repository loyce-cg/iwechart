import { DataObject } from "./DataObject";
import { ProjectId, TaskGroupId, TaskId, TaskGroupsMap } from "../Types";
import { Utils } from "../utils/Utils";

export class Project extends DataObject {
    
    protected id: ProjectId;
    protected name: string;
    protected taskTypes: Array<string>;
    protected taskStatuses: Array<string>;
    protected taskPriorities: Array<string>;
    protected taskGroupIds: Array<TaskGroupId>;
    protected orphanedTaskIds: Array<TaskId>;
    protected taskGroupsOrder: Array<TaskGroupId>;
    protected pinnedTaskGroupIds: Array<TaskGroupId>;
    protected defaultViewMode: string;
    protected defaultIsKanban: boolean;
    protected defaultIsHorizontal: boolean;
    // After adding new property: add to ProjectConflictResolver.ts, add to this.diff()
    
    constructor(obj: any = null) {
        super(obj);
        
        this.ensureFieldsAreArrays([
            "taskTypes",
            "taskStatuses",
            "taskPriorities",
            "taskGroupIds",
            "orphanedTaskIds",
            "taskGroupsOrder",
            "pinnedTaskGroupIds",
        ]);
    }
    
    // id
    getId(): ProjectId {
        return this.id;
    }
    setId(value: ProjectId): void {
        this.id = value;
    }
    
    // name
    getName(): string {
        return this.name;
    }
    setName(value: string): void {
        this.name = value;
    }
    
    // taskTypes
    getTaskTypes(newArray: boolean = false, stripDefaultIndicator: boolean = false): Array<string> {
        return stripDefaultIndicator ? this._stripDefaultIndicator(this.taskTypes) : (newArray ? this.taskTypes.slice() : this.taskTypes);
    }
    setTaskTypes(value: Array<string>): void {
        this.taskTypes = value;
    }
	getDefaultTaskTypeId(): number {
		return this._getDefaultElementId(this.taskTypes);
	}
    
    // taskStatuses
    getTaskStatuses(newArray: boolean = false, stripDefaultIndicator: boolean = false): Array<string> {
        return stripDefaultIndicator ? this._stripDefaultIndicator(this.taskStatuses) : (newArray ? this.taskStatuses.slice() : this.taskStatuses);
    }
    setTaskStatuses(value: Array<string>): void {
        this.taskStatuses = value;
    }
	getDefaultTaskStatusId(): number {
		return this._getDefaultElementId(this.taskStatuses);
	}
    
    // taskPriorities
    getTaskPriorities(newArray: boolean = false, stripDefaultIndicator: boolean = false): Array<string> {
        return stripDefaultIndicator ? this._stripDefaultIndicator(this.taskPriorities) : (newArray ? this.taskPriorities.slice() : this.taskPriorities);
    }
    setTaskPriorities(value: Array<string>): void {
        this.taskPriorities = value;
    }
	getDefaultTaskPriorityId(): number {
		return this._getDefaultElementId(this.taskPriorities);
	}
    
    // taskGroupIds
    getTaskGroupIds(newArray: boolean = false): Array<TaskGroupId> {
        return newArray ? this.taskGroupIds.slice() : this.taskGroupIds;
    }
	setTaskGroupIds(value: Array<TaskGroupId>): void {
        this.taskGroupIds = value;
    }
	addTaskGroupId(taskGroupId: TaskGroupId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.taskGroupIds, taskGroupId, ensureUnique, true);
    }
    removeTaskGroupId(taskGroupId: TaskGroupId): boolean {
        return this.removeFromProperty(this.taskGroupIds, taskGroupId);
    }
    
    // orphanedTaskIds
    getOrphanedTaskIds(newArray: boolean = false): Array<TaskId> {
        return newArray ? this.orphanedTaskIds.slice() : this.orphanedTaskIds;
    }
	setOrphanedTaskIds(value: Array<TaskId>): void {
        this.orphanedTaskIds = value;
    }
	addOrphanedTasksId(orphanedTaskId: TaskId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.orphanedTaskIds, orphanedTaskId, ensureUnique);
    }
    removeOrphanedTasksId(orphanedTaskId: TaskId): boolean {
        return this.removeFromProperty(this.orphanedTaskIds, orphanedTaskId);
    }
    
    // taskGroupsOrder
    getTaskGroupsOrder(newArray: boolean = false): Array<TaskGroupId> {
        return newArray ? this.taskGroupsOrder.slice() : this.taskGroupsOrder;
    }
	setTaskGroupsOrder(value: Array<TaskGroupId>): void {
        this.taskGroupsOrder = value;
    }
	addTaskGroupsOrder(taskGroupId: TaskGroupId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.taskGroupsOrder, taskGroupId, ensureUnique, true);
    }
    removeTaskGroupsOrder(taskGroupId: TaskGroupId): boolean {
        return this.removeFromProperty(this.taskGroupsOrder, taskGroupId);
    }
    
    // pinnedTaskGroupIds
    getPinnedTaskGroupIds(newArray: boolean = false): Array<TaskGroupId> {
        return newArray ? this.pinnedTaskGroupIds.slice() : this.pinnedTaskGroupIds;
    }
	setPinnedTaskGroupIds(value: Array<TaskGroupId>): void {
        this.pinnedTaskGroupIds = value;
    }
	addPinnedTaskGroupId(taskGroupId: TaskGroupId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.pinnedTaskGroupIds, taskGroupId, ensureUnique, true);
    }
    removePinnedTaskGroupId(taskGroupId: TaskGroupId): boolean {
        return this.removeFromProperty(this.pinnedTaskGroupIds, taskGroupId);
    }
    
    // defaultViewMode
    getDefaultViewMode(): string {
        return this.defaultViewMode;
    }
    setDefaultViewMode(value: string): void {
        this.defaultViewMode = value;
    }
    
    // defaultIsKanban
    getDefaultIsKanban(): boolean {
        return this.defaultIsKanban;
    }
    setDefaultIsKanban(value: boolean): void {
        this.defaultIsKanban = value;
    }
    
    // defaultIsHorizontal
    getDefaultIsHorizontal(): boolean {
        return this.defaultIsHorizontal;
    }
    setDefaultIsHorizontal(value: boolean): void {
        this.defaultIsHorizontal = value;
    }
    
    
    
    syncTaskGroupsIdsOrder(taskGroups: TaskGroupsMap) {
        let idsToShow = this.taskGroupIds;
        let idsOrdered = this.taskGroupsOrder;
        let newIds: Array<TaskGroupId> = [];
        let detached: Array<TaskGroupId> = [];
        
        for (let k of idsToShow) {
            if (idsOrdered.indexOf(k) < 0) {
                newIds.push(k);
            }
        }
        for (let k of idsOrdered) {
            if (idsToShow.indexOf(k) >= 0 || k == "__orphans__") {
                if (taskGroups[k] && taskGroups[k].getDetached()) {
                    detached.push(k);
                }
                else {
                    newIds.push(k);
                }
            }
        }
        for (let k of detached) {
            newIds.push(k);
        }
        
        this.taskGroupIds = JSON.parse(JSON.stringify(newIds));
        
        if (newIds.indexOf("__orphans__") < 0) {
            newIds.push("__orphans__");
        }
        this.taskGroupsOrder = JSON.parse(JSON.stringify(newIds));
    }
    
    
    
	protected _getDefaultElementId(list: Array<string>): number {
		let idx = 0;
		for (let el of list) {
			if (el.length > 2 && el[0] == "[" && el[el.length - 1] == "]") {
				return idx;
			}
			++idx;
		}
		return 0;
    }
    
    protected _stripDefaultIndicator(list: Array<string>): Array<string> {
        let newList: Array<string> = [];
		for (let el of list) {
			if (el.length > 2 && el[0] == "[" && el[el.length - 1] == "]") {
				newList.push(el.substr(1, el.length - 2));
            }
            else {
                newList.push(el);
            }
        }
        return newList;
    }
    
    toJSON(): any {
        let res: any = {};
        for (let k in this) {
			if (k.length > 0 && k[0] == "_" && k != "__version__") {
                // Ignore
            }
            else {
                res[k] = this[k];
            }
        }
        return res;
    }
    
    // Diff
    diff(other: Project): string[] {
        let diffs: string[] = [];
        
        if (this.getId() != other.getId()) {
            diffs.push("id");
        }
        if (this.getName() != other.getName()) {
            diffs.push("name");
        }
        if (!Utils.arraysEqual(this.getTaskTypes(), other.getTaskTypes())) {
            diffs.push("taskTypes");
        }
        if (!Utils.arraysEqual(this.getTaskStatuses(), other.getTaskStatuses())) {
            diffs.push("taskStatuses");
        }
        if (!Utils.arraysEqual(this.getTaskPriorities(), other.getTaskPriorities())) {
            diffs.push("taskPriorities");
        }
        if (!Utils.arraysEqual(this.getTaskGroupIds(), other.getTaskGroupIds())) {
            diffs.push("taskGroupIds");
        }
        if (!Utils.arraysEqual(this.getOrphanedTaskIds(), other.getOrphanedTaskIds())) {
            diffs.push("orphanedTaskIds");
        }
        if (!Utils.orderedArraysEqual(this.getTaskGroupsOrder(), other.getTaskGroupsOrder())) {
            diffs.push("taskGroupsOrder");
        }
        if (!Utils.arraysEqual(this.getPinnedTaskGroupIds(), other.getPinnedTaskGroupIds())) {
            diffs.push("pinnedTaskGroupIds");
        }
        
        return diffs;
    }
}
