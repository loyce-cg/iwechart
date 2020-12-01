import { DataObject } from "./DataObject";
import { AttachmentId, PersonId, TaskHistoryEntry, TaskId, TaskGroupId, ProjectId, TaskCommentTag, WatchedTasksMap, TaskComment } from "../Types";
import { Utils } from "../utils/Utils";
import { SearchFilter } from "../SearchFilter";

export enum TaskStatus {
    UNKNOWN = "unknown",
    TODO = "todo",
    INPROGRESS = "inprogress",
    DONE = "done",
    IDEA = "idea",
}

export class Task extends DataObject {
    
    protected id: TaskId;
    protected name: string;
    protected description: string;
    protected type: number;
    protected status: number;
    protected status2: TaskStatus;
    protected priority: number;
    protected attachments: Array<AttachmentId>;
    protected assignedTo: Array<PersonId>;
    protected history: Array<TaskHistoryEntry>;
    protected taskGroupIds: Array<TaskGroupId>;
    protected projectId: ProjectId;
    protected createdBy: PersonId;
    protected createdDateTime: number;
    protected modifiedBy: PersonId;
    protected modifiedDateTime: number;
    protected commentTags: Array<TaskCommentTag>;
    protected pinnedInTaskGroupIds: Array<TaskGroupId>;
    protected _cachedSearchString: string = null;
    protected preDetachTaskGroupIds: Array<TaskGroupId>;
    protected isTrashed: boolean;
    protected startTimestamp: number;
    protected endTimestamp: number;
    protected wholeDays: boolean;
    protected comments: string;
    // After adding new property: add to TaskConflictResolver.ts, add to this.diff()
    
    constructor(obj: any = null) {
        super(obj);
        
        this.ensureFieldsAreArrays([
            "attachments",
            "assignedTo",
            "history",
            "taskGroupIds",
            "commentTags",
            "pinnedInTaskGroupIds",
        ]);
        
        if (this.duration) {
            if (this.startTimestamp && !this.endTimestamp) {
                this.endTimestamp = this.startTimestamp + this.duration;
            }
            delete this.duration;
        }
        else if (this.startTimestamp && !this.endTimestamp) {
            this.endTimestamp = this.startTimestamp + 3600000;
            this.wholeDays = true;
        }
    }
    
    // id
    getId(): TaskId {
        return this.id;
    }
    setId(value: TaskId): void {
        this.id = value;
    }
    
    // name
    getName(): string {
        return this.name;
    }
    setName(value: string): void {
        this.name = value;
    }
    
    // description
    getDescription(): string {
        return this.description;
    }
    setDescription(value: string): void {
        value = value.replace(/\n/g, " ");
        this.setName(value.split("<br>")[0].trim());
        this.description = value;
        this._cachedSearchString = null;
    }
    
    // type
    getType(): number {
        return this.type;
    }
    setType(value: number): void {
        this.type = value;
    }
    
    // status
    getStatus(): TaskStatus {
        if (!this.status2) {
            let newDataVersion = this.__data_version__ > 1;
            this.status2 = Task.convertStatus(this.status, newDataVersion);
        }
        return this.status2;
    }
    setStatus(value: TaskStatus): void {
        this.status = 0;
        this.status2 = value;
    }
    
    // priority
    getPriority(): number {
        return this.priority;
    }
    setPriority(value: number): void {
        this.priority = value;
    }
    
    // assigned to
    getAssignedTo(newArray: boolean = false): Array<PersonId> {
        return newArray ? this.assignedTo.slice() : this.assignedTo;
    }
    setAssignedTo(value: Array<PersonId>): void {
        this.assignedTo = value;
    }
    addAssignedTo(person: PersonId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.assignedTo, person, ensureUnique);
    }
    removeAssignedTo(person: PersonId): boolean {
        return this.removeFromProperty(this.assignedTo, person);
    }
    isAssignedTo(person: PersonId): boolean {
        return this.assignedTo.indexOf(person) >= 0;
    }
    
    // attachments
    getAttachments(newArray: boolean = false): Array<AttachmentId> {
        return newArray ? this.attachments.slice() : this.attachments;
    }
    setAttachments(value: Array<AttachmentId>): void {
        this.attachments = value;
    }
    addAttachment(attachment: AttachmentId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.attachments, attachment, ensureUnique);
    }
    removeAttachment(attachment: AttachmentId): boolean {
        return this.removeFromProperty(this.attachments, attachment);
    }
    
    // history
    getHistory(newArray: boolean = false): Array<TaskHistoryEntry> {
        return newArray ? this.history.slice() : this.history;
    }
    setHistory(value: Array<TaskHistoryEntry>): void {
        this.history = value;
    }
    
    addHistory(historyEntry: TaskHistoryEntry, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.history, historyEntry, ensureUnique);
    }
    
    // taskGroupIds
    getTaskGroupIds(newArray: boolean = false): Array<TaskGroupId> {
        return newArray ? this.taskGroupIds.slice() : this.taskGroupIds;
    }
    setTaskGroupIds(value: Array<TaskGroupId>): void {
        this.taskGroupIds = value;
    }
    addTaskGroupId(taskGroupId: TaskGroupId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.taskGroupIds, taskGroupId, ensureUnique);
    }
    removeTaskGroupId(taskGroupId: TaskGroupId): boolean {
        return this.removeFromProperty(this.taskGroupIds, taskGroupId);
    }
    
    // projectId
    getProjectId(): ProjectId {
        return this.projectId;
    }
    setProjectId(value: ProjectId) {
        this.projectId = value;
    }
    
    // createdBy
    getCreatedBy(): PersonId {
        return this.createdBy;
    }
    setCreatedBy(value: PersonId) {
        this.createdBy = value;
    }
    
    // createdDateTime
    getCreatedDateTime(): number {
        return this.createdDateTime;
    }
    setCreatedDateTime(value: number) {
        this.createdDateTime = value;
    }
    
    // modifiedBy
    getModifiedBy(): PersonId {
        return this.modifiedBy;
    }
    setModifiedBy(value: PersonId) {
        this.modifiedBy = value;
    }
    
    // modifiedDateTime
    getModifiedDateTime(): number {
        return this.modifiedDateTime;
    }
    setModifiedDateTime(value: number) {
        this.modifiedDateTime = value;
    }
    
    // commentTags
    getCommentTags(newArray: boolean = false): Array<TaskCommentTag> {
        return newArray ? this.commentTags.slice() : this.commentTags;
    }
    setCommentTags(value: Array<TaskCommentTag>): void {
        this.commentTags = value;
    }

    getComments(): Array<TaskComment> {
        let deserialized: TaskComment[] = [];
        try {
            deserialized = <TaskComment[]>JSON.parse(this.comments);
        }
        catch(e) {}
        return deserialized;
    }

    setComments(comments: Array<TaskComment>): void {
        this.comments = JSON.stringify(comments);
    }

    addCommentTag(taskCommentTag: TaskCommentTag, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.commentTags, taskCommentTag, ensureUnique);
    }
    removeCommentTag(taskCommentTag: TaskCommentTag): boolean {
        return this.removeFromProperty(this.commentTags, taskCommentTag);
    }
    
    // pinnedInTaskGroupIds
    getPinnedInTaskGroupIds(newArray: boolean = false): Array<TaskGroupId> {
        return newArray ? this.pinnedInTaskGroupIds.slice() : this.pinnedInTaskGroupIds;
    }
	setPinnedInTaskGroupIds(value: Array<TaskGroupId>): void {
        this.pinnedInTaskGroupIds = value;
    }
	addPinnedInTaskGroupId(taskGroupId: TaskGroupId, ensureUnique: boolean = false): boolean {
        return this.addToProperty(this.pinnedInTaskGroupIds, taskGroupId, ensureUnique, true);
    }
    removePinnedInTaskGroupId(taskGroupId: TaskGroupId): boolean {
        return this.removeFromProperty(this.pinnedInTaskGroupIds, taskGroupId);
    }
    
    // cachedSearchString
    getCachedSearchString(): string {
        if (this._cachedSearchString === null) {
            let description = this.description;
            let preparedDescription = SearchFilter.prepareHaystack(description);
            this._cachedSearchString = preparedDescription.replace(/<(?:.|\n)*?>/gm, '');
        }
        return this._cachedSearchString;
    }
    
    // preDetachTaskGroupIds
    getPreDetachTaskGroupIds(newArray: boolean = false): Array<TaskGroupId> {
        return newArray ? this.preDetachTaskGroupIds.slice() : this.preDetachTaskGroupIds;
    }
    setPreDetachTaskGroupIds(value: Array<TaskGroupId>): void {
        this.preDetachTaskGroupIds = value;
    }
    
    // isTrashed
    getIsTrashed(): boolean {
        return typeof(this.isTrashed) == "undefined" ? false : this.isTrashed;
    }
    setIsTrashed(value: boolean): void {
        this.isTrashed = value;
    }
    
    // metaDataStr
    getMetaDataStr(): string {
        return typeof(this.metaDataStr) == "undefined" ? null : this.metaDataStr;
    }
    setMetaDataStr(value: string): void {
        this.metaDataStr = value;
    }

    // Label color
    getLabelClass(): string {
        return Task.getLabelClass(this.getStatus());
    }
    
    static getLabelClass(status: TaskStatus): string {
        return "task-status-" + status;
    }
    
    static getDefaultStatus(): TaskStatus {
        return TaskStatus.TODO;
    }
    
    static getStatusText(status: TaskStatus): string {
        if (status == TaskStatus.UNKNOWN) {
            return "unknown";
        }
        else if (status == TaskStatus.TODO) {
            return "Todo";
        }
        else if (status == TaskStatus.INPROGRESS) {
            return "In progress";
        }
        else if (status == TaskStatus.DONE) {
            return "Done";
        }
        else if (status == TaskStatus.IDEA) {
            return "Idea";
        }
    }
    
    static convertStatus(old: number, newDataVersion: boolean): TaskStatus {
        if (newDataVersion) {
            if (old == 0 || old == 1) {
                return TaskStatus.TODO;
            }
            else if (old == 2) {
                return TaskStatus.INPROGRESS;
            }
            else if (old == 3) {
                return TaskStatus.DONE;
            }
        }
        else {
            if (old == 0) {
                return TaskStatus.TODO;
            }
            else if (old == 1) {
                return TaskStatus.INPROGRESS;
            }
            else if (old == 2) {
                return TaskStatus.DONE;
            }
        }
        return TaskStatus.UNKNOWN;
    }
    
    static getStatuses(): TaskStatus[] {
        return [
            TaskStatus.IDEA,
            TaskStatus.TODO,
            TaskStatus.INPROGRESS,
            TaskStatus.DONE,
        ];
    }
    
    static prepareHaystack(str: string): string {
        return SearchFilter.prepareHaystack(str);
    }
    
    // Unread status
    wasUnread(sectionId: string, watchedTasksHistory: {[sectionId: string]: WatchedTasksMap}, myId: string): boolean {
        let unread: boolean = false;
        let inHistory = watchedTasksHistory[sectionId] ? watchedTasksHistory[sectionId][this.getId()] : null;
        let taskHistory = this.getHistory();
        let last = taskHistory[taskHistory.length - 1];
        let modifier = last.when > this.getModifiedDateTime() ? last.who : this.getModifiedBy();
        if (modifier != myId) {
            if (! inHistory || inHistory.lastWatched < this.getModifiedDateTime()) {
                unread = (sectionId && sectionId == this.getProjectId()) || sectionId == null;
            }
        }
        return unread;
    }
    
    // startTimestamp
    getStartTimestamp(): number {
        return this.startTimestamp;
    }
    setStartTimestamp(value: number): void {
        this.startTimestamp = value;
    }
    
    // endTimestamp
    getEndTimestamp(): number {
        return this.endTimestamp;
    }
    setEndTimestamp(value: number): void {
        this.endTimestamp = value;
    }
    
    // wholeDays
    getWholeDays(): boolean {
        return this.wholeDays;
    }
    setWholeDays(value: boolean): void {
        this.wholeDays = value;
    }
    
    matchesSearchString(searchStr: string): boolean {
        return Task.matchesSearchString(this.id, this.getCachedSearchString(), searchStr);
    }
    
    static matchesSearchString(taskId: string, cachedSearchString: string, searchStr: string): boolean {
        if (searchStr.length > 0 && searchStr[0] == "#") {
            return taskId.indexOf(searchStr.substr(1)) == 0;
        }
        return cachedSearchString.indexOf(searchStr) >= 0;
    }
    
    // Diff
    diff(other: Task): string[] {
        let diffs: string[] = [];
        
        if (this.getId() != other.getId()) {
            diffs.push("id");
        }
        if (this.getName() != other.getName()) {
            diffs.push("name");
        }
        if (this.getDescription() != other.getDescription()) {
            diffs.push("description");
        }
        if (this.getType() != other.getType()) {
            diffs.push("type");
        }
        if (this.getStatus() != other.getStatus()) {
            diffs.push("status");
        }
        if (this.getPriority() != other.getPriority()) {
            diffs.push("priority");
        }
        if (!Utils.arraysEqual(this.getAttachments(), other.getAttachments())) {
            diffs.push("attachments");
        }
        if (!Utils.arraysEqual(this.getAssignedTo(), other.getAssignedTo())) {
            diffs.push("assignedTo");
        }
        if (!Utils.arraysEqual(this.getHistory(), other.getHistory(), (a, b) => a.when == b.when && a.who == b.who)) {
            diffs.push("history");
        }
        if (!Utils.arraysEqual(this.getTaskGroupIds(), other.getTaskGroupIds())) {
            diffs.push("taskGroupIds");
        }
        if (this.getProjectId() != other.getProjectId()) {
            diffs.push("projectId");
        }
        if (this.getCreatedBy() != other.getCreatedBy()) {
            diffs.push("createdBy");
        }
        if (this.getCreatedDateTime() != other.getCreatedDateTime()) {
            diffs.push("createdDateTime");
        }
        if (this.getModifiedBy() != other.getModifiedBy()) {
            diffs.push("modifiedBy");
        }
        if (this.getModifiedDateTime() != other.getModifiedDateTime()) {
            diffs.push("modifiedDateTime");
        }
        if (!Utils.arraysEqual(this.getCommentTags(), other.getCommentTags())) {
            diffs.push("commentTags");
        }
        if (this.getIsTrashed() != other.getIsTrashed()) {
            diffs.push("isTrashed");
        }
        if (this.getStartTimestamp() != other.getStartTimestamp()) {
            diffs.push("startTimestamp");
        }
        if (this.getEndTimestamp() != other.getEndTimestamp()) {
            diffs.push("endTimestamp");
        }
        if (this.getWholeDays() != other.getWholeDays()) {
            diffs.push("wholeDays");
        }
        if (this.getComments() != other.getComments()) {
            diffs.push("comments");
        }
        
        return diffs;
    }
    
}
