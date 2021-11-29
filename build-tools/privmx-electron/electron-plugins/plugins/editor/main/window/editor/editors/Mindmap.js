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
var metacores = require("document-element");
var custom_toolbar_mindmap_html_1 = require("../template/custom-toolbar-mindmap.html");
var right_side_toolbar_mindmap_html_1 = require("../template/right-side-toolbar-mindmap.html");
var pmc_web_1 = require("pmc-web");
var MindmapConverter_1 = require("./MindmapConverter");
var Mindmap = (function (_super) {
    __extends(Mindmap, _super);
    function Mindmap(options) {
        var _this = _super.call(this, options) || this;
        var helper = _this.parent.viewManager.getTemplateManager().getHelperByClass(pmc_web_1.webUtils.MailClientViewHelper);
        _this.nodeLabelFilters = [function (inputText, cb) {
                var defaultLinkTitle = helper.i18n("plugin.editor.window.editor.content.link.click.helper.text");
                var result = helper.linkify(inputText, true, defaultLinkTitle, true);
                cb(result);
            }];
        return _this;
    }
    Mindmap.prototype.initContainer = function () {
        this.$container = pmc_web_1.JQuery('<div class="editor-inner mindmap-editor-container"></div>');
        this.initStyle();
    };
    Mindmap.prototype.getObjectState = function () {
        return {
            elements: this.data.doc.save(),
            version: this.data.version,
            style: this.data.style
        };
    };
    Mindmap.prototype.paste = function (data) {
        if ("MindMapElement" in data) {
            this.data.doc.paste(JSON.parse(data["MindMapElement"]));
        }
        else if ("text" in data) {
            this.data.doc.paste(MindmapConverter_1.MindmapConverter.convertTextToMindMap(data["text"].split("\n")));
        }
    };
    Mindmap.prototype.getElements = function () {
        return this.data.doc.elements;
    };
    Mindmap.prototype.createDataFromObject = function (data) {
        data = data != null ? data : {
            elements: [{
                    klass: "MindMapElement",
                    spec: {
                        label: "Root",
                        nodes: []
                    }
                }],
            style: null,
            version: 1
        };
        if (Array.isArray(data)) {
            data = {
                elements: data,
                style: null,
                version: 1
            };
        }
        var $div = pmc_web_1.JQuery('<div class="mindmap-root" tabindex="-1"></div>');
        $div.on("paste", "[contenteditable=true]", pmc_web_1.webUtils.ContentEditableEditor.defaultPasteHandler);
        pmc_web_1.JQuery("body").prepend($div);
        var doc = new metacores.Document();
        doc.setEditable(this.editMode);
        doc.setExternalClipboard(true);
        var elements = data.elements;
        for (var i in elements) {
            if (elements[i].klass in metacores) {
                var container = pmc_web_1.JQuery("<div></div>").appendTo($div);
                var element = doc.addElement(metacores[elements[i].klass], elements[i].spec);
                if (elements[i].klass == "MindMapElement") {
                    for (var xxx in this.nodeLabelFilters)
                        element.filters.add("node.label", this.nodeLabelFilters[xxx]);
                    element.setEditor(new metacores.MindMapEditor());
                    element.setEditable(doc.editable);
                }
                element.render(container, { autoFocus: !this.previewMode, skipNavigationInfoOnDirtyCheck: false });
            }
        }
        $div.detach();
        $div.on('focus', function () {
            if (doc) {
                pmc_web_1.JQuery(doc).focus();
            }
        });
        this.bindDocEvents(doc);
        return {
            doc: doc,
            $view: $div,
            style: data.style,
            version: data.version
        };
    };
    Mindmap.prototype.render = function () {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.$view);
            this.$container.append(this.$help);
        }
    };
    Mindmap.prototype.updateLayout = function () {
        var mm = this.data.doc.elements[0].mm;
        mm.layout(mm.tree);
    };
    Mindmap.prototype.confirmSave = function (initState) {
        this.initState = initState;
        this.data.doc.confirmSave();
    };
    Mindmap.prototype.focus = function () {
        var $mindmap = this.data.$view.find(".mindmap");
        if ($mindmap) {
            $mindmap.focus();
        }
        if (this.newFile) {
            this.newFile = false;
            var mm = this.data.doc.elements[0].mm;
            var node = mm.createNode({
                label: "",
                nodes: []
            }, true);
            mm.appendNode(node, mm.selected);
            mm.layout(mm.tree);
            mm.select(node);
            mm.enterEditMode(true);
        }
    };
    Mindmap.prototype.setEditMode = function (editMode) {
        this.editMode = editMode;
        if (!this.editMode) {
            this.data.doc.elements[0].mm.exitEditMode();
        }
        this.data.doc.setEditable(this.editMode);
    };
    Mindmap.prototype.beforeSave = function () {
        if (this.editMode) {
            this.data.doc.elements[0].mm.exitEditMode();
        }
    };
    Mindmap.prototype.bindDocEvents = function (doc) {
        var _this = this;
        pmc_web_1.JQuery(doc).on("copy.document", function (_event, data) {
            var cliboardData = {};
            cliboardData["text"] = MindmapConverter_1.MindmapConverter.getRawAsFlatText(data);
            cliboardData["MindMapElement"] = JSON.stringify(data);
            _this.triggerEvent("copy", cliboardData);
        });
        pmc_web_1.JQuery(doc).on("paste.document", function (_event) {
            _this.triggerEvent("paste");
        });
        pmc_web_1.JQuery(doc).on("editAttemptWhenNotEditable.document", function (_event, data) {
            _this.triggerEvent("editAttemptWhenNotEditable", data);
        });
        pmc_web_1.JQuery(doc).on("change.document", function () {
            _this.triggerEvent("change", _this.isChanged());
        });
        pmc_web_1.JQuery(doc).on("clickWithControl.document", function (_event, data) {
            var url = pmc_web_1.JQuery(data.event.target).data("url");
            if (url) {
                _this.triggerEvent("linkClick", {
                    elem: data.event.target,
                    url: url
                });
            }
            return false;
        });
    };
    Mindmap.prototype.getCustomToolbarMenuHtml = function () {
        var model = this.getStyleSwitcherTemplateModel();
        return this.parent.viewManager.getTemplateManager().createTemplate(custom_toolbar_mindmap_html_1.func).render(model);
    };
    Mindmap.prototype.getCustomToolbarRightSideMenuHtml = function () {
        return this.parent.viewManager.getTemplateManager().createTemplate(right_side_toolbar_mindmap_html_1.func).render();
    };
    Mindmap.clazz = "Mindmap";
    Mindmap.mimetype = "application/x-smm";
    return Mindmap;
}(JsonEditor_1.JsonEditor));
exports.Mindmap = Mindmap;
Mindmap.prototype.className = "com.privmx.plugin.editor.window.editor.editors.Mindmap";

//# sourceMappingURL=Mindmap.js.map
