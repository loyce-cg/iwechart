import {EditorOptions} from "./Editor";
import {StyledEditor, DataWithStyle} from "./StyledEditor";
import {NotesPreferences} from "../../../main/EditorPlugin";
import {Types} from "pmc-web";

export class JsonEditor<T extends DataWithStyle, U> extends StyledEditor<T> {
    
    static clazz = "JsonEditor";
    
    constructor(options: EditorOptions) {
        super(options);
    }
    
    createDataFromState(state: string): T {
        return this.createDataFromObject(state == "" ? null : JSON.parse(state));
    }
    
    getState(): string {
        return JSON.stringify(this.getObjectState());
    }
    
    createDataFromObject(object: U): T {
        throw new Error("Unimplemented");
    }
    
    getObjectState(): U {
        throw new Error("Unimplemented");
    }
}
