import { DataObject } from "./DataObject";
import { ProjectId, TaskGroupId, TaskId } from "../Types";
import { Utils } from "../utils/Utils";
import { IconPickerData } from "../../component/iconPicker/IconPickerData";

export class TaskGroup extends DataObject {
    
    protected id: TaskGroupId;
    protected name: string;
    protected dueDate: string;
    protected taskIds: Array<TaskId>;
    protected projectId: ProjectId;
    protected detached: boolean;
    protected icon: string;
    // After adding new property: add to TaskGroupConflictResolver.ts, add to this.diff()
    
    constructor(obj: any = null) {
        super(obj);
        
        this.ensureFieldsAreArrays([
            "taskIds",
        ]);
    }
    
    // id
    getId(): TaskGroupId {
        return this.id;
    }
    setId(value: TaskGroupId): void {
        this.id = value;
    }
    
    // name
    getName(): string {
        return this.name;
    }
    setName(value: string): void {
        this.name = value;
    }
    
    // dueDate
    getDueDate(): string {
        return this.dueDate;
    }
    setDueDate(value: string): void {
        this.dueDate = value;
    }
    
    // taskIds
    getTaskIds(newArray: boolean = false): Array<TaskId> {
        return newArray ? this.taskIds.slice() : this.taskIds;
    }
    setTaskIds(value: Array<TaskId>): void {
        this.taskIds = value;
    }
    addTaskId(taskId: TaskId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.taskIds, taskId, ensureUnique);
    }
    removeTaskId(taskId: TaskId): boolean {
        return this.removeFromProperty(this.taskIds, taskId);
    }
    
    // projectId
    getProjectId(): ProjectId {
        return this.projectId;
    }
    setProjectId(value: ProjectId) {
        this.projectId = value;
    }
    
    // detached
    getDetached(): boolean {
        return this.detached;
    }
    setDetached(value: boolean): void {
        this.detached = value;
    }
    
    // icon
    getIcon(): string {
        if (this.icon) {
            if (typeof(this.icon) == "string") {
                if (this.icon.length > 0) {
                    let icon = JSON.parse(this.icon);
                    let str = "";
                    if (icon.type == "fa" || icon.type == "shape") {
                        if (icon.type == "fa") {
                            str = '{"type":"fa","fa":"' + icon.fa + '"}';
                        }
                        else if (icon.type == "shape") {
                            str = '{"type":"shape","fa":"' + icon.shape + '"}';
                        }
                        if (IconPickerData.items.indexOf(str) < 0 || IconPickerData.colors.indexOf(icon.color) < 0) {
                            this.icon = null;
                        }
                    }
                    else {
                        this.icon = null;
                    }
                }
            }
            else {
                this.icon = null;
            }
        }
        return this.icon;
    }
    setIcon(value: string): void {
        this.icon = value;
    }
    
    // Diff
    diff(other: TaskGroup): string[] {
        let diffs: string[] = [];
        
        if (this.getId() != other.getId()) {
            diffs.push("id");
        }
        if (this.getName() != other.getName()) {
            diffs.push("name");
        }
        if (this.getDueDate() != other.getDueDate()) {
            diffs.push("dueDate");
        }
        if (!Utils.arraysEqual(this.getTaskIds(), other.getTaskIds())) {
            diffs.push("taskIds");
        }
        if (this.getProjectId() != other.getProjectId()) {
            diffs.push("projectId");
        }
        if (this.getDetached() != other.getDetached()) {
            diffs.push("detached");
        }
        if (this.getIcon() != other.getIcon()) {
            diffs.push("icon");
        }
        
        return diffs;
    }
    
}
