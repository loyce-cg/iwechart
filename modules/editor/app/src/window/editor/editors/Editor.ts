import {JQuery as $, Types} from "pmc-web";
import {app} from "pmc-mail";
import {NotesPreferences} from "../../../main/EditorPlugin";

export interface EditorOptions {
    parent: Types.app.ViewParent;
    initState: string;
    editMode: boolean;
    newFile: boolean;
    preferences: NotesPreferences;
    previewMode: boolean;
    taskStatuses?: { [taskId: string]: string };
}

export class Editor<T> {
    
    static clazz = "Editor";
    
    parent: Types.app.ViewParent;
    editMode: boolean;
    previewMode: boolean;
    newFile: boolean;
    preferences: NotesPreferences;
    listeners: {[name: string]: Function[]};
    $body: JQuery;
    initState: string;
    $container: JQuery;
    rendered: boolean;
    data: T;
    taskStatuses: { [taskId: string]: string };
    relatedHostHash: string = null;
    relatedSectionId: string = null;
    
    constructor(options: EditorOptions) {
        this.parent = options.parent;
        this.editMode = options.editMode;
        this.newFile = options.newFile;
        this.preferences = options.preferences || {};
        this.previewMode = options.previewMode;
        this.taskStatuses = options.taskStatuses;
        this.listeners = {};
        this.$body = $("body");
        this.setCurrentState(options.initState);
        this.initState = this.getState();
    }
    
    initContainer(): void {
        this.$container = $("<div class='editor-inner'></div>");
    }
    
    createDataFromState(_state: string): T {
        throw new Error("Unimplemented");
    }
    
    paste(_data: app.common.clipboard.ClipboardData): void {
    }
    
    beforeSave(): void {
    }
    
    getState(): string {
        throw new Error("Unimplemented");
    }
    
    getElements() {
        throw new Error("Unimplemented");
    }
        
    render(): void {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append("<div>" + this.data + "</div>");
        }
    }
    
    attach($container: JQuery): void {
        this.render();
        $container.append(this.$container);
    }
    
    detach(): void {
        this.$container.detach();
    }
    
    focus(): void {
    }
    
    isChanged(): boolean {
        return this.initState != this.getState();
    }
    
    setEditMode(editMode: boolean): void {
        this.editMode = editMode;
    }
    
    confirmSave(initState: string): void {
        this.initState = initState;
        this.triggerEvent("change", false);
    }
    
    setCurrentState(state: string): void {
        this.data = this.createDataFromState(state);
        if (this.rendered) {
            let $oldContainer = this.$container;
            this.initContainer();
            this.rendered = false;
            this.render();
            $oldContainer.replaceWith(this.$container);
        }
        else {
            this.initContainer();
            this.rendered = false;
        }
        this.triggerEvent("change", false);
    }
    
    backToInitState(): void {
        this.setCurrentState(this.initState);
    }
    
    addEventListener(eventName: string, callback: Function): void {
        if (typeof(callback) != "function") {
            throw new Error("Callback is not a function");
        }
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }
    
    triggerEvent(eventName: string, data?: any): void {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => {
                callback(data);
            });
        }
    }
    
    getCustomToolbarMenuHtml(): string {
        return "";
    }

    getCustomToolbarRightSideMenuHtml(): string {
        return "";
    }
    
    updateLayout(): void {
    }
    
    updateTaskBadges(): void {
    }

}
