import {EditorOptions} from "./Editor";
import {JsonEditor} from "./JsonEditor";
import {Style} from "./StyledEditor";
import {JQuery as $, webUtils, Types} from "pmc-web";
import {NotesPreferences} from "../../../main/EditorPlugin";
import { component } from "pmc-web";

export interface Raw {
    content: string;
    style: Style;
    metaDataStr?: string;
}

export interface State {
    editor: webUtils.ContentEditableEditor;
    style: Style;
    metaDataStr?: string;
}

export class HtmlEdit extends JsonEditor<State, Raw> {
    
    static clazz = "HtmlEdit";
    static mimetype = "application/x-stt";
    
    constructor(options: EditorOptions) {
        super(options);
    }
    
    initContainer(): void {
        this.$container = $('<div class="editor-inner html-editor-container"></div>');
        this.initStyle();
    }
    
    sanitize(str: string): string {
        str = str.replace(/(\r\n|\r|\n)/g, "<br>");
        return webUtils.ContentEditableEditor.safeHtml(str, undefined, this.taskStatuses, true);
    }
    
    createDataFromState(state: string): State {
        let data: Raw = state ? JSON.parse(state) : {};
        let text = data.content;
        data.style = {
            name: data.style && data.style.name && data.style.name in component.mindmap.Mindmap.AVAILABLE_STYLES ? data.style.name : component.mindmap.Mindmap.DEFAULT_STYLE_NAME,
            fontSize: data.style && data.style.fontSize && data.style.fontSize in component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? data.style.fontSize : component.mindmap.Mindmap.DEFAULT_FONT_SIZE,
            margin: data.style && data.style.margin && data.style.margin in component.mindmap.Mindmap.AVAILABLE_MARGINS ? data.style.margin : component.mindmap.Mindmap.DEFAULT_MARGIN,
        };
        let metaData = webUtils.ContentEditableEditorMetaData.fromString(data.metaDataStr);
        text = metaData.attach(text);
        text = text ? this.sanitize(text) : "";
        let $elem = $("<div>").addClass("editor-textarea html-editor");
        let editor = new webUtils.ContentEditableEditor($elem, {
            onKeyDown: this.inputEventsHandler.bind(this),
            onPaste: this.inputEventsHandler.bind(this),
            onCut: this.inputEventsHandler.bind(this),
            onInput: this.inputEventsHandler.bind(this),
            onRequestTaskPicker: (...args: any[]) => {
                (<any>this.parent).onTaskPickerResult(editor.onTaskPickerResult.bind(editor));
                return (<any>this.parent).onRequestTaskPicker(...args);
            },
            onRequestFilePicker: (...args: any[]) => {
                (<any>this.parent).onFilePickerResult(editor.onFilePickerResult.bind(editor));
                return (<any>this.parent).onRequestFilePicker(...args);
            },
            relatedHostHash: () => this.relatedHostHash,
            relatedSectionId: () => this.relatedSectionId,
        });
        editor.setValue(text, true, this.editMode);
        editor.meta = metaData;
        return {
            editor: editor,
            style: data.style,
            metaDataStr: data.metaDataStr,
        };
    }
    
    getObjectState(): Raw {
        let str = this.data.editor.getValue();
        let { metaData, html } = webUtils.ContentEditableEditorMetaData.extractMetaFromHtml(str);
        return {
            content: html,
            style: this.data.style,
            metaDataStr: JSON.stringify(metaData),
        };
    }
    
    confirmSave(initState: string): void {
        super.confirmSave(initState);
        this.data.editor.setCurrentValueAsDefault();
        this.triggerEvent("change", false);
    }
    
    render(): void {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.editor.$elem);
        }
    }
    
    focus(): void {
        if (this.data && this.data.editor) {
            this.data.editor.focus();
        }
    }
    
    inputEventsHandler(event: KeyboardEvent): boolean {
        switch (event.type) {
            case "input":
                this.triggerEvent("change", this.isChanged());
                break;
            case "keydown":
                if (event.ctrlKey || event.metaKey) {
                    if (event.keyCode == 65 || event.keyCode == 67) {
                        return;
                    }
                }
                if (ALLOWED_SINGLE_KEYS.indexOf(event.keyCode) != -1) {
                    return;
                }
            case "cut":
            case "paste":
                if (!this.editMode) {
                    this.triggerEvent("editAttemptWhenNotEditable", {event: event});
                    return false;
                }
            break;
        }
        switch (event.type) {
            case "input":
                this.data.editor.onInput(event);
                break;
            case "paste":
                this.data.editor.onPaste(event);
                break;
            case "cut":
                this.data.editor.onCut(event);
                break;
            case "keydown":
                this.data.editor.onKeyDown(event);
                break;
        }
        this.triggerEvent("change", this.isChanged());
    }
    
    updateTaskBadges(): void {
        this.data.editor.setValue(this.data.editor.getValue());
    }
    
}

let ALLOWED_SINGLE_KEYS = [
    16, // shift
    17, // ctrl
    18, // alt
    19, // pause
    20, // capslock
    27, // escape
    33, // pageup
    34, // pagedown
    35, // end,
    36, // home
    37, // left
    38, // up
    39, // right
    40, // down
    44, // printscreen,
    93, // contextmenu
    112, // f1
    114, // f3
    115, // f4
    116, // f5
    117, // f6
    118, // f7
    119, // f8
    120, // f9
    121, // f10
    122, // f11
    123, // f12,
    144, // numlock
    145, // scrolllock
];
