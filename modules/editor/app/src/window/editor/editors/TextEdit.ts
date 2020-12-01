import {Editor, EditorOptions} from "./Editor";
import {JQuery as $, Types} from "pmc-web";
import {NotesPreferences} from "../../../main/EditorPlugin";

export interface State {
    $textarea: JQuery;
}

export class TextEdit extends Editor<State> {
    
    static clazz = "TextEdit";
    static mimetype = "text/plain";
    
    $textarea: JQuery;
    
    constructor(options: EditorOptions) {
        super(options);
    }
    
    initContainer(): void {
        this.$container = $('<div class="editor-inner text-editor-container"></div>');
    }
    
    standardizeNewline(str: string): string {
        return str.replace("\r\n", "\n").replace("\r", "\n");
    }
    
    createDataFromState(state: string): State {
        let text = state == null ? "" : this.standardizeNewline(state);
        let $textarea = $("<textarea>").addClass("form-control editor-textarea");
        $textarea.prop("defaultValue", text);
        this.bindTextareaEvents($textarea);
        this.$textarea = $textarea;
        this.updateTextareaEditable();
        return {
            $textarea: $textarea
        };
    }
    
    getState(): string {
        return this.standardizeNewline(<string>this.data.$textarea.val());
    }
    
    confirmSave(initState: string): void {
        super.confirmSave(initState);
        let text = <string>this.data.$textarea.val();
        this.data.$textarea.prop("defaultValue", text);
        this.triggerEvent("change", false);
    }
    
    render(): void {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.$textarea);
        }
    }
    
    isChanged(): boolean {
        return (this.initState == null ? null : this.standardizeNewline(this.initState)) != this.getState();
    }
    
    focus(): void {
        this.data.$textarea.focus();
    }
    
    setEditMode(editMode: boolean): void {
        this.editMode = editMode;
        this.updateTextareaEditable();
    }
    
    updateTextareaEditable(): void {
        if (this.$textarea) {
            this.$textarea.prop("readonly", !this.editMode);
        }
    }
    
    bindTextareaEvents($textarea: JQuery): void {
        $textarea.on("cut paste keydown", event => {
            let allowedSingleKeys = [
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
                113, // f2
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
            if (event.type == "keydown") {
                if (event.ctrlKey || event.metaKey) {
                    if (event.keyCode == 65 || event.keyCode == 67) {
                        return;
                    }
                }
                if (allowedSingleKeys.indexOf(event.keyCode) != -1) {
                    return;
                }
            }
            if (!this.editMode) {
                this.triggerEvent("editAttemptWhenNotEditable", event);
                return false;
            }
        });
        $textarea.on("keydown", event => {
            if (event.keyCode == 9 && this.editMode) {
                let textarea = <HTMLTextAreaElement>event.currentTarget;
                let $textarea = $(textarea);
                let start = textarea.selectionStart;
                let end = textarea.selectionEnd;
                let val = <string>$textarea.val();
                $textarea.val(val.substring(0, start) + "\t" + val.substring(end));
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                return false;
            }
        });
        $textarea.on("input", event => {
            let textarea = <HTMLTextAreaElement>event.currentTarget;
            this.triggerEvent("change", textarea.value != textarea.defaultValue);
        });
    }
}
