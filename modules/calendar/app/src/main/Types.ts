export enum ViewContext {
    Global = "global",
    CalendarWindow = "calendar", // In calendar plugin
    SummaryWindow = "summary", // The window with chat, files and tasks side by side
}

//! tasks-plugin/app/src/main/Types.ts
export class CustomTasksElements {
    static ALL_TASKS_ID = "all-tasks";
    static TASKS_ASSIGNED_TO_ME_ID = "tasks-assigned-to-me";
    static TASKS_CREATED_BY_ME_ID = "tasks-created-by-me";
    static TRASH_ID = "trash";
}

export class Modes {
    static MONTH = "month";
    static WEEK = "week";
    static SINGLE_WEEK = "singleweek";
    static SINGLE_DAY = "singleday";
}

export enum Filter {
    allTasks = "all-tasks",
    onlyIdea = "only-idea",
    onlyTodo = "only-todo",
    onlyInProgress = "only-in-progress",
    onlyDone = "only-done",
    onlyNotDone = "only-not-done",
}

export enum TaskStatus {
    UNKNOWN = "unknown",
    TODO = "todo",
    INPROGRESS = "inprogress",
    DONE = "done",
    IDEA = "idea",
}

export enum SortFilesBy {
    CREATED = "created",
    MODIFIED = "modified",
}
