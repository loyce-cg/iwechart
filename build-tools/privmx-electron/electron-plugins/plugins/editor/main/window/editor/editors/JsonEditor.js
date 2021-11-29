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
var StyledEditor_1 = require("./StyledEditor");
var JsonEditor = (function (_super) {
    __extends(JsonEditor, _super);
    function JsonEditor(options) {
        return _super.call(this, options) || this;
    }
    JsonEditor.prototype.createDataFromState = function (state) {
        return this.createDataFromObject(state == "" ? null : JSON.parse(state));
    };
    JsonEditor.prototype.getState = function () {
        return JSON.stringify(this.getObjectState());
    };
    JsonEditor.prototype.createDataFromObject = function (object) {
        throw new Error("Unimplemented");
    };
    JsonEditor.prototype.getObjectState = function () {
        throw new Error("Unimplemented");
    };
    JsonEditor.clazz = "JsonEditor";
    return JsonEditor;
}(StyledEditor_1.StyledEditor));
exports.JsonEditor = JsonEditor;
JsonEditor.prototype.className = "com.privmx.plugin.editor.window.editor.editors.JsonEditor";

//# sourceMappingURL=JsonEditor.js.map
