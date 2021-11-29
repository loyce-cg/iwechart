"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Editor_1 = require("./Editor");
var simplitoSpreadsheet = require("simplito-spreadsheet");
var SimSpreadsheet = simplitoSpreadsheet.com.simplito.spreadsheet.Spreadsheet;
var Spreadsheet = (function (_super) {
    __extends(Spreadsheet, _super);
    function Spreadsheet(options) {
        return _super.call(this, options) || this;
    }
    Spreadsheet.prototype.generateDefaultData = function () {
        return Spreadsheet.prototype.fromJson({ cells: [] });
    };
    Spreadsheet.prototype.toJson = function () {
        return this.data.saveData();
    };
    Spreadsheet.prototype.fromJson = function (data) {
        var spreadsheet = new SimSpreadsheet(7, 15);
        if (typeof (data) == "object" && data.cells != null) {
            spreadsheet.loadData(data);
        }
        return spreadsheet;
    };
    Spreadsheet.prototype.render = function () {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.$element);
        }
    };
    Spreadsheet.prototype.focus = function () {
        this.data.$table.focus();
    };
    Spreadsheet.clazz = "Spreadsheet";
    Spreadsheet.mimetype = "application/x-sss";
    return Spreadsheet;
}(Editor_1.Editor));
exports.Spreadsheet = Spreadsheet;
Spreadsheet.prototype.className = "com.privmx.plugin.editor.window.editor.editors.Spreadsheet";

//# sourceMappingURL=Spreadsheet.js.map
