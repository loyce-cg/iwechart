export enum ConflictType {
    FILE_OVERWRITE,
    DIRECTORIES_MERGE,
    DIRECTORY_OVERWRITE_BY_FILE,
    FILE_OVERWRITE_BY_DIRECTORY
}
export enum OperationType {
    MOVE,
    COPY,
    REMOVE
}
export class FilesConst {
    static TRASH_ENTRY: string = ".trash";
    static TRASH_PATH: string = "/" + FilesConst.TRASH_ENTRY;
}

export type ViewMode = "table" | "tiles";

export interface WatchedFileItem {
    id: string;
    sectionId: string;
    lastWatched: number;
}

export type WatchedFilesMap = {[fileId: string]: WatchedFileItem};

export enum ViewContext {
    Global = "global",
    Notes2Window = "notes2", // In notes2 plugin
    SummaryWindow = "summary", // The window with chat, files and notes2 side by side
    FileChooser = "filechooser"
}

export enum SelectionChangeMode {
    CHANGE,
    EXTEND,
    SHRINK,
}
