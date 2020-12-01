import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {AdminWindowView} from "../AdminWindowView";
import {Model, LoginEntry} from "./LoginsController";
import {Grid, GridOptions, ModuleRegistry, GridApi} from "@ag-grid-community/all-modules";
import {ClientSideRowModelModule} from "@ag-grid-community/client-side-row-model";

import * as $ from "jquery";

export class LoginsView extends BaseView<Model> {
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "logins",
            priority: 500,
            groupId: "users",
            icon: "list",
            labelKey: "window.admin.menu.logins"
        };
    }
    
    initTab() {
        this.$main.on("click", "[data-action='get-page']", this.onGetPageClick.bind(this));
        ModuleRegistry.register(ClientSideRowModelModule);
    }
    
    onGetPageClick(e: MouseEvent) {
        let pageNo = parseInt($(e.target).closest("[data-page-no]").data("page-no"));
        this.triggerEvent("getPage", pageNo);
    }
    
    renderPage(model: Model) {
        this.$main.empty().append(this.templateManager.createTemplate(mainTemplate).renderToJQ(model));
    }

    renderGrid(model: Model) {
        this.renderAgGrid(model);
    }

    renderAgGrid(model: Model): void {
        let columnDefs = [
            {headerName: this.helper.i18n("window.admin.logins.table.date"), field: "date", sortable: true,  filter: "agDateColumnFilter"},
            {headerName: this.helper.i18n("window.admin.logins.table.user"), field: "user", sortable: true, filter: "agTextColumnFilter"},
            {
                headerName: this.helper.i18n("window.admin.logins.table.device"), 
                field: "device", 
                sortable: true, 
                filter: "agTextColumnFilter",
                cellClass: ["two-line-row"],
                cellRenderer: (param: any) => {
                    return (param.value as String).replace("\n", "<br/>");
                  }
            },
            {headerName: this.helper.i18n("window.admin.logins.table.ip"), field: "ip", sortable: true, filter: "agTextColumnFilter"},
            {headerName: this.helper.i18n("window.admin.logins.table.loggedIn"), field: "loggedIn", sortable: true, filter: true},
          ];

          // let the grid know which columns and what data to use
        let gridOptions = {
            api: new GridApi(),
            rowClass: "default-grid-bg",
            rowHeight: 45,
            defaultColDef: {
                resizable: true,
                cellClass:["default-grid-row"]

            },
            columnDefs: columnDefs,
            rowData: model.logins.map(x => {
                return {
                    date: this.helper.dateWithHourLocal(x.time * 1000), 
                    user: x.username, 
                    device: (<any>x).deviceName + "\n" + x.deviceId,
                    ip: x.ip, 
                    loggedIn: x.success ? this.helper.i18n("core.bool.yes") : this.helper.i18n("core.bool.no") 
                };
            })
        };
        
          
        let $eGridDiv:HTMLElement = <HTMLElement>document.querySelector('#myGrid');
        let grid = new Grid($eGridDiv, gridOptions);
        gridOptions.api.sizeColumnsToFit();
        
    }
}
