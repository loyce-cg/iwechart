import * as Types from "../../Types";

export interface MergeStrategy {
    strategyType: "take-first" | "take-all" | "take-parts" | "custom-function";
}

export interface TakeFirstMergeStrategy extends MergeStrategy {
    strategyType: "take-first";
}

export interface TakeAllMergeStrategy extends MergeStrategy {
    strategyType: "take-all";
    separator: string;
}

export interface TakePartsMergeStrategy extends MergeStrategy {
    strategyType: "take-parts";
    icons: "take-first" | "take-all" | "take-none";
    texts: "take-first" | "take-all" | "take-none";
    iconsSeparator?: string;
    textsSeparator?: string;
}

export interface CustomFunctionMergeStrategy extends MergeStrategy {
    strategyType: "custom-function";
    functionName: string;
}

export interface CustomSelectOptions {
    items: Array<CustomSelectItem | CustomSelectSeparator>;
    multi?: boolean;
    editable?: boolean;
    size?: "small" | "normal";
    firstItemIsStandalone?: boolean;
    noSelectionItem?: CustomSelectItem;
    mergeStrategy?: MergeStrategy;
    scrollToFirstSelected?: boolean;
    gridColsCount?: number;
    actionHandler?: (actionId: string) => void;
    headerText?: string;
}

export interface CustomSelectItem {
    type: "item";
    value: string;
    text: string;
    icon: Types.webUtils.Icon;
    selected: boolean;
    extraClass?: string;
    extraStyle?: string;
    extraArg?: any;
    actionId?: string;
    textNoEscape?: boolean;
    extraAttributes?: { [key: string]: string };
    customTemplateName?: string;
}

export interface CustomSelectSeparator {
    type: "separator";
}

export interface Model {
    itemsStr: string;
    optionsStr: string;
    headerText: string;
}

export interface ItemModel<T extends CustomSelectItem | CustomSelectSeparator = CustomSelectItem> {
    item: T;
    multi?: boolean;
    extraClass?: string;
    extraStyle?: string;
    textNoEscape?: boolean;
}
