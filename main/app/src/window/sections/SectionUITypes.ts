import {section} from "../../Types";

export interface State {
    canAdd: boolean;
    sectionsLimitReached: boolean;
    isAdmin: boolean;
}

export interface Model {
    state: State;
    server: string;
    asCreator?: boolean;
}

export interface SectionEntry {
    id: section.SectionId;
    parentId: section.SectionId;
    name: string;
    scope: string;
    isRoot: boolean;
    enabled: boolean;
    visible: boolean;
    enabledModules?: string[];
    breadcrumb?: string;
}