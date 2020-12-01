import {TemplateManager} from "./template/Manager";
import {Helper} from "./template/Helper";
import {ContentEditableEditor} from "./ContentEditableEditor";

export class BasicViewHelper extends Helper {
    
    constructor(framework: TemplateManager) {
        super(framework);
    }
    
    i18n(code: string): string {
        return code;
    }
    
    safeHtml(text: string): string {
        return ContentEditableEditor.safeHtml(text);
    }
    
    safeHtml2(text: string): string {
        return ContentEditableEditor.safeHtml2(text);
    }
    
    formatRichMessage(text: string, contentType: string): string {
        let isHtml = contentType == "html";
        let newText = isHtml ? this.safeHtml(text.trim()) : this.escapeHtmlLight(text.trim());
        let lines = isHtml ? newText.split("<br>") : newText.split("\n");
        let startsWithGt = (line: string) => {
            return line.indexOf(">") == 0 || line.indexOf("&gt;") == 0;
        }
        let result: {lines: string[], quote?: true}[] = [];
        let i: number, len: number, line: string, last: {lines: string[], quote?: true};
        let reQuoteStart = /^(\s*)(On.*wrote|W dniu.*pisze):(\s*)$/;
        for (i = 0, len = lines.length; i < len; i++) {
            line = lines[i];
            if (!result.length) {
                last = {lines: []};
                result.push(last);
            }
            else {
                last = result[result.length - 1];
            }
            if (startsWithGt(line) || (i + 1 < len && startsWithGt(lines[i + 1]) && reQuoteStart.test(line))) {
                if (last.quote) {
                    last.lines.push(line);
                }
                else {
                    last = {
                        lines: [line],
                        quote: true
                    };
                    result.push(last);
                }
            }
            else {
                if (!last.quote) {
                    last.lines.push(line);
                }
                else {
                    last = {lines: [line]};
                    result.push(last);
                }
            }
        }
        let s: string[] = [];
        result.forEach(r => {
            let joined = this.linkify(r.lines.join(isHtml ? "<br>" : "\n"), true);
            if (r.quote) {
                s.push("<div class='message-quote-toggle'><i class='fa fa-caret-right'></i> <span>" + this.i18n("core.toggleQuote") + "</span></div><div class='message-quote selectable' style='display: none;'>" + joined + "</div>");
            }
            else {
                s.push("<div class='message-text-from-user selectable'>" + joined + "</div>");
            }
        });
        let joined2 = s.join("\n");
        return isHtml ? joined2 : this.nl2br(joined2);
    }
    
}
