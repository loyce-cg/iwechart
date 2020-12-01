import * as $ from "jquery";
import {HtmlSanitizer} from "./HtmlSanitizer";
import {Formatter} from "../utils/Formatter";
import { ContentEditableParser } from "./ContentEditableParser";
import { ContentEditableEditorMetaData, FilePickerData } from "./ContentEditableEditorMetaData";
import { children } from "simplito-logger";
import Q = require("q");
let relaxedSanitizer = new HtmlSanitizer({
    elements: ['strong', 'b', 'u', 'i', 'br', 'div'],
    attributes: {div: ['style']},
    remove_contents: ['script'],
    transformers: [HtmlSanitizer.createStyleTransformer("div", ['color', 'background-color'])]
});
let mindmapSanitizer = new HtmlSanitizer({
    elements: ['strong', 'b', 'u', 'i', 'br', 'div', 'span'],
    attributes: { div: ['style'], span: ['style'] },
    remove_contents: ['script'],
    transformers: [HtmlSanitizer.createStyleTransformer("div", ['color', 'background-color'])]
});
let restrictedSanitizer = new HtmlSanitizer({
    elements: ['b', 'u', 'i', 'br', 'privmx-quote-header'],
    attributes: { 'privmx-quote-header': ['data-hashmail', 'data-timestamp', 'data-msg-num'] },
    remove_contents: ['script']
});
let clipboardSanitizer = new HtmlSanitizer({
    elements: ['b', 'u', 'i', 'br', 'strong', 'em', 'p', 'div', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    remove_contents: ['script', 'style', 'head']
});
let restrictedSanitizerWithLink = new HtmlSanitizer({
    elements: ['b', 'u', 'i', 'br', 'a'],
    attributes: {a: ['href']},
    remove_contents: ['script'],
    add_attributes: {a: {
        'rel': 'noopener noreferrer',
        'target': '_blank'
    }}
});
let restrictedSanitizerWithLinkAndMetaData = new HtmlSanitizer({
    elements: ['b', 'u', 'i', 'br', 'a', ContentEditableEditorMetaData.META_DATA_TAG_NAME],
    attributes: {a: ['href']},
    remove_contents: ['script'],
    add_attributes: {a: {
        'rel': 'noopener noreferrer',
        'target': '_blank'
    }}
});
let formatter = new Formatter();

export interface Options {
    onPaste?: (event: any) => void;
    onPasteSeemsEmpty?: () => void;
    onPasteSeemsFile?: (paths: string[], originalText: string) => void;
    onKeyDown?: (event: any) => void;
    onCut?: (event: any) => void;
    onInput?: (event: any) => void;
    onChange?: () => void;
    onBlur?: (event: any) => void;
    onFocus?: (event: any) => void;
    disallowTab?: boolean;
    getValueSanitizer?: "default" | "safeHtml" | "safeMindmapHtml";
    isDarwin?: boolean;
    onRequestTaskPicker?: (currentTaskId: string, relatedHostHash: string, relatedSectionId: string, allowCreatingTasks: boolean) => void;
    onRequestFilePicker?: (currentFileId: string, relatedHostHash: string, relatedSectionId: string) => void;
    relatedHostHash?: string | (() => string);
    relatedSectionId?: string | (() => string);
    disableCreatingTasks?: boolean;
}

interface CaretPosition {
    startContainerPath?: string;
    startContainer?: Node;
    startOffset?: number;
    endContainerPath?: string;
    endContainer?: Node;
    endOffset?: number;
}

interface UndoRedoStep {
    data: string;
    lastCaretPosition?: CaretPosition;
}

class CaretHelper {
    
    static getCaretPosition(rng?: Range): CaretPosition {
        if (!rng) {
            let sel = document.getSelection();
            if (sel && sel.rangeCount == 1) {
                rng = sel.getRangeAt(0);
            }
        }
        if (rng) {
            if ($(rng.startContainer).closest("[contenteditable=true]").length == 0 || $(rng.endContainer).closest("[contenteditable=true]").length == 0) {
                return null;
            }
            return {
                startContainerPath: this.getNodePath(rng.startContainer),
                startContainer: rng.startContainer,
                startOffset: rng.startOffset,
                endContainerPath: this.getNodePath(rng.endContainer),
                endContainer: rng.endContainer,
                endOffset: rng.endOffset,
            };
        }
        return null;
    }
    
    static getNodePath(node: Node): string {
        let pathElements: string[] = [];
        while (node && (!(node instanceof HTMLElement) || node.getAttribute("contenteditable") != "true")) {
            let parent = node.parentNode;
            let idx = -1;
            for (let i = 0; i < parent.childNodes.length; ++i) {
                if (parent.childNodes[i] == node) {
                    idx = i;
                    break;
                }
            }
            if (idx < 0) {
                break;
            }
            pathElements.push(idx.toString());
            node = parent;
        }
        return pathElements.reverse().join("/");
    }
    
    static getNodeFromPath(rootNode: Node, path: string): Node {
        let pathElements = (path || "").split("/").filter(x => !!x).map(x => parseInt(x));
        let node: Node = rootNode;
        for (let i = 0; i < pathElements.length && node; ++i) {
            node = node.childNodes[pathElements[i]];
        }
        return node;
    }
    
    static placeCaret(rootNode: Node, position: CaretPosition): void {
        if (!position) {
            ContentEditableEditor.placeCaretAtEnd(<HTMLElement>rootNode);
            return;
        }
        
        let startContainer: Node = CaretHelper.getNodeFromPath(rootNode, position.startContainerPath);
        let endContainer: Node = CaretHelper.getNodeFromPath(rootNode, position.endContainerPath);
        let sel = document.getSelection();
        if (sel) {
            let rng = document.createRange();
            rng.setStart(startContainer, position.startOffset);
            rng.setEnd(endContainer, position.endOffset);
            sel.removeAllRanges();
            sel.addRange(rng);
        }
    }
    
    static onCaretPositionChange($elem: JQuery, callback: () => void): void {
        let _fn = () => {
            callback();
        };
        let _fnTO = () => {
            setTimeout(() => {
               _fn(); 
            }, 0);
        };
        $elem.on("input",_fn);
        $elem.on("keydown", _fnTO);
        $elem.on("keypress", _fnTO);
        $elem.on("mousedown", _fn);
    }
    
}

class ChangesManager {
    undoStack: UndoRedoStep[] = [];
    redoStack: UndoRedoStep[] = [];
    initialValue: string = "";
    initialCaretPosition: CaretPosition = null;
    lastUndoBackspaceAt: number = -1;
    isFrozen: boolean = false;
    
    canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    
    undo(): UndoRedoStep {
        if (this.isFrozen) {
            return;
        }
        if (this.canUndo()) {
            let val = this.undoStack.pop();
            this.redoStack.push(val);
            let lastStep = this.getLastUndo();
            return {
                data: lastStep.data,
                lastCaretPosition: lastStep.lastCaretPosition,
            };
        }
        else {
            return null;
        }
    }
    
    getLastUndo(): UndoRedoStep {
        if (this.canUndo()) {
            return this.undoStack[this.undoStack.length - 1];
        }
        else {
            return {
                data: this.initialValue,
                lastCaretPosition: this.initialCaretPosition,
            };
        }
    }
    
    getLastNonEmptyUndo(): UndoRedoStep {
        for (let i = this.undoStack.length - 1; i >= 0; --i) {
            if (this.undoStack[i] && this.undoStack[i].data.length > 0) {
                let undoStep = this.undoStack[i];
                return {
                    data: undoStep.data,
                    lastCaretPosition: undoStep.lastCaretPosition,
                };
            }
        }
        return {
            data: this.initialValue,
            lastCaretPosition: this.initialCaretPosition,
        };
    }
    
    updateTop(data: string, ensureContinuous: boolean = false) {
        data = data.replace(/\n/g, "<br>");
        if (this.isFrozen) {
            return;
        }
        if (this.undoStack.length > 0) {
            if (ensureContinuous) {
                let top = this.undoStack[this.undoStack.length - 1];
                let sel = document.getSelection();
                if (top && sel && sel.rangeCount == 1) {
                    let rng = sel.getRangeAt(0);
                    let continuous: boolean = true;
                    let lastPosition = top.lastCaretPosition;
                    if (lastPosition) {
                        if (lastPosition.startContainer != rng.startContainer || lastPosition.endContainer != rng.endContainer) {
                            continuous = false;
                        }
                        if (Math.abs(lastPosition.startOffset - rng.startOffset) > 1 || Math.abs(lastPosition.endOffset - rng.endOffset) > 1) {
                            continuous = false;
                        }
                    }
                    else {
                        continuous = false;
                    }
                    if (!continuous) {
                        this.addStep(data);
                        return;
                    }
                }
            }
            this.undoStack[this.undoStack.length - 1].data = data;
            this.undoStack[this.undoStack.length - 1].lastCaretPosition = CaretHelper.getCaretPosition();
        }
        else {
            this.addStep(data);
        }
    }
    
    wrapData(data: string): UndoRedoStep {
        let sel = document.getSelection();
        if (sel && sel.rangeCount == 1) {
            return {
                data: data,
                lastCaretPosition: CaretHelper.getCaretPosition(sel.getRangeAt(0)),
            };
        }
        return {
            data: data,
        };
    }
    
    canRedo(): boolean {
        return this.redoStack.length > 0;
    }
    
    redo(): UndoRedoStep {
        if (this.isFrozen) {
            return;
        }
        let step: UndoRedoStep;
        if (this.canRedo()) {
            let val = this.redoStack.pop();
            this.undoStack.push(val);
            this.lastUndoBackspaceAt = new Date().getTime();
            step = val;
        }
        else {
            step = this.getLastRedo();
        }
        return {
            data: step.data,
            lastCaretPosition: step.lastCaretPosition,
        };
    }
    
    getLastRedo(): UndoRedoStep {
        if (this.canRedo()) {
            return this.redoStack[this.redoStack.length - 1];
        }
        else {
            return null;
        }
    }
    
    addStep(data: string, isBackspace: boolean = false): void {
        data = data.replace(/\n/g, "<br>");
        if (this.isFrozen) {
            return;
        }
        if (isBackspace) {
            let now: number = new Date().getTime();
            if (now - this.lastUndoBackspaceAt < 500) {
                this.lastUndoBackspaceAt = now;
                this.updateTop(data);
                return;
            }
            this.lastUndoBackspaceAt = now;
        }
        else {
            this.lastUndoBackspaceAt = -1;
        }
        this.undoStack.push(this.wrapData(data));
        this.redoStack.length = 0;
    }
    
    addStepIfDifferent(data: string): void {
        if (this.undoStack.length == 0 || this.undoStack[this.undoStack.length - 1].data != data) {
            return this.addStep(data);
        }
    }
    
}

export class ContentEditableEditor {
    
    static placeCaretAtStart = createCaretPlacer(true);
    static placeCaretAtEnd = createCaretPlacer(false);
    static PRIVMX_COPIED_HTML_PREFIX: string = `<meta name="copied-from" value="privmx" />`;
    static readonly OPEN_PICKER_AT_LINE_START: boolean = false;
    
    $elem: JQuery;
    prevHtml: string;
    spaceHit: boolean;
    markCleanEndBr: boolean;
    isWebkit: boolean;
    disallowTab: boolean;
    changesManager: ChangesManager;
    _fixChromeBug: boolean = false;
    meta: ContentEditableEditorMetaData = new ContentEditableEditorMetaData();
    $currentHint: JQuery = null;
    
    
    constructor($elem: JQuery, public options?: Options) {
        options = options || {};
        this.$elem = $elem;
        if (this.$elem.parent().css("display") == "flex") {
            this._fixChromeBug = true;
        }
        setTimeout(() => {
            if (this.$elem.closest(".window-sectionsummary").length > 0) {
                this._fixChromeBug = true;
            }
        }, 1000);
        CaretHelper.onCaretPositionChange($elem, () => {
            let ctx = this.getCursorInPickerContext();
            let isCursorInPickerContext = !!ctx;
            if (this.$currentHint && !isCursorInPickerContext) {
                setTimeout(() => {
                    if (!this.$currentHint || this.isCursorInPickerContext()) {
                        return;
                    }
                    this.$currentHint.remove();
                    this.$currentHint = null;
                }, 0);
            }
            else if (!this.$currentHint && isCursorInPickerContext) {
                setTimeout(() => {
                    if (this.$currentHint || !this.isCursorInPickerContext()) {
                        return;
                    }
                    this.tryShowHint(ctx);
                }, 0);
            }
        });
        this.$elem.on("blur", () => {
            setTimeout(() => {
                if (this.$currentHint) {
                    this.$currentHint.remove();
                    this.$currentHint = null;
                }
            }, 0);
        });
        this.$elem.on("focus", () => {
            if (!this.$currentHint) {
                setTimeout(() => {
                    if (!this.$currentHint) {
                        let ctx = this.getCursorInPickerContext();
                        if (ctx) {
                            this.tryShowHint(ctx);
                        }
                    }
                }, 0);
            }
        });
        this.$elem.data("contentEditableEditor", this);
        this.$elem.attr("contenteditable", "true");
        this.$elem.css("display", "inline-block");
        this.$elem.css("white-space", "pre-wrap");
        this.$elem.on("paste", options.onPaste || this.onPaste.bind(this));
        this.$elem.on("keydown", options.onKeyDown || this.onKeyDown.bind(this));
        this.$elem.on("cut", options.onCut || this.onCut.bind(this));
        this.$elem.on("input", options.onInput || this.onInput.bind(this));
        this.$elem.on("input", this.onInputHandleHistory.bind(this));
        this.$elem.on("blur", options.onBlur || this.onBlur.bind(this));
        this.$elem.on("focus", options.onFocus || this.onFocus.bind(this));
        this.$elem.on("click", this.onClick.bind(this));
        if (options.onChange) {
            this.$elem.on("input", options.onChange);
        }
        this.isWebkit = 'webkitRequestAnimationFrame' in window;
        this.$elem.on("click", this.focus.bind(this));
        document.execCommand("defaultParagraphSeparator", false, "br");
        this.markCleanEndBr = false;
        this.spaceHit = false;
        this.disallowTab = options.disallowTab || false;
        this.changesManager = new ChangesManager();
    }
    
    isTaskPickerEnabled(): boolean {
        return this.options && !!this.options.onRequestTaskPicker;
    }
    
    isFilePickerEnabled(): boolean {
        return this.options && !!this.options.onRequestFilePicker;
    }
    
    getValue(): string {
        if (!this.$elem) {
            return "";
        }
        let html = this.$elem.html();
        if (!html) {
            return "";
        }
        html = ContentEditableEditor.crossBrowserGetValue(html);
        let safeHtml: string = null;
        
        // Sanitize
        if (this.options && this.options.getValueSanitizer && this.options.getValueSanitizer != "default") {
            if (this.options.getValueSanitizer == "safeHtml") {
                safeHtml = ContentEditableEditor.safeHtml(html);
            }
            else if (this.options.getValueSanitizer == "safeMindmapHtml") {
                safeHtml = ContentEditableEditor.safeMindmapHtml(html);
            }
            else {
                safeHtml = ContentEditableEditor.safeHtml(html);
            }
        }
        else {
            safeHtml = ContentEditableEditor.safeHtml(html);
        }
        
        return this.meta.attach(safeHtml);
    }
    
    setValue(html: string, isDefault?: boolean, removeBadges?: boolean): void {
        if (removeBadges) {
            const chr = ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER;
            html = html.replace(/<span class=('|")task-label[^>]*>(#[0-9]+)<\/span>/g, "$2");
            html = html.replace(/<span class=('|")file-label[^>]*><i[^>]*>[^<]*<\/i>([^<]+)<\/span>/g, chr + "{$2}");
        }
        let res = ContentEditableEditorMetaData.extractMetaFromHtml(html);
        this.meta = res.metaData;
        html = res.html;
        this.$elem.html(html);
        if (this.options && this.options.onChange) {
            this.options.onChange();
        }
        if (isDefault) {
            this.setDefaultValue(html);
        }
        this.changesManager.initialValue = html;
        this.changesManager.initialCaretPosition = CaretHelper.getCaretPosition() || null;
    }
    
    clearValue(): void {
        this.setValue("");
        this.meta = new ContentEditableEditorMetaData();
    }
    
    appendValue(html: string): void {
        this.$elem.append(html);
    }
    
    setDefaultValue(html: string): void {
        this.setData("default-value", html);
    }
    
    setCurrentValueAsDefault(): void {
        this.setDefaultValue(this.getValue());
    }
    
    isDirty(): boolean {
        return this.getValue() !== this.getData("default-value");
    }
    
    getData(key: string): any {
        return this.$elem.data(key);
    }
    
    setData(key: string, value: any): void {
        this.$elem.data(key, value);
    }
    
    addClass(className: string): void {
        this.$elem.addClass(className);
    }
    
    hasClass(className: string): boolean {
        return this.$elem.hasClass(className);
    }
    
    removeClass(className: string): void {
        this.$elem.removeClass(className);
    }
    
    onPaste(event: any, data: { text: string, html: string } = null, $el: JQuery = null): void {
        if (ContentEditableEditor.defaultPasteHandler(
            event, 
            this.options ? this.options.onPasteSeemsFile : null,
            this.options ? !!this.options.isDarwin : false,
            data, $el
        )) {
            this.changesManager.addStep(this.$elem.html());
            if (this.options && this.options.onChange) {
                this.options.onChange();
            }
        }
        else if (this.options && this.options.onPasteSeemsEmpty) {
            this.options.onPasteSeemsEmpty();
        }
    }
    
    onCut(event: any): void {
    }
    
    onInput(event: any): void {
        this.checkEndBr();
    }
    
    onInputHandleHistory(event: KeyboardEvent): void {
        this.changesManager.updateTop(this.$elem.html(), true);
    }
    
    onBlur(event: any): void {
        if (this.getValue() == "<br>") {
            this.clearValue();
        }
    }
    
    onFocus(event: any): void {
        if (!this.changesManager.initialCaretPosition) {
            this.changesManager.initialCaretPosition = CaretHelper.getCaretPosition() || null;
        }
    }
    
    onClick(): void {
        this.addStepForUndo();
    }
    
    addStepForUndo(): void {
        this.changesManager.addStepIfDifferent(this.$elem.html());
    }
    
    applyUndoRedoData(el: UndoRedoStep): void {
        this.$elem.html(el.data);
        CaretHelper.placeCaret(this.$elem[0], el.lastCaretPosition);
    }
    
    
    onKeyDown(event: KeyboardEvent): void {
        if (this.$currentHint && event.key != "Control" && event.key != "Shift" && event.key != "Alt") {
            // setTimeout(() => {
            //     this.$currentHint.remove();
            //     this.$currentHint = null;
            // }, 0);
        }
        this.prevHtml = this.$elem.html();
        if (event.key == "ArrowUp" || event.key == "ArrowDown" || event.key == "ArrowLeft" || event.key == "ArrowRight") {
            this.addStepForUndo();
        }
        if (event.metaKey || event.ctrlKey) {
            switch (event.keyCode) {
                case 66:
                    this.changesManager.addStep(this.$elem.html());
                    document.execCommand('bold', false);
                    event.preventDefault();
                    break;
                case 73:
                    this.changesManager.addStep(this.$elem.html());
                    document.execCommand('italic', false);
                    event.preventDefault();
                    break;
                case 85:
                    this.changesManager.addStep(this.$elem.html());
                    document.execCommand('underline', false);
                    event.preventDefault();
                    break;
                case 13:
                    if (event.ctrlKey) {
                        event.preventDefault();
                        return;
                    }
                    document.execCommand('insertHTML', false, '<br><br>');
                    this.changesManager.addStep(this.$elem.html());
                    event.preventDefault();
                    break;
                case 90:
                    if (event.shiftKey) {
                        if (this.changesManager.canRedo()) {
                            let result = this.changesManager.redo();
                            if (result) {
                                this.applyUndoRedoData(result);
                                if (this.options && this.options.onChange) {
                                    this.options.onChange();
                                }
                            }
                        }
                    }
                    else {
                        let result = this.$elem.html().length == 0 ? this.changesManager.getLastNonEmptyUndo() : this.changesManager.undo();
                        if (result) {
                            this.applyUndoRedoData(result);
                            if (this.options && this.options.onChange) {
                                this.options.onChange();
                            }
                        }
                    }
                    //ContentEditableEditor.placeCaretAtEnd(this.$elem[0]);
                    event.preventDefault();
                    break;
                case 89:
                    if (this.changesManager.canRedo()) {
                        this.applyUndoRedoData(this.changesManager.redo());
                        if (this.options && this.options.onChange) {
                            this.options.onChange();
                        }
                    }
                    //ContentEditableEditor.placeCaretAtEnd(this.$elem[0]);
                    event.preventDefault();
                    break;
                case 37:
                    let sel = document.getSelection();
                    let rng = sel.getRangeAt(0);
                    if (rng && event.shiftKey && rng.startOffset == 0) {
                        event.preventDefault();
                    }
                    else {
                        if (this.handleCtrlArrow(-1, event.shiftKey)) {
                            event.preventDefault();
                        }
                    }
                    break;
                case 39:
                    if (this.handleCtrlArrow(1, event.shiftKey)) {
                        event.preventDefault();
                    }
                    break;
                case 32:
                    this.tryOpenPicker(true);
                    break;
            }
        }
        else {
            if (event.keyCode == 9) {
                event.preventDefault();
                if (! this.disallowTab) {
                    document.execCommand('insertHTML', false, ' &nbsp; &nbsp;');
                    this.changesManager.addStep(this.$elem.html());
                }
            }
            else if (event.keyCode == 32) {
                this.spaceHit = true;
                this.changesManager.addStep(this.$elem.html());
            }
            else if (event.keyCode == 13) {
                if (this._fixChromeBug || navigator.userAgent.toLowerCase().indexOf("firefox") >= 0) {
                    let html0 = this.$elem.html();
                    let sel = document.getSelection();
                    let range0 = sel.rangeCount == 1 ? sel.getRangeAt(0) : null;
                    document.execCommand("insertHTML", false, "<br>");
                    let html1 = this.$elem.html();
                    if (html0 == html1 || (html1 == html0 + "<br>" && !html0.match(/<br>$/))) {
                        let sel = document.getSelection();
                        if (sel.rangeCount == 1) {
                            var range = range0 ? range0 : sel.getRangeAt(0);
                            var nnode = document.createElement("br");
                            range.insertNode(nnode);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                        else {
                            document.execCommand("insertHTML", false, "<br><br>");
                        }
                    }
                    event.preventDefault();
                }
                this.changesManager.addStep(this.$elem.html());
            }
            else if (event.keyCode == 8) {
                this.changesManager.addStep(this.$elem.html(), true);
            }
            else if (event.key == "#") {
                this.tryOpenPicker(false, "#");
            }
            else if (event.key == ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER) {
                this.tryOpenPicker(false, ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER);
            }
            else if (event.key == "F2") {
                this.tryOpenPicker(true);
            }
        }
        
    }
    
    getFirstRange(singleElement: boolean = true): Range {
        let sel = document.getSelection();
        if (!sel || sel.rangeCount == 0) {
            return null;
        }
        let range = sel.getRangeAt(0);
        if (!range) {
            return null;
        }
        if (singleElement) {
            if (range.startContainer != range.endContainer) {
                return null;
            }
        }
        return range;
    }
    
    setSelectedRange(range: Range): boolean {
        let sel = document.getSelection();
        if (!sel) {
            return false;
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }
    
    isInEmptyBrLine(range: Range): boolean {
        return range.startContainer == range.endContainer && range.endContainer == this.$elem[0]
            && range.collapsed && range.startOffset == range.endOffset && this.$elem[0].childNodes.length > range.startOffset;
    }
    
    getLeftText(): string {
        let range = this.getFirstRange();
        if (!range) {
            return "";
        }
        let leftRange = document.createRange();
        leftRange.setStart(this.$elem[0], 0);
        leftRange.setEnd(range.startContainer, range.startOffset);
        let leftText = leftRange.cloneContents().textContent;
        
        // let leftClosingIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "}", true);
        // if (leftClosingIdx >= 0) {
        //     if (leftClosingIdx == leftText.length - 1) {
        //         let leftOpeningIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "{", true);
        //         if (leftOpeningIdx > 0 && leftOpeningIdx < leftClosingIdx
        //             && leftText[leftOpeningIdx - 1] == ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER
        //             && (leftOpeningIdx == 0 || leftText[leftOpeningIdx].match(/^\s$/))) {
        //             leftText = leftText.substr(leftOpeningIdx - 1);
        //         }
        //     }
        // }
        
        return leftText;
    }
    
    getRightText(): string {
        let range = this.getFirstRange();
        if (!range) {
            return "";
        }
        let rightRange = document.createRange();
        rightRange.setStart(range.endContainer, range.endOffset);
        rightRange.setEnd(this.$elem[0], Math.max(0, this.$elem[0].childNodes.length));
        let rightText = rightRange.cloneContents().textContent;
        return rightText;
    }
    
    getCursorInPickerContext(): "task"|"file"|null {
        // Get texts before and after the cursor
        let leftText = this.getLeftText();
        let rightText = this.getRightText();
        
        // Handle task picker
        if (this.isTaskPickerEnabled()) {
            // Get left text + part of the right text that includes task id
            let text =  " " + leftText + rightText.match(/^([0-9]*)/)[1];
            
            // Get task id (may be an empty string)
            // let taskMatch = manuallyTriggered ? text.match(/#([0-9]*)$/) : text.match(/\s#([0-9]*)$/);
            let taskMatch = text.match(/\s#([0-9]*)$/);
            if (taskMatch) {
                return "task";
            }
        }
        
        // Handle file picker
        if (this.isFilePickerEnabled()) {
            // Get left text + part of the right text that includes file id
            //let text = " " + leftText + addCharacter + rightText.match(/^([^\s<]*)/)[1];
            let idx = ContentEditableEditorMetaData.indexOfNotEscaped(rightText, "}");
            leftText = " " + leftText;
            let text = leftText + (idx >= 0 ? rightText.substr(0, idx + 1) : "");
            
            // Get task id (may be an empty string)
            // let fileMatch = manuallyTriggered ? text.match(/:([^\s<:]*)$/) : text.match(/\s:([^\s<:]*)$/);
            const chr = ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER;
            let fileMatch = text.match(new RegExp(`\\s${chr}$`)) || text.match(new RegExp(`\\s${chr}{([^<]*)$`));
            let leftMatch = leftText.match(new RegExp(`\\s${chr}$`)) || leftText.match(new RegExp(`\\s${chr}{([^<]*)$`));
            let leftClosingIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "}", true);
            let leftOpeningIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "{", true);
            let leftTriggerIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, chr, true);
            let isInFileL = leftOpeningIdx > 0 && leftText[leftOpeningIdx - 1] == chr && (leftClosingIdx == leftText.length - 1 || leftClosingIdx < leftOpeningIdx);
            let isInfileR = true;
            let isInFile = isInFileL && isInfileR;
            if (leftTriggerIdx == leftText.length - 1 && !leftText[leftTriggerIdx - 1].match(/^\s$/g)) {
                // return null;
            }
            else if (fileMatch && leftMatch && (leftText[leftText.length - 1] == chr || isInFile)) {
                return "file";
            }
        }
        
        return null;
    }
    
    isCursorInPickerContext(): boolean {
        return !!this.getCursorInPickerContext();
    }
    
    tryOpenPicker(manuallyTriggered: boolean, addCharacter: string = ""): void {
        let rng = this.getFirstRange();
        if (!rng) {
            return;
        }
        if (manuallyTriggered) {
            rng.collapse(true);
        }
        
        let openPickerAtLineStart = manuallyTriggered ? true : ContentEditableEditor.OPEN_PICKER_AT_LINE_START;
        
        let showTaskPickerHint: boolean = false;
        let showFilePickerHint: boolean = false;
        
        // Get texts before and after the cursor
        let leftText = this.getLeftText();
        let rightText = this.getRightText();
        if (!openPickerAtLineStart) {
            leftText = leftText.split("\n").reverse()[0];
            if (leftText == "") {
                return;
            }
        }
        
        // Handle task picker
        if (this.isTaskPickerEnabled() && (addCharacter == "#" || addCharacter == "")) {
            // Get left text + part of the right text that includes task id
            let text = (openPickerAtLineStart ? " " : "") + leftText + addCharacter + rightText.match(/^([0-9]*)/)[1];
            
            // Get task id (may be an empty string)
            // let taskMatch = manuallyTriggered ? text.match(/#([0-9]*)$/) : text.match(/\s#([0-9]*)$/);
            let taskMatch = text.match(/\s#([0-9]*)$/);
            if (taskMatch) {
                let taskId = taskMatch[1];
                let relatedHostHash = typeof(this.options.relatedHostHash) == "function" ? this.options.relatedHostHash() : this.options.relatedHostHash;
                let relatedSectionId = typeof(this.options.relatedSectionId) == "function" ? this.options.relatedSectionId() : this.options.relatedSectionId;
                if (manuallyTriggered || $(document.body).attr("data-auto-task-picker") != "false") {
                    this.options.onRequestTaskPicker(taskId, relatedHostHash, relatedSectionId, this.options.disableCreatingTasks);
                }
                else {
                    showTaskPickerHint = true;
                }
            }
        }
        
        // Handle file picker
        if (this.isFilePickerEnabled() && (addCharacter == ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER || addCharacter == "")) {
            // Get left text + part of the right text that includes file id
            //let text = " " + leftText + addCharacter + rightText.match(/^([^\s<]*)/)[1];
            let idx = ContentEditableEditorMetaData.indexOfNotEscaped(rightText, "}");
            leftText = (openPickerAtLineStart ? " " : "") + leftText + addCharacter;
            let text = leftText + (idx >= 0 ? rightText.substr(0, idx + 1) : "");
            
            // Get task id (may be an empty string)
            // let fileMatch = manuallyTriggered ? text.match(/:([^\s<:]*)$/) : text.match(/\s:([^\s<:]*)$/);
            const chr = ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER;
            let fileMatch = text.match(new RegExp(`\\s${chr}$`)) || text.match(new RegExp(`\\s${chr}{([^<]*)$`));
            let leftMatch = leftText.match(new RegExp(`\\s${chr}$`)) || leftText.match(new RegExp(`\\s${chr}{([^<]*)$`));
            let leftClosingIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "}", true);
            let leftOpeningIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "{", true);
            let leftTriggerIdx = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, chr, true);
            let isInFileL = leftOpeningIdx > 0 && leftText[leftOpeningIdx - 1] == chr && (leftClosingIdx == leftText.length - 1 || leftClosingIdx < leftOpeningIdx);
            let isInfileR = true;
            let isInFile = isInFileL && isInfileR;
            if (leftTriggerIdx == leftText.length - 1 && !leftText[leftTriggerIdx - 1].match(/^\s$/g)) {
                return;
            }
            if (fileMatch && leftMatch && (leftText[leftText.length - 1] == chr || isInFile)) {
                let fm1 = fileMatch[1] ? fileMatch[1] : null;
                if (fm1) {
                    if (ContentEditableEditorMetaData.indexOfNotEscaped(fm1, "}", false) != ContentEditableEditorMetaData.indexOfNotEscaped(fm1, "}", true)) {
                        let idx = ContentEditableEditorMetaData.indexOfNotEscaped(fm1, chr, true);
                        fm1 = fm1.substr(idx + 2);
                    }
                }
                let fileId = fm1 ? chr + "{" + fm1 : "";
                let elementId = "";
                if (fileId && this.meta && this.meta.filePickerData) {
                    let found = this.meta.filePickerData.filter(x => x.userFriendlyId == fileId)[0];
                    if (found) {
                        elementId = found.elementId;
                    }
                }
                let relatedHostHash = typeof(this.options.relatedHostHash) == "function" ? this.options.relatedHostHash() : this.options.relatedHostHash;
                let relatedSectionId = typeof(this.options.relatedSectionId) == "function" ? this.options.relatedSectionId() : this.options.relatedSectionId;
                if (manuallyTriggered || $(document.body).attr("data-auto-file-picker") != "false") {
                    this.options.onRequestFilePicker(elementId, relatedHostHash, relatedSectionId);
                }
                else {
                    showFilePickerHint = true;
                }
            }
        }
        
        // Hint
        if (showTaskPickerHint || showFilePickerHint) {
            this.tryShowHint(showTaskPickerHint ? "task" : "file");
        }
    }
    
    tryShowHint(type: "task"|"file"): void {
        if (this.$elem.attr("contenteditable") == "false") {
            return;
        }
        this.showHint(type);
    }
    
    showHint(type: "task"|"file"): void {
        let pt = this.getCaretTopPoint();
        let i18n = (<any>window).privmx_i18n;
        let hintText = type == "task" ? i18n("contentEditableEditor.showTaskPickerHint", "{0}") : i18n("contentEditableEditor.showFilePickerHint", "{0}");
        hintText = hintText.replace("{0}", `<i class="privmx-icon privmx-icon-${type == "task" ? 'tasks' : 'notes2'}" style="margin-left: 4px;"></i>`);
        let $hint = $(`
            <div style="
                padding: 5px;
                background: #fff;
                border-radius: 3px;
                box-shadow: rgba(0,0,0,0.3) 0 0 5px;
                font-size: var(--font-size);
                position: fixed;
                left: ${pt.left}px;
                z-index: 99999990;
            ">
                ${hintText}
                <i class="fa fa-times" style="
                    margin-left: 2px;
                    opacity: 0.4;
                    cursor: pointer;
                    padding: 4px;
                    font-size: var(--font-size-xs);
                "></i>
            </div>`
        );
        $(document.body).append($hint);
        $hint.find("i.fa-times").on("click", () => {
            if (this.$currentHint) {
                this.$currentHint.remove();
                this.$currentHint = null;
            }
        });
        $hint.css("top", `${pt.top - $hint.outerHeight() - 5}px`);
        this.$currentHint = $hint;
    }
    
    // https://gist.github.com/nothingismagick/642861242050c1d5f3f1cfa7bcd2b3fd
    getCaretTopPoint () {
        const sel = document.getSelection()
        const r = sel.getRangeAt(0)
        let rect
        let r2
        // supposed to be textNode in most cases
        // but div[contenteditable] when empty
        const node: any = r.startContainer
        const offset = r.startOffset
        if (offset > 0) {
            // new range, don't influence DOM state
            r2 = document.createRange()
            r2.setStart(node, (offset - 1))
            r2.setEnd(node, offset)
            // https://developer.mozilla.org/en-US/docs/Web/API/range.getBoundingClientRect
            // IE9, Safari?(but look good in Safari 8)
            rect = r2.getBoundingClientRect()
            return { left: rect.right, top: rect.top }
        }
        else if (offset < node.length) {
            r2 = document.createRange()
            // similar but select next on letter
            r2.setStart(node, offset)
            r2.setEnd(node, (offset + 1))
            rect = r2.getBoundingClientRect()
            return { left: rect.left, top: rect.top }
        }
        else { // textNode has length
            // https://developer.mozilla.org/en-US/docs/Web/API/Element.getBoundingClientRect
            rect = node.getBoundingClientRect()
            const styles = getComputedStyle(node)
            const lineHeight = parseInt(styles.lineHeight)
            const fontSize = parseInt(styles.fontSize)
            // roughly half the whitespace... but not exactly
            const delta = (lineHeight - fontSize) / 2
            return { left: rect.left, top: (rect.top + delta) }
        }
    }
    
    onTaskPickerResult(taskId: string): void {
        let rng = this.getFirstRange();
        if (!rng) {
            return;
        }
        
        // Get number of characters to delete
        let leftText = this.getLeftText();
        let rightText = this.getRightText();
        let rmLeftCount = leftText.match(/([0-9]*)$/)[1].length + 1;
        let rmRightCount = rightText.match(/^([0-9]*)/)[1].length;
        
        // Collapse current selection
        let newRng = rng.cloneRange();
        newRng.collapse(true);
        this.setSelectedRange(newRng);
        
        // Delete unnecessary characters
        this.changesManager.isFrozen = true;
        for (let i = 0; i < rmLeftCount; ++i) {
            document.execCommand("delete");
        }
        for (let i = 0; i < rmRightCount; ++i) {
            document.execCommand("forwardDelete");
        }
        this.changesManager.isFrozen = false;
        
        // Paste task id
        this.pastePlainText("#" + taskId);
    }
    
    onFilePickerResult(data: FilePickerData): void {
        let rng = this.getFirstRange();
        if (!rng) {
            return;
        }
        
        // Get number of characters to delete
        let leftText = this.getLeftText();
        let rightText = this.getRightText();
        let leftIdxOpening = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "{", true);
        let leftIdxClosing = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, "}", true);
        let leftIdxTrigger = ContentEditableEditorMetaData.indexOfNotEscaped(leftText, ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER, true);
        if (leftIdxOpening != -1 && leftIdxClosing != -1 && leftIdxTrigger != -1 && leftIdxOpening < leftIdxClosing && leftIdxTrigger > leftIdxClosing) {
            leftIdxOpening = leftIdxTrigger + 1;
        }
        let rightIdxClosing = ContentEditableEditorMetaData.indexOfNotEscaped(rightText, "}");
        let slashAt = leftIdxOpening < 0 ? leftText.length - 1 : leftIdxOpening - 1;
        if (leftText[slashAt] != ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER) {
            return;
        }
        if (leftIdxClosing == leftText.length - 1) {
            rightIdxClosing = -1;
        }
        let rmLeftCount = leftText.length - slashAt;
        let rmRightCount = rightIdxClosing + 1;
        
        // Collapse current selection
        let newRng = rng.cloneRange();
        newRng.collapse(true);
        this.setSelectedRange(newRng);
        
        // Delete unnecessary characters
        this.changesManager.isFrozen = true;
        for (let i = 0; i < rmLeftCount; ++i) {
            document.execCommand("delete");
        }
        for (let i = 0; i < rmRightCount; ++i) {
            document.execCommand("forwardDelete");
        }
        this.changesManager.isFrozen = false;
        
        // Paste file id
        this.pastePlainText(data.userFriendlyId);
        this.meta.addFilePickerData(data);
    }
    
    handleCtrlArrow(direction: number, shiftKey: boolean): boolean {
        let sel0 = this.getBasicSelectionData();
        if (!sel0) {
            return false;
        }
        
        if (sel0.startElement == sel0.endElement) {
            let p = sel0.startElement.parentElement;
            if (p.childNodes.length > 0) {
            }
            if (p.childNodes.item(0) == sel0.startElement && direction == -1 && sel0.start == 0) {
                return true;
            }
            if (p.childNodes.item(p.childNodes.length - 1) == sel0.startElement && direction == 1 && sel0.start == sel0.maxStart) {
                return true;
            }
        }
        
        setTimeout(() => {
            let sel1 = this.getBasicSelectionData();
            if (!sel1) {
                return;
            }
            let sel = document.getSelection();
            let rng = sel.getRangeAt(0);
            if (sel1.startElement == sel0.startElement && sel1.endElement == sel0.endElement && sel1.start == sel0.start && sel1.end == sel0.end) {
                if (direction == -1) {
                    let d = -sel1.start;
                    rng.setStart(sel1.startElement, Math.min(Math.max(sel1.start + d, 0), sel1.maxStart));
                    if (!shiftKey) {
                        rng.setEnd(sel1.endElement, Math.min(Math.max(sel1.end + d, 0), sel1.maxEnd));
                    }
                }
                else if (direction == 1) {
                    let d = sel1.end;
                    rng.setEnd(sel1.endElement, Math.min(Math.max(sel1.end + d, 0), sel1.maxEnd));
                    if (!shiftKey) {
                        rng.setStart(sel1.startElement, Math.min(Math.max(sel1.start + d, 0), sel1.maxStart));
                    }
                }
            }
            else if (sel1.startElement == sel0.startElement && sel1.endElement == sel0.endElement && sel1.start == sel0.start && sel1.end < sel0.end && shiftKey && direction == -1) {
                rng.setEnd(sel0.endElement, Math.min(Math.max(sel0.end, 0), sel1.maxEnd));
            }
        }, 0);
        return false;
    }
    
    getBasicSelectionData(): { startElement: Node, endElement: Node, start: number, end: number, maxStart: number , maxEnd: number } {
        let sel = document.getSelection();
        if (sel.rangeCount != 1) {
            return null;
        }
        let rng = sel.getRangeAt(0);
        return {
            startElement: rng.startContainer,
            endElement: rng.endContainer,
            start: rng.startOffset,
            end: rng.endOffset,
            maxStart: rng.startContainer ? rng.startContainer.textContent.length : 0,
            maxEnd: rng.endContainer ? rng.endContainer.textContent.length : 0,
        };
    }
    
    checkEndBr() {
        if (this.spaceHit && !this.markCleanEndBr) {
            this.spaceHit = false;
            let html = this.$elem.html();

            if (this.prevHtml.length+5 == html.length) {
                let endsWith = html.substr(html.length-4, 4);

                if (endsWith == "<br>") {
                        this.markCleanEndBr = true;
                }
            } else {
                this.prevHtml = html;
            }
        }
    }
    
    cleanEndBr() {
        if (this.markCleanEndBr) {
            this.markCleanEndBr = false;
            let trimmed = this.$elem.html().substr(0, this.$elem.html().length-4);
            this.prevHtml = trimmed;
            this.$elem.html(trimmed);
            if (this.options && this.options.onChange) {
                this.options.onChange();
            }
        }
    }
    
    focus(caretPosition?: string): void {
        if (caretPosition === "start") {
            ContentEditableEditor.placeCaretAtStart(this.$elem[0]);
        }
        else if (caretPosition === "end") {
            ContentEditableEditor.placeCaretAtEnd(this.$elem[0]);
        }
        else {
            this.$elem.focus();
        }
    }
    
    hasFocus(): boolean {
        return this.$elem.is(":focus");
    }
    
    pastePlainText(text: string): void {
        let htmlData = ContentEditableEditor.processPlainClipboardData(text);
        let html = ContentEditableEditor.safeHtml(htmlData.replace(/\n<br>/g, "<br>"));//.trim();
        ContentEditableEditor.insertHtmlAtCursor(html);
        this.changesManager.addStep(this.$elem.html());
    }
    
    static defaultPasteHandler(event: JQueryEventObject, onPasteSeemsFile: (paths: string[], originalText: string) => void, isDarwin: boolean, data: { text: string, html: string } = null, $el: JQuery = null): boolean {
        let htmlData: string;
        let plainData: string;
        let $elem: JQuery;
        if (event) {
            event.preventDefault();
            let clipData = (<ClipboardEvent>event.originalEvent).clipboardData;
            htmlData = clipData.getData("text/html");
            plainData = clipData.getData("text/plain");
            $elem = <JQuery>$(event.currentTarget);
        }
        else {
            $elem = $el;
            htmlData = data.html;
            plainData = data.text;
        }
        let removeLastBr: boolean = false;
        let isPrivMxHtml = htmlData && htmlData.indexOf(ContentEditableEditor.PRIVMX_COPIED_HTML_PREFIX) >= 0;
        if (plainData && !isPrivMxHtml) {
            // Simple file detection heuristics
            if (onPasteSeemsFile && plainData.indexOf("file:///") == 0 && plainData.split("\n").filter(x => !(<any>x).startsWith("file:///")).length == 0 && plainData.trim() == plainData) {
                // Linux/Dolphin
                onPasteSeemsFile(plainData.split("\n"), plainData);
            }
            else if (onPasteSeemsFile && plainData.indexOf("/") == 0 && plainData.trim() == plainData) {
                // Linux/Nemo
                onPasteSeemsFile(plainData.split("\n").map(x => "file://" + x), plainData);
            }
            else if (onPasteSeemsFile && plainData.trim().indexOf("x-special/nautilus-clipboard") == 0 && plainData.trim().split("\n")[2] && plainData.trim().split("\n")[2].trim().indexOf("file:///") == 0) {
                // Linux/Nautilus
                onPasteSeemsFile(plainData.trim().split("\n").slice(2).map(x => x.trim()), plainData);
            }
            else if (onPasteSeemsFile && isDarwin) {
                // Darwin
                onPasteSeemsFile(null, plainData);
            }
            else {
                htmlData = ContentEditableEditor.processPlainClipboardData(plainData);
            }
        }
        else if (isPrivMxHtml) {
            let isPrivMxContent: boolean = true;
            if (!(<any>htmlData.trim()).startsWith('<meta http-equiv="content-type" content="text/html; charset=utf-8">')) {
                if (plainData) {
                    let asExternalContent = ContentEditableEditor.processHtmlClipboardData(htmlData, false).replace(/<br>/g, "\n");
                    let asPrivmxContent = ContentEditableEditor.processHtmlClipboardData(htmlData, true).replace(/<br>/g, "\n");
                    if (asExternalContent == plainData) {
                        isPrivMxContent = false;
                    }
                    else if (asPrivmxContent == plainData) {
                        isPrivMxContent = true;
                    }
                    else {
                        let asExternalContentCount = (asExternalContent.match(/\n/g) || []).length;
                        let asPrivmxContentCount = (asPrivmxContent.match(/\n/g) || []).length;
                        let plainTextCount = (plainData.replace(/<br>/g, "\n").match(/\n/g) || []).length;
                        if (Math.abs(asExternalContentCount - plainTextCount) < Math.abs(asPrivmxContentCount - plainTextCount)) {
                            isPrivMxContent = false;
                        }
                    }
                }
            }
            htmlData = htmlData.replace(/<span[^>]+>/g, '<span>');
            htmlData = htmlData.replace(/<br[^>]+>/g, '<br>');
            htmlData = ContentEditableEditor.processHtmlClipboardData(htmlData, isPrivMxContent);
            if (!isPrivMxContent && $elem.prop("contenteditable") == "true") {
                let curr = $elem.html();
                if ((<any>curr).endsWith("<br>")) {
                    removeLastBr = true;
                }
            }
        }
        else if (htmlData) {
            ContentEditableEditor.stripHtml(htmlData)
            .then(html => {
                ContentEditableEditor.insertHtmlAtCursor(html);
            });
            
            return true;
        }
        else {
            return false;
        }
        let html = ContentEditableEditor.safeHtml(htmlData.replace(/\n<br>/g, "<br>"));//.trim();
        if (removeLastBr) {
            if ((<any>html).endsWith("<br>")) {
                html = html.substr(0, html.length - 4);
            }
        }
        ContentEditableEditor.insertHtmlAtCursor(html);
        return true;
    }
    
    static stripHtml(html: string): Q.Promise<string> {
        if (html) {
            html = html.replace(/<span[^>]+>/g, '<span>');
            html = html.replace(/<br[^>]+>/g, '<br>');
            html = ContentEditableEditor.processHtmlClipboardData(html, true);
        }
        return Q(html);

        // html = html.replace(/<script[^>]*>[\s\S]*<\/script>/g, "");
        // let iframe = document.createElement("iframe");
        // iframe.setAttribute("src", "data:text/html;base64," + new Buffer(html, "utf8").toString("base64"));
        // iframe.style.position = "absolute";
        // iframe.style.left = "-9999px";
        // iframe.style.top = "-9999px";
        // iframe.style.width = "0px";
        // iframe.style.height = "0px";
        // iframe.style.maxWidth = "0px";
        // iframe.style.maxHeight = "0px";
        // document.body.appendChild(iframe);
        // let def = Q.defer<string>();
        // iframe.addEventListener("load", () => {
        //     let text = iframe.contentDocument.body.innerText;
        //     iframe.remove();
        //     def.resolve(text);
        // });
        // return def.promise;

    }
    
    static processHtmlClipboardData(data: string, isPrivMxContent: boolean): string {
        data = ContentEditableParser.extractBody(data);
        data = clipboardSanitizer.clean(data);
        return ContentEditableEditor.convertTags(data, isPrivMxContent);
    }
    
    static convertTags(data: string, isPrivMxContent: boolean): string {
        let trimmedData = data.trim();
        let nLeadingSpaces = data.indexOf(trimmedData);
        let nTrailingSpaces = data.length - trimmedData.length - nLeadingSpaces;
        data = trimmedData;
        data = data
            .replace(/\>\s+\</gm, '><')
            .replace(/<strong>/gi, '<b>')
            .replace(/<\/strong>/gi, '</b>')
            .replace(/<em>/gi, '<i>')
            .replace(/<\/em>/gi, '</i>')
            .replace(/<h[123456]>/gi, '<p><b>')
            .replace(/<\/h[123456]>/gi, '</b></p>')
            .replace(/<li>/gi, '<br>* ')
            .replace(/<p>/gi, '<div>')
            // .replace(/<p><br><\/p>/gi, '<br>')
            // .replace(/<\/p>((<br>)*)<p>/gi, '$1<br>')
            .replace(/<ul>|<ol>|<\/ol>|<\/li>/gi, '')
            .replace(/<\/p>/gi, '</div>')
            .replace(/<\/ul>|<\/ol>/gi, '<br>');

        data = ContentEditableParser.convertDivsToBrs(data, isPrivMxContent);
        return (<any>" ").repeat(nLeadingSpaces) + data + (<any>" ").repeat(nTrailingSpaces);
    }
    
    static processPlainClipboardData(data: string): string {
        data = formatter.text(data);
        return ContentEditableEditor.convertSpaces(data);
    }
    
    static convertSpaces(data: string): string {
        return data.replace(/[\t]/g, '    ').replace(/[ ]{2}/g, '&nbsp; ');
    }
    
    static utf8ToBase64(str: string) {
        return window.btoa(encodeURIComponent(escape(str)));
    }
    
    static base64ToUtf8( str: string ) {
        return unescape(decodeURIComponent(window.atob(str)));
    }
    
    static convertTasksAndFiles(text: string, taskStatuses: { [taskId: string]: string } = null, metaData: ContentEditableEditorMetaData = null): string {
        if (taskStatuses) {
            text = text.replace(/\B#[0-9]{3,}\b/g, <any>((taskHashId: string) => {
                let taskId = taskHashId.substr(1);
                let status = taskStatuses[taskId];
                if (!status) {
                    return taskHashId;
                }
                return "<span class='task-label task-id task-status-" + status + " has-task-tooltip' data-task-id='" + taskId + "'>" + taskHashId + "</span>";
            }));
        }
        if (metaData) {
            let filePickerData = metaData.filePickerData || [];
            for (let entry of filePickerData) {
                let userFriendlyId: any = entry.userFriendlyId;
                if (userFriendlyId.startsWith(ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER + "{") && userFriendlyId.endsWith("}")) {
                    userFriendlyId = userFriendlyId.substr(2, userFriendlyId.length - 3);
                }
                text = text
                    .split(`${entry.userFriendlyId}`)
                    // .join(`<span class="file-label link" data-meta-data="${btoa(JSON.stringify(entry))}"><i class="${entry.icon||"fa fa-file-o"}"></i>${userFriendlyId}</span>`);
                    .join(`<span class="file-label link" data-meta-data="${this.utf8ToBase64(JSON.stringify(entry))}"><i class="${entry.icon||"fa fa-file-o"}"></i>${userFriendlyId}</span>`);
                }
        }
        return text;
    }
    
    static safeHtml(text: string, relaxed?: boolean, taskStatuses: { [taskId: string]: string } = null, extractMetaData: boolean = false): string {
        let metaData: ContentEditableEditorMetaData = null;
        if (extractMetaData) {
            let res = ContentEditableEditorMetaData.extractMetaFromHtml(text);
            metaData = res.metaData;
            text = res.html;
        }
        //console.trace({extractMetaData,metaData,text})
        text = relaxed ? relaxedSanitizer.clean(text) : restrictedSanitizer.clean(text);
        text = this.convertTasksAndFiles(text, taskStatuses, metaData);
        // if (metaData) {
        //     text = metaData.attach(text);
        // }
        return text;
    }
    
    static safeHtml2(text: string, allowMetaData: boolean = false): string {
        if (allowMetaData) {
            return restrictedSanitizerWithLinkAndMetaData.clean(text);
        }
        return restrictedSanitizerWithLink.clean(text);
    }
    
    static safeMindmapHtml(text: string): string {
        return mindmapSanitizer.clean(text);
    }
    
    static insertTextAtCursor(text: string): void {
        let sel, range, html;
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
        }
    }
    
    static insertHtmlAtCursor(html: string, selectPastedContent?: boolean): void {
        let sel, range;
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();
            let el = document.createElement("div");
            el.innerHTML = html;
            let frag = document.createDocumentFragment(), node, lastNode;
            while ((node = el.firstChild)) {
                lastNode = frag.appendChild(node);
            }
            let firstNode = frag.firstChild;
            range.insertNode(frag);
            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                if (selectPastedContent) {
                    range.setStartBefore(firstNode);
                }
                else {
                    range.collapse(true);
                }
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }
    
    static crossBrowserGetValue(html: string): string {
        html = this.removeLastNewLine(html);
        html = html.replace(/\r/g, "").replace(/\n/g, "<br>");
        if (html.indexOf("<div>") >= 0) {
            html = html.replace(/<div>((<br>)*)<\/div>/g, "$1");
            html = html.replace(/<\/div>((<br>)*)<div>/g, "$1<br>");
            html = html.replace(/<\/?div>/g, "");
        }
        return html;
    }
    
    static removeLastNewLine(html: string): string {
        html = html.replace(/<br>/g, "\n");
        let text = html.replace(/<[^>]*>/g, "");
        if (text.length > 0 && text[text.length - 1] == "\n") {
            let pos = html.lastIndexOf("\n");
            if (pos >= 0) {
                return html.substr(0, pos);
            }
        }
        
        return html;
    }
    
}

function createCaretPlacer(atStart: boolean): (el: HTMLElement) => void {
    return (el: HTMLElement) => {
        el.focus();
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(atStart);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    };
}
