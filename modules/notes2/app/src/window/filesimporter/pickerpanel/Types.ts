
export interface SectionEntry {
    getName(): string;
    getId(): string;
    isRoot(): boolean;
    isVisible(): boolean;
    getBreadcrumb(): string;
    getScope(): string;
    isEnabled(): boolean;
    getDescription(): string;
    isPrimary(): boolean;
}

export interface SectionEntryModel {
    name: string;
    id: string;
    isRoot: boolean;
    visible: boolean;
    breadcrumb: string;
    scope: string;
    enabled: boolean;
    primary: boolean;
    description: string;
}

export interface FileEntry {
    getFileType(): string;
    getId(): string;
    getPath(): string;
    getIcon(): string;
    getIsParentDir(): boolean;
    getModificationDate(): number;
    getName(): string;
    getSize(): number;
    getBasePath(): string;
    isHidden(): boolean;
}


export interface FileEntryModel {
    fileType: string;
    id: string;
    path: string;
    icon: string;
    isParentDir: boolean;
    modificationDate: number;
    name: string;
    size: number;
    basePath: string;
    hidden: boolean;
}

export interface ItemEvent {
    id: string;
    basePath: string;
}
export interface AddItemEvent extends ItemEvent {
    type: "add-item";
}

export interface RemoveItemEvent extends ItemEvent {
    type: "remove-item";
}