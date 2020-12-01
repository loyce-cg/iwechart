import {BaseView} from "../BaseView";
import {InitDataEditor} from "./InitDataEditor";
import {AdminWindowView} from "../AdminWindowView";
import * as privfs from "privfs-client";

export class InitDataView extends BaseView<privfs.types.core.FullInitData> {
    
    initDataEditor: InitDataEditor;
    
    constructor(parent: AdminWindowView) {
        super(parent, null);
        this.menuModel = {
            id: "initdata",
            priority: 200,
            groupId: "misc",
            icon: "handshake-o",
            labelKey: "window.admin.menu.initdata"
        };
    }
    
    initTab(): void {
        this.initDataEditor = new InitDataEditor({
            view: this,
            $container: this.$main,
            templateManager: this.templateManager
        });
    }
    
    refreshContent(data: privfs.types.core.FullInitData, editMultipleLangs: boolean): void {
        this.initDataEditor.loadInitData(data, editMultipleLangs);
    }
    
    onInitDataSave(success: boolean): void {
        this.initDataEditor.onInitDataSave(success);
    }
    
    callEditor(func: string, args: any[]): void {
        (<any>this.initDataEditor)[func].apply(this.initDataEditor, args);
    }
}
