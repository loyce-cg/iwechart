import {Editor, EditorOptions} from "./Editor";
import simplitoSpreadsheet = require("simplito-spreadsheet");
import SimSpreadsheet = simplitoSpreadsheet.com.simplito.spreadsheet.Spreadsheet;
import {JQuery as $, Types} from "pmc-web";
import {NotesPreferences} from "../../../main/EditorPlugin";

export class Spreadsheet extends Editor<SimSpreadsheet> {
    
    static clazz = "Spreadsheet";
    static mimetype = "application/x-sss";
    
    constructor(options: EditorOptions) {
        super(options);
    }
    
    generateDefaultData() {
        return Spreadsheet.prototype.fromJson({cells: []});
    }
    
    toJson(): any {
        return this.data.saveData();
    }
    
    fromJson(data: any): SimSpreadsheet {
        let spreadsheet = new SimSpreadsheet(7, 15);
        if (typeof(data) == "object" && data.cells != null) {
            spreadsheet.loadData(data);
        }
        return spreadsheet;
    }
    
    render(): void {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.$element);
        }
    }
    
    focus(): void {
        this.data.$table.focus();
    }
}
