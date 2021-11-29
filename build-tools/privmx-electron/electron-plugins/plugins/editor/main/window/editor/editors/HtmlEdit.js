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
var JsonEditor_1 = require("./JsonEditor");
var pmc_web_1 = require("pmc-web");
var pmc_web_2 = require("pmc-web");
var HtmlEdit = (function (_super) {
    __extends(HtmlEdit, _super);
    function HtmlEdit(options) {
        return _super.call(this, options) || this;
    }
    HtmlEdit.prototype.initContainer = function () {
        this.$container = pmc_web_1.JQuery('<div class="editor-inner html-editor-container"></div>');
        this.initStyle();
    };
    HtmlEdit.prototype.sanitize = function (str) {
        str = str.replace(/(\r\n|\r|\n)/g, "<br>");
        return pmc_web_1.webUtils.ContentEditableEditor.safeHtml(str, undefined, this.taskStatuses, true);
    };
    HtmlEdit.prototype.createDataFromState = function (state) {
        var _this = this;
        var data = state ? JSON.parse(state) : {};
        var text = data.content;
        data.style = {
            name: data.style && data.style.name && data.style.name in pmc_web_2.component.mindmap.Mindmap.AVAILABLE_STYLES ? data.style.name : pmc_web_2.component.mindmap.Mindmap.DEFAULT_STYLE_NAME,
            fontSize: data.style && data.style.fontSize && data.style.fontSize in pmc_web_2.component.mindmap.Mindmap.AVAILABLE_FONT_SIZES ? data.style.fontSize : pmc_web_2.component.mindmap.Mindmap.DEFAULT_FONT_SIZE,
            margin: data.style && data.style.margin && data.style.margin in pmc_web_2.component.mindmap.Mindmap.AVAILABLE_MARGINS ? data.style.margin : pmc_web_2.component.mindmap.Mindmap.DEFAULT_MARGIN,
        };
        var metaData = pmc_web_1.webUtils.ContentEditableEditorMetaData.fromString(data.metaDataStr);
        text = metaData.attach(text);
        text = text ? this.sanitize(text) : "";
        var $elem = pmc_web_1.JQuery("<div>").addClass("editor-textarea html-editor");
        var editor = new pmc_web_1.webUtils.ContentEditableEditor($elem, {
            onKeyDown: this.inputEventsHandler.bind(this),
            onPaste: this.inputEventsHandler.bind(this),
            onCut: this.inputEventsHandler.bind(this),
            onInput: this.inputEventsHandler.bind(this),
            onRequestTaskPicker: function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var _a;
                _this.parent.onTaskPickerResult(editor.onTaskPickerResult.bind(editor));
                return (_a = _this.parent).onRequestTaskPicker.apply(_a, args);
            },
            onRequestFilePicker: function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                var _a;
                _this.parent.onFilePickerResult(editor.onFilePickerResult.bind(editor));
                return (_a = _this.parent).onRequestFilePicker.apply(_a, args);
            },
            relatedHostHash: function () { return _this.relatedHostHash; },
            relatedSectionId: function () { return _this.relatedSectionId; },
        });
        editor.setValue(text, true, this.editMode);
        editor.meta = metaData;
        return {
            editor: editor,
            style: data.style,
            metaDataStr: data.metaDataStr,
        };
    };
    HtmlEdit.prototype.getObjectState = function () {
        var str = this.data.editor.getValue();
        var _a = pmc_web_1.webUtils.ContentEditableEditorMetaData.extractMetaFromHtml(str), metaData = _a.metaData, html = _a.html;
        return {
            content: html,
            style: this.data.style,
            metaDataStr: JSON.stringify(metaData),
        };
    };
    HtmlEdit.prototype.confirmSave = function (initState) {
        _super.prototype.confirmSave.call(this, initState);
        this.data.editor.setCurrentValueAsDefault();
        this.triggerEvent("change", false);
    };
    HtmlEdit.prototype.render = function () {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.editor.$elem);
        }
    };
    HtmlEdit.prototype.focus = function () {
        if (this.data && this.data.editor) {
            this.data.editor.focus();
        }
    };
    HtmlEdit.prototype.inputEventsHandler = function (event) {
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
                    this.triggerEvent("editAttemptWhenNotEditable", { event: event });
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
    };
    HtmlEdit.prototype.updateTaskBadges = function () {
        this.data.editor.setValue(this.data.editor.getValue());
    };
    HtmlEdit.clazz = "HtmlEdit";
    HtmlEdit.mimetype = "application/x-stt";
    return HtmlEdit;
}(JsonEditor_1.JsonEditor));
exports.HtmlEdit = HtmlEdit;
var ALLOWED_SINGLE_KEYS = [
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
HtmlEdit.prototype.className = "com.privmx.plugin.editor.window.editor.editors.HtmlEdit";

//# sourceMappingURL=HtmlEdit.js.map
