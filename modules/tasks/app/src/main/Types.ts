import { Project } from "./data/Project";
import { TaskGroup } from "./data/TaskGroup";
import { Task } from "./data/Task";
import * as Web from "pmc-web";

export type PersonId = string;
export type AttachmentId = string;
export type ProjectId = string;
export type TaskGroupId = string;
export type TaskId = string;
export type HostHash = string;
export enum StoredObjectTypes {
    tasksSection = "tasks-section",
    tasksList = "tasks-list",
    tasksTask = "tasks-task",
}

export interface WatchedTaskItem {
    id: string;
    sectionId: string;
    lastWatched: number;
}

export type WatchedTasksMap = {[taskId: string]: WatchedTaskItem};

export type TaskCommentTag = string;

export interface TaskComment {
    dateTime: number;
    message: string;
    userHashmail: string;
    body: CommentBody;
    relatedCommentTag?: string;
}

export interface CommentBody {
    type: "task-comment",
    who: string,
    id: string,
    label: string,
    comment: string,
    status: string,
    statusLocaleName: string,
    numOfStatuses: number,
    statusColor: string,
    metaDataStr: string
}

export interface TaskHistoryEntry {
    when: number;
    who: PersonId;
    what: "created"|"moved"|"modified"|"added"|"removed"|"trashed"|"restored";
    arg?: "name"|"description"|"type"|"status"|"priority"|"attachment"|"person"|"projectId"|"startTimestamp"|"duration"|"endTimestamp"|"wholeDays";
    oldVal?: string|number|Array<string>;
    newVal?: string|number|Array<string>;
}

export interface ProjectsMap {
    [projectId: string]: Project;
}

export interface TaskGroupsMap {
    [taskGroupId: string]: TaskGroup;
}

export interface TasksMap {
    [taskId: string]: Task;
}

export interface TaskGroupNamesMap {
    [taskGroupId: string]: string;
}

export interface Person {
    id: PersonId;
    name: string;
    avatar: string;
    isBasic: boolean;
    deleted?: boolean;
}

export interface PeopleMap {
    [personId: string]: Person;
}

export interface PeopleNamesMap {
    [personId: string]: string;
}


export interface SinkInfo {
    id: string;
    public: boolean;
}


export type Watchable = "project" | "taskGroup" | "task" | "*";

export type Action = "added" | "modified" | "deleted" | "*" | "section-changed";

export type EventHandler = (type: Watchable, id: string, action: Action) => void;



export enum ViewContext {
    Global = "global",
    TasksWindow = "tasks", // In tasks plugin
    SummaryWindow = "summary", // The window with chat, files and tasks side by side
}

//! calendar-plugin/app/src/main/Types.ts
export class CustomTasksElements {
    static ALL_TASKS_ID = "all-tasks";
    static TASKS_ASSIGNED_TO_ME_ID = "tasks-assigned-to-me";
    static TASKS_CREATED_BY_ME_ID = "tasks-created-by-me";
    static TRASH_ID = "trash";
    static ALL_TASKS_INC_TRASHED_ID = "all-tasks-inc-trashed";
}

export class FixedNames {
    static PRIVATE_SECTION_NAME = "<my>";
}

export class DefaultColWidths {
    static HASH_ID = 58;
    static STATUS = 70;
    static ASSIGNED_TO = 65;
    static ATTACHMENTS = 100;
    static CREATED = 110;
    static MODIFIED = 110;
}

export enum Filter {
    allTasks = "all-tasks",
    onlyUnread = "only-unread",
    onlyIdea = "only-idea",
    onlyTodo = "only-todo",
    onlyInProgress = "only-in-progress",
    onlyDone = "only-done",
    onlyNotDone = "only-not-done",
}

export interface TasksPluginLoadedEvent {
    type: "tasks-plugin-loaded";
}

export interface TaskGroupIcon {
    type: "shape" | "fa";
    color: string;
    shape?: never;
    fa?: string;
}

export interface TasksClipboardData {
    type: "__privmx_tasks__";
    fullTaskIds: string[];
    isCut: boolean;
}
