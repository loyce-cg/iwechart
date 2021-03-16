import {TemplateManager} from "./template/Manager";
import {Helper} from "./template/Helper";
import {Path, ParsedPath} from "../mail/filetree/Path";
import {ContentEditableEditor} from "./ContentEditableEditor";
import {Person} from "../mail/person/Person";
import {SinkIndexEntry} from "../mail/SinkIndexEntry";
import {PasswordStrengthMeter} from "../utils/PasswordStrengthMeter";
import * as privfs from "privfs-client";
import * as $ from "jquery";
import {app} from "../Types";
import {LocaleService, Language} from "../mail/LocaleService";
import {AssetsManager, SimplePluginConfigProvider} from "../app/common/AssetsManager";
import {Lang} from "../utils/Lang";
import { ContentEditableEditorMetaData } from "./ContentEditableEditorMetaData";

export class MailClientViewHelper extends Helper {
    
    static readonly ENABLE_SIMPLE_QUOTES: boolean = false;
    
    localeService: LocaleService;
    assetsManager: AssetsManager;
    uiEventsListener: () => void;
    
    constructor(framework: TemplateManager, public model: app.MailClientViewHelperModel) {
        super(framework);
        if (model.localeService.instance) {
            this.localeService = this.model.localeService.instance;
        }
        else {
            let obj: any = {};
            obj[this.model.localeService.currentLang] = JSON.parse(this.model.localeService.serializedTexts);
            for (let lang of JSON.parse(this.model.localeService.availableLanguages) as Language[]) {
                let langSpec = LocaleService.AVAILABLE_LANGS.filter(x => x.code == lang.code)[0];
                langSpec.isEmpty = lang.isEmpty;
            }
            this.localeService = LocaleService.create(obj);
            this.localeService.setLang(this.model.localeService.currentLang);
        }
        if (model.assetsManager.instance) {
            this.assetsManager = this.model.assetsManager.instance;
        }
        else {
            this.assetsManager = new AssetsManager(
                this.model.assetsManager.rootUrl,
                this.model.assetsManager.pluginRootUrl,
                new SimplePluginConfigProvider(Lang.simpleDeepCopy(this.model.assetsManager.pluginConfigProvider)));
            this.assetsManager.assets = Lang.simpleDeepCopy(this.model.assetsManager.assets);
        }
        this.uiEventsListener = this.model.uiEventsListener ? this.model.uiEventsListener : null;
    }
    
    getAsset(url: string) {
        return this.assetsManager.getAsset(url);
    }
    
    getAssetByName(name: string):string {
        return this.assetsManager.getAssetByName(name);
    }
    
    getPersonAvatar(person: Person) {
        return person.hasAvatar() ? person.getAvatar() : this.getAssetByName("DEFAULT_USER_AVATAR");
    }
    
    getAvatarOrDefault(avatar: string): string {
        return avatar ? avatar : this.getAssetByName("DEFAULT_USER_AVATAR");
    }
    
    timeAgo(date: Date|number|string, withoutSuffix?: boolean): string {
        return this.localeService.timeAgo(date, withoutSuffix);
    }

    timeAgoWithNull(date: Date|number|string, withoutSuffix?: boolean): string {
        if (date == null) {
            return this.localeService.i18n("core.never");
        }
        return this.localeService.timeAgo(date, withoutSuffix);
    }
    
    calendarDate(date: Date|number|string, withTime: boolean = false): string {
        return this.localeService.calendarDate(date, withTime);
    }
    
    safeHtml(text: string): string {
        return ContentEditableEditor.safeHtml(text);
    }
    
    safeHtml2(text: string): string {
        return ContentEditableEditor.safeHtml2(text);
    }
    
    safeMindmapHtml(text: string): string {
        return ContentEditableEditor.safeMindmapHtml(text);
    }
    
    formatRichMessage(text: string, contentType: string, taskStatuses: { [taskId: string]: string } = null, sanitizer: "default" | "safeHtml" | "escapeHtmlLight" | "safeMindmapHtml" = "default", expandedQuotes: number[] = []): string {
        let isHtml = contentType == "html";
        let newText: string;
        let enablePrivMxQuotes: boolean = sanitizer != "safeMindmapHtml";
        let metaData: ContentEditableEditorMetaData = null;
        if (isHtml) {
            let res = ContentEditableEditorMetaData.extractMetaFromHtml(text);
            text = res.html;
            metaData = res.metaData;
        }
        if (sanitizer == "default") {
            newText = isHtml ? this.safeHtml(text.trim()) : this.escapeHtmlLight(text.trim());
        }
        else if (sanitizer == "safeHtml") {
            newText = this.safeHtml(text.trim());
        }
        else if (sanitizer == "escapeHtmlLight") {
            newText = this.escapeHtmlLight(text.trim());
        }
        else if (sanitizer == "safeMindmapHtml") {
            newText = this.safeMindmapHtml(text.trim());
        }
        if (isHtml) {
            newText = ContentEditableEditor.convertTasksAndFiles(newText, taskStatuses, metaData, this.i18n("core.hint.ctrlClickToOpen"));
        }
        let lines = isHtml ? newText.split("<br>") : newText.split("\n");
        let startsWithGt = (line: string) => {
            return line.indexOf(">") == 0 || line.indexOf("&gt;") == 0;
        };
        let startsWithAt = (line: string) => {
            return line.indexOf("@") == 0;
        };
        let result: {lines: string[], quote?: true, privmxQuote?: true, privmxManualQuote?: true}[] = [];
        let i: number, len: number, line: string, last: {lines: string[], quote?: true, privmxQuote?: true, privmxManualQuote?: true};
        let reQuoteStart = /^(\s*)(On.*wrote|W dniu.*pisze):(\s*)$/;
        let rePrivmxQuoteStart = /^@<privmx-quote-header [^>]+>[^<]+<\/privmx-quote-header>$/;
        let rePrivmxManualQuoteStart = /^@[^<]+$/;
        for (i = 0, len = lines.length; i < len; i++) {
            line = lines[i];
            if (!result.length) {
                last = {lines: []};
                result.push(last);
            }
            else {
                last = result[result.length - 1];
            }
            if (startsWithAt(line) && i + 1 < len && startsWithGt(lines[i + 1]) && rePrivmxQuoteStart.test(line)) {
                if (enablePrivMxQuotes) {
                    last = {
                        lines: [line],
                        privmxQuote: true,
                    };
                    result.push(last);
                }
                else {
                    last.lines.push(line);
                }
            }
            else if (startsWithAt(line) && i + 1 < len && startsWithGt(lines[i + 1]) && rePrivmxManualQuoteStart.test(line)) {
                if (enablePrivMxQuotes) {
                    last = {
                        lines: [line],
                        privmxManualQuote: true,
                    };
                    result.push(last);
                }
                else {
                    last.lines.push(line);
                }
            }
            else if (startsWithGt(line) || (i + 1 < len && startsWithGt(lines[i + 1]) && reQuoteStart.test(line))) {
                if (last.quote || (last.privmxQuote || last.privmxManualQuote)) {
                    last.lines.push(line.replace(/^(>|&gt;)/, ""));
                }
                else if (MailClientViewHelper.ENABLE_SIMPLE_QUOTES) {
                    last = {
                        lines: [line],
                        quote: true
                    };
                    result.push(last);
                }
                else {
                    last.lines.push(line);
                }
            }
            else {
                if (!last.quote && !(last.privmxQuote || last.privmxManualQuote)) {
                    last.lines.push(line);
                }
                else {
                    last = {lines: [line]};
                    result.push(last);
                }
            }
        }
        let s: string[] = [];
        let quoteId: number = 0;
        result.forEach(r => {
            if (r.quote) {
                let first = this.linkify(r.lines[0].replace(/^(>|&gt;)/, ""));
                let joined = this.linkify(r.lines.slice(1).join(isHtml ? "<br>" : "\n"), true);
                s.push("<div class='message-quote-toggle'><i class='fa fa-caret-right'></i> <span>" + this.i18n("core.toggleQuote") + "</span></div><div class='message-quote selectable' style='display: none;'>" + first + "<div class='quote'>" + joined + "</div>" + "</div>");
            }
            else if (r.privmxQuote || r.privmxManualQuote) {
                let header = r.lines[0];
                let joined = this.linkify(r.lines.slice(1).join(isHtml ? "<br>" : "\n"), true);
                let attrs: { [key: string]: string} = {};
                if (r.privmxQuote) {
                    /<privmx-quote-header ([^>]+)>/.exec(header)[1]
                        .split(" ")
                        .map(x => x.split("="))
                        .map(x => [x[0], x[1].substr(1, x[1].length - 2)])
                        .forEach(([key, value]) => {
                            if ((<any>key).startsWith("data-")) {
                                key = key.substr("data-".length);
                            }
                            key = $.camelCase(key);
                            attrs[key] = value;
                        });
                    attrs.username = header.substr(1).replace(/<[^>]+>/g, "");
                }
                else if (r.privmxManualQuote) {
                    let userId = header.substr(1);
                    attrs.hashmail = userId;
                    attrs.username = userId;
                }
                let headerDateText = attrs.timestamp ? `, ${this.dateWithHourLocal(attrs.timestamp)}:` : '';
                let tooltipTriggerAttr = attrs.hashmail && attrs.hashmail.indexOf("#") >= 0 ? `data-tooltip-trigger="${attrs.hashmail}"` : "";
                
                let isQuoteExpanded: boolean = expandedQuotes.indexOf(quoteId) >= 0;
                let html = `
                    <div class="privmx-quote ${isQuoteExpanded ? 'expanded' : ''}" data-quote-id="${quoteId}">
                        <div class="privmx-quote-header">
                            <div class="privmx-quote-header-user">
                                <canvas class="not-rendered" data-width="15" data-height="15" data-auto-size="true" data-hashmail-image="${attrs.hashmail}" ${tooltipTriggerAttr} data-auto-refresh="true"></canvas>
                                <span>${attrs.username}</span>
                                <div class="privmx-quote-goto-message"><i class="fa fa-quote-right"></i></div>
                            </div>
                            <div class="privmx-quote-header-date">
                                ${headerDateText}
                            </div>
                        </div>
                        <div class="privmx-quote-text selectable">${joined}</div>
                    </div>
                `.trim();
                s.push(html);
                quoteId++;
            }
            else {
                let joined = this.linkify(r.lines.join(isHtml ? "<br>" : "\n"), true);
                s.push("<div class='message-text-from-user selectable'>" + joined + "</div>");
            }
        });
        let s2 = s.filter(x => x != "<div class='message-text-from-user selectable'></div>");
        let joined2 = (s2.length > 0 ? s2 : s).join("\n");
        return isHtml ? joined2 : this.nl2br(joined2);
    }
    
    formatMessage(text: string, contentType: string): string {
        let isHtml = contentType == "html";
        let newText = isHtml ? this.safeHtml(text) : this.escapeHtmlLight(text);
        let withLinks = this.linkify(newText, true);
        return isHtml ? withLinks : this.nl2br(withLinks);
    }
    
    parsePath(path: string): ParsedPath {
        return Path.parsePath(path);
    }
    
    i18n(key: string, ...args: any[]): string {
        return this.localeService.i18n.apply(this.localeService, arguments);
    }
    
    i18nGetMatchingKeys(keyPrefix: string, returnFullKeys: boolean = true): string[] {
        return this.localeService.i18nGetMatchingKeys.apply(this.localeService, [keyPrefix, returnFullKeys]);
    }
    
    getAvailableLangs(): string[] {
        return this.localeService.availableLangs.slice();
    }
    
    getTaskName(taskName: string): string {
        return this.localeService.getTaskName(taskName);
    }
    
    currentLang(): string {
        return this.localeService.currentLang;
    }
    
    shortDescription(description: string): string {
        if (description) {
            return description.split("\n")[0].trim();
        }
    }
    
    version(): string {
        return this.model.version;
    }
    
    isDemo(): boolean {
        return this.model.isDemo;
    }
    
    // isAdmin(): boolean {
    //     return this.app.mailClientApi.isAdmin();
    // }
    
    yesNo(val: boolean): string {
        return val ? this.i18n("core.bool.yes") : this.i18n("core.bool.no");
    }
    
    turnOnOff(val: boolean): string {
        return val ? this.i18n("core.turn.on") : this.i18n("core.turn.off");
    }
    
    lastTime(millisecondsArg: number|string): string {
        let milliseconds = typeof(millisecondsArg) == "string" ? parseInt(millisecondsArg) : millisecondsArg;
        let date = new Date(milliseconds);
        if (milliseconds < 1000) {
            return milliseconds + "ms";
        }
        else if (milliseconds < 60000) {
            let afterComa = Math.round(date.getUTCMilliseconds() / 100);
            return date.getUTCSeconds() + (afterComa == 0 ? "" : "." + afterComa) + "s";
        }
        else if (milliseconds < 3600000) {
            let seconds = date.getUTCSeconds();
            return date.getUTCMinutes() + "m" + (seconds > 0 ? " " + seconds + "s" : "");
        }
        else if (milliseconds < 86400000) {
            let hours = Math.floor(milliseconds / 3600000);
            let minutes = date.getUTCMinutes();
            return hours + "h" + (minutes > 0 ? " " + minutes + "m" : "");
        }
        else {
            let days = Math.floor(milliseconds / 86400000);
            let hours = date.getUTCHours();
            return days + "d" + (hours > 0 ? " " + hours + "h" : "");
        }
    }
    
    getSinkDisplayName(sink: privfs.message.MessageSinkPriv): string {
        if (sink.extra.type == "inbox") {
            return this.i18n("core.sink.inbox");
        }
        else if (sink.extra.type == "outbox") {
            return this.i18n("core.sink.outbox");
        }
        else if (sink.extra.type == "trash") {
            return this.i18n("core.sink.trash");
        }
        else if (sink.extra.type == "form") {
            return sink.name;
        }
        return sink.name;
    }
    
    getSecureFormName(indexEntry: SinkIndexEntry): string {
        let sink = indexEntry.getOriginalSink();
        return this.i18n("core.formSender", sink ? sink.name : indexEntry.getOriginalSinkId());
    }
    
    getDefaultHost(): string {
        return this.model.defaultHost;
    }
    
    stringIsNullOrTrimmedEmpty(str: string): boolean {
        return str == null || (typeof(str) == "string" && str.trim() == "");
    }
    
    isContextMenuBlocked(): boolean {
        return this.model.isContextMenuBlocked;
    }
    
    getUIEventsListener(): () => void {
        return this.uiEventsListener;
    }
    
    openLinksByController(): boolean {
        return this.model.openLinksByController;
    }
    
    createPasswordStrengthMeter(): PasswordStrengthMeter {
        return new PasswordStrengthMeter(this.localeService);
    }

    onTextAreaCopyClick(e: MouseEvent) {
        let $e = $(e.target).closest("[data-copy-textarea-id]");
        let textareaId = $e.data("copy-textarea-id");
        let textarea = document.getElementById(textareaId);
        let $textarea = $(textarea);
        $textarea.select();
        let successful = false;
        try {
            successful = document.execCommand("copy");
        }
        catch (err) {
        }
    }

    
    onCopyClick(e: MouseEvent) {
        let $e = $(e.target).closest("[data-copy]");
        let value = $e.data("copy");
        let textarea = document.createElement("textarea");
        textarea.style.position = 'fixed';
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.width = '2em';
        textarea.style.height = '2em';
        textarea.style.padding = "0";
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        textarea.value = value;
        document.body.appendChild(textarea);
        textarea.select();
        let successful = false;
        try {
            successful = document.execCommand("copy");
        }
        catch (err) {
        }
        document.body.removeChild(textarea);
        if (successful) {
            let $span = $e.find("> span");
            let $txt = $e.find("span.txt");
            let $ico = $e.find("i");
            let timeout = 200;
            $span.fadeOut(timeout, () => {
                $txt.text(this.i18n("core.copied"));
                $ico.attr("class", "fa fa-check");
                $span.fadeIn(timeout, () => {
                    setTimeout(() => {
                        $span.fadeOut(timeout, () => {
                            $txt.text(this.i18n("core.copy"));
                            $ico.attr("class", "fa fa-copy");
                            $span.fadeIn(timeout);
                        });
                    }, 1000);
                });
            });
        }
    }
    
    getMaxTooltipYPos(e: MouseEvent, windowHeight: number, avatarBoxHeight: number) {
        const margin = 40;
        let tooltipBottomY = avatarBoxHeight + e.clientY;
        
        let maxClientY = e.clientY;
        if (tooltipBottomY > windowHeight - margin) {
            maxClientY = e.clientY - (tooltipBottomY - windowHeight) - margin;
        }
        return maxClientY;
    }
    
    getMaxTooltipPos(margin: number, client: number, windowSize: number, avatarBoxSize: number) {
        let tooltipPos = avatarBoxSize + client;
        
        let maxClientPos = client;
        if (tooltipPos > windowSize - margin) {
            maxClientPos = client - (tooltipPos - windowSize) - margin;
        }
        return maxClientPos;
    }
    
    selectInputContent(element: HTMLElement, document:any) {
        let doc = document;
        if (!element)
            return;
        if (window.getSelection) {
             let selection = window.getSelection();
             let range = document.createRange();
             range.selectNodeContents(element);
             selection.removeAllRanges();
             selection.addRange(range);
             return;
        }
        //IE only feature
        let documentBody = <any>doc.body;
        if (!documentBody.createTextRange) {
             let range = documentBody.createTextRange();
             range.moveToElementText(element);
             range.select();
        }
    }
    
    placeInputCaretAtEnd(el: HTMLElement, document:any) {
        let doc = document;
        let documentBody = <any>doc.body;
        if (typeof window.getSelection != "undefined"
                && typeof document.createRange != "undefined") {
            let range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            let sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (typeof documentBody.createTextRange != "undefined") {
            var textRange = documentBody.createTextRange();
            textRange.moveToElementText(el);
            textRange.collapse(false);
        }
    }
}
