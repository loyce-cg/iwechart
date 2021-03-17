// deprecated code

import {EditorOptions} from "./Editor";
import {JsonEditor} from "./JsonEditor";
import {Style} from "./StyledEditor";
import metacores = require("document-element");
import {func as customToolbarMindmapTemplate} from "../template/custom-toolbar-mindmap.html";
import {func as rightSideToolbarMindmapTemplate} from "../template/right-side-toolbar-mindmap.html";
import {JQuery as $, webUtils} from "pmc-web";
import {app} from "pmc-mail";
import { MindmapConverter } from "./MindmapConverter";


export type SerializedElement = metacores.SerializedElement;
export type SerializedElementSpec = metacores.SerializedElementSpec;

export interface Raw {
    elements: metacores.SerializedElement[];
    version: number;
    style: Style;
}

export interface State {
    doc: metacores.Document;
    $view: JQuery;
    style: Style;
    version:number;
}

export class Mindmap extends JsonEditor<State, Raw> {

    static clazz = "Mindmap";
    static mimetype = "application/x-smm";
    
    nodeLabelFilters: metacores.Filter[];
    $help: JQuery;
    
    constructor(options: EditorOptions) {
        super(options);
        let helper = this.parent.viewManager.getTemplateManager().getHelperByClass(webUtils.MailClientViewHelper);
        this.nodeLabelFilters = [(inputText: string, cb: (text: string) => void) => {
            let defaultLinkTitle = helper.i18n("plugin.editor.window.editor.content.link.click.helper.text");
            let result = helper.linkify(inputText, true, defaultLinkTitle, true);
            cb(result);
        }];
    }
    
    initContainer() {
        this.$container = $('<div class="editor-inner mindmap-editor-container"></div>');
        this.initStyle();
    }
    
    getObjectState(): Raw {
        return {
            elements: this.data.doc.save(),
            version: this.data.version,
            style: this.data.style
        };
    }
    
    paste(data: app.common.clipboard.ClipboardData): void {
        if ("MindMapElement" in data) {
            this.data.doc.paste(<SerializedElementSpec>JSON.parse(data["MindMapElement"]));
        }
        else if ("text" in data) {
            this.data.doc.paste(MindmapConverter.convertTextToMindMap(data["text"].split("\n")));
        }
    }
    
    getElements() {
        return this.data.doc.elements
    }
    
    createDataFromObject(data: Raw): State {
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
        let $div = $('<div class="mindmap-root" tabindex="-1"></div>');
        $div.on("paste", "[contenteditable=true]", <any>webUtils.ContentEditableEditor.defaultPasteHandler);
        $("body").prepend($div);
        let doc = new metacores.Document();
        doc.setEditable(this.editMode);
        doc.setExternalClipboard(true);
        let elements = data.elements;
        for (var i in elements) {
            if (elements[i].klass in <any>metacores) {
                let container = $("<div></div>").appendTo($div);
                let element = doc.addElement(<metacores.ElementClass>(<any>metacores)[elements[i].klass], elements[i].spec);
                if (elements[i].klass == "MindMapElement") {
                    for (var xxx in this.nodeLabelFilters)
                    element.filters.add("node.label", this.nodeLabelFilters[xxx]);
                    element.setEditor(new metacores.MindMapEditor());
                    element.setEditable(doc.editable);
                }
                element.render(container, {autoFocus: !this.previewMode, skipNavigationInfoOnDirtyCheck: false});
            }
        }
        $div.detach();
        $div.on('focus', () => {
            if (doc) {
                $(doc).focus();
            }
        });
        this.bindDocEvents(doc);
        return {
            doc: doc,
            $view: $div,
            style: data.style,
            version: data.version
        };
    }
    
    render(): void {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append(this.data.$view);
            this.$container.append(this.$help);
        }
    }
    
    updateLayout(): void {
        let mm = this.data.doc.elements[0].mm;
        mm.layout(mm.tree);
    }
    
    confirmSave(initState: string): void {
        this.initState = initState;
        this.data.doc.confirmSave();
    }
    
    focus(): void {
        let $mindmap = this.data.$view.find(".mindmap");
        if ($mindmap) {
            $mindmap.focus();
        }
        if (this.newFile) {
            this.newFile = false;
            let mm = this.data.doc.elements[0].mm;
            let node = mm.createNode({
                label: "",
                nodes: []
            }, true);
            mm.appendNode(node, mm.selected);
            mm.layout(mm.tree);
            mm.select(node);
            mm.enterEditMode(true);
        }
    }
    
    setEditMode(editMode: boolean): void {
        this.editMode = editMode;
        if (!this.editMode) {
            this.data.doc.elements[0].mm.exitEditMode();
        }
        this.data.doc.setEditable(this.editMode);
    }
    
    beforeSave(): void {
        if (this.editMode) {
            this.data.doc.elements[0].mm.exitEditMode();
        }
    }
    
    bindDocEvents(doc: metacores.Document): void {
        $(doc).on("copy.document", (_event, data) => {
            let cliboardData: app.common.clipboard.ClipboardData = {};
            cliboardData["text"] = MindmapConverter.getRawAsFlatText(data);
            cliboardData["MindMapElement"] = JSON.stringify(data);
            this.triggerEvent("copy", cliboardData);
        });
        $(doc).on("paste.document", (_event) => {
            this.triggerEvent("paste");
        });
        $(doc).on("editAttemptWhenNotEditable.document", (_event, data) => {
            this.triggerEvent("editAttemptWhenNotEditable", data);
        });
        $(doc).on("change.document", () => {
            this.triggerEvent("change", this.isChanged());
        });
        $(doc).on("clickWithControl.document", (_event, data) => {
            let url = $(data.event.target).data("url");
            if (url) {
                this.triggerEvent("linkClick", {
                    elem: data.event.target,
                    url: url
                });
            }
            return false;
        });
    }
    
    getCustomToolbarMenuHtml(): string {
        let model = this.getStyleSwitcherTemplateModel();
        return this.parent.viewManager.getTemplateManager().createTemplate(customToolbarMindmapTemplate).render(model);
    }
    
    getCustomToolbarRightSideMenuHtml(): string {
        return this.parent.viewManager.getTemplateManager().createTemplate(rightSideToolbarMindmapTemplate).render();
    }
}
