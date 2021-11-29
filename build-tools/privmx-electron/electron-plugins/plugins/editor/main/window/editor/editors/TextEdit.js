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
var pmc_web_1 = require("pmc-web");
var TextEdit = (function (_super) {
    __extends(TextEdit, _super);
    function TextEdit(options) {
        return _super.call(this, options) || this;
    }
    TextEdit.prototype.initContainer = function () {
        this.$container = pmc_web_1.JQuery('<div class="editor-inner text-editor-container"></div>');
    };
    TextEdit.prototype.standardizeNewline = function (str) {
        return str.replace("\r\n", "\n").replace("\r", "\n");
    };
    TextEdit.prototype.createDataFromState = function (state) {
        var text = state == null ? "" : this.standardizeNewline(state);
        var $textarea = pmc_web_1.JQuery("<textarea>").addClass("form-control editor-textarea");
        $textarea.prop("defaultValue", text);
        this.bindTextareaEvents($textarea);
        this.$textarea = $textarea;
        this.updateTextareaEditable();
        return {
            $textarea: $textarea
        };
    };
    TextEdit.prototype.getState = function () {
        return this.standardizeNewline(this.data.$textarea.val());
    };
    TextEdit.prototype.confirmSave = function (initState) {
        _super.prototype.confirmSave.call(this, initState);
        var text = this.data.$textarea.val();
        this.data.$textarea.prop("defaultValue", text);
        this.triggerEvent("change", false);
    };
    TextEdit.prototype.render = function () {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.$textarea);
        }
    };
    TextEdit.prototype.isChanged = function () {
        return (this.initState == null ? null : this.standardizeNewline(this.initState)) != this.getState();
    };
    TextEdit.prototype.focus = function () {
        if (this.data && this.data.$textarea) {
            this.data.$textarea.focus();
        }
    };
    TextEdit.prototype.setEditMode = function (editMode) {
        this.editMode = editMode;
        this.updateTextareaEditable();
    };
    TextEdit.prototype.updateTextareaEditable = function () {
        if (this.$textarea) {
            this.$textarea.prop("readonly", !this.editMode);
        }
    };
    TextEdit.prototype.bindTextareaEvents = function ($textarea) {
        var _this = this;
        $textarea.on("cut paste keydown", function (event) {
            var allowedSingleKeys = [
                16,
                17,
                18,
                19,
                20,
                27,
                33,
                34,
                35,
                36,
                37,
                38,
                39,
                40,
                44,
                93,
                112,
                113,
                114,
                115,
                116,
                117,
                118,
                119,
                120,
                121,
                122,
                123,
                144,
                145,
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
            if (!_this.editMode) {
                _this.triggerEvent("editAttemptWhenNotEditable", event);
                return false;
            }
        });
        $textarea.on("keydown", function (event) {
            if (event.keyCode == 9 && _this.editMode) {
                var textarea = event.currentTarget;
                var $textarea_1 = pmc_web_1.JQuery(textarea);
                var start = textarea.selectionStart;
                var end = textarea.selectionEnd;
                var val = $textarea_1.val();
                $textarea_1.val(val.substring(0, start) + "\t" + val.substring(end));
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                return false;
            }
        });
        $textarea.on("input", function (event) {
            var textarea = event.currentTarget;
            _this.triggerEvent("change", textarea.value != textarea.defaultValue);
        });
    };
    TextEdit.clazz = "TextEdit";
    TextEdit.mimetype = "text/plain";
    return TextEdit;
}(Editor_1.Editor));
exports.TextEdit = TextEdit;
TextEdit.prototype.className = "com.privmx.plugin.editor.window.editor.editors.TextEdit";

//# sourceMappingURL=TextEdit.js.map
