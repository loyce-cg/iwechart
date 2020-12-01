import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as attachmentsInfoboxTemplate} from "./template/attachments-infobox.html";
import {func as attachmentsTemplate} from "./template/attachments.html";
import {func as sinkSuggestionTemplate} from "./template/sink-suggestion.html";
import * as $ from "jquery";
import {ContentEditableEditor} from "../../web-utils/ContentEditableEditor";
import {Model, Receiver, ReceiverError} from "./ComposeWindowController";
import {Contact, ContactProfile} from "../../mail/contact/Contact";
import {Lang} from "../../utils/Lang";
import * as privfs from "privfs-client";
import {app} from "../../Types";
require("typeahead.js");

export interface AutocompleteEntry {
    displayName: string;
    hashmail: string;
    profile: ContactProfile;
    starred: boolean;
    email: boolean;
    getDisplayString: () => string;
    displayString?: string;
    sink?: privfs.message.MessageSink;
}

@WindowView
export class ComposeWindowView extends BaseWindowView<Model> {
    
    inputs: {[id: number]: JQuery};
    inputLastId: number;
    messageEditor: ContentEditableEditor;
    $attachmentsInfobox: JQuery;
    contacts: Contact[];
    $toInputFieldTemplate: JQuery;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.$main.on("input", "[name=subject]", this.onSubjectChange.bind(this));
        this.$main.on("click", "[data-action=send]", this.onSendClick.bind(this));
        this.$main.on("click", "[data-action=add-attachment]", this.onAddAttachmentClick.bind(this));
        this.$main.on("click", "[data-action=add-recipient-field]", this.onAddRecipientClick.bind(this));
        this.$main.on("click", ".attachments .delete", this.onDeleteAttachmentClick.bind(this));
        this.$main.on("click", ".attachment-link", this.onDownloadAttachmentClick.bind(this));
        
        this.inputs = {};
        this.inputLastId = 0;
        let $messageEditor = this.$main.find("[data-role=message-field]");
        this.messageEditor = new ContentEditableEditor($messageEditor);
        this.$attachmentsInfobox = this.templateManager.createTemplate(attachmentsInfoboxTemplate).renderToJQ();
        this.contacts = model.contacts;
        this.$toInputFieldTemplate = this.$main.find(".field-to:last").clone();
        this.$main.find("[name=hashmail]").each((_idx, input) => {
            this.bindHashmailAutocomplete($(input));
        });
        this.addPredefinedReceivers(model.receivers);
        this.setSubject(model.subject);
        this.setText(model.text);
        this.renderAttachments(model.attachments);
        this.focus();
    }
    
    renderAttachments(attachments: privfs.lazyBuffer.IContent[]): void {
        if (attachments.length == 0) {
            this.$main.find(".meta").removeClass("with-attachments");
        }
        else {
            this.$main.find(".meta").addClass("with-attachments");
        }
        this.$main.find(".attachments").content(this.templateManager.createTemplate(attachmentsTemplate).renderToJQ({attachments: attachments}));
    }
    
    showMultipleReceivers(entries: ReceiverError[]): void {
        let $hashmails = this.$main.find("[name=hashmail]");
        for (let i = 0; i < entries.length; i++) {
            let entry = entries[i];
            let field = $hashmails.get(entry.index);
            if (field == null) {
                return;
            }
            this.toggleHashmailInputToSelect($(field), entry.receivers);
            return;
        }
    }
    
    setEncryptedMessageText(enc: string): void {
        let editor = this.messageEditor;
        editor.setData("real-value", editor.getValue());
        editor.setValue(enc);
        editor.addClass("encrypted");
    }
    
    unsetEncryptedMessageText(): void {
        let editor = this.messageEditor;
        if (editor.hasClass("encrypted")) {
            editor.setValue(editor.getData("real-value"));
            editor.removeClass("encrypted");
        }
    }
    
    toggleInput(inputId: number, receiver: privfs.message.MessageReceiver): void {
        let $input = this.inputs[inputId];
        if ($input == null) {
            return;
        }
        let entry = this.convertReceiverToAutocompleteEntry(receiver);
        this.toggleHashmailInputToReceiverInput($input, receiver, entry);
        this.addAnotherRecipientFieldOrFocusOnExistingOne();
    }
    
    updateContactList(contacts: Contact[]): void {
        this.contacts = contacts;
    }
    
    formIsDirty(): boolean {
        if (this.messageEditor.isDirty()) {
            return true;
        }
        return this.$main.find("input,textarea").toArray().some(input => {
            let $input = $(input);
            let defaulValue = $input.data("defaultvalue") || '';
            let value = (<string>$input.val()) || '';
            return defaulValue != value;
        });
    }
    
    showAttachmentsInfobox(): void {
        this.$attachmentsInfobox.appendTo(this.$main);
    }
    
    hideAttachmentsInfobox(): void {
        this.$attachmentsInfobox.detach();
    }
    
    onSubjectChange(): void {
        this.triggerEvent("subjectChange", <string>this.$main.find("[name=subject]").val());
    }
    
    onSendClick(event: JQuery): void {
        let subject = (<string>this.$main.find("[name=subject]").val()).trim();
        let text = this.messageEditor.getValue().trim();
        let receivers: Receiver[] = [];
        this.$main.find("[name=hashmail]").each((idx, field) => {
            let $field = $(field);
            let receiver = $field.data("receiver");
            let value = receiver || (<string>$field.val()).trim().toLowerCase();
            if (value) {
                receivers.push(value);
            }
        });
        this.triggerEvent("send", subject, text, receivers);
    }
    
    onAddAttachmentClick(): void {
        this.triggerEventInTheSameTick("addAttachments");
    }
    
    onAddRecipientClick(): void {
        this.addAnotherRecipientField(true);
    }
    
    onDeleteAttachmentClick(event: JQueryMouseEventObject): void {
        let idx = this.$main.find(".attachments .delete").index(event.target);
        this.triggerEvent("deleteAttachment", idx);
    }
    
    onDownloadAttachmentClick(event: JQueryMouseEventObject): void {
        let idx = this.$main.find(".attachment-link").index(event.target);
        this.triggerEvent("downloadAttachment", idx);
    }
    
    addPredefinedReceivers(receivers: Receiver[]) {
        let $inputs = this.$main.find("[name=hashmail]");
        receivers.forEach((receiver, idx) => {
            let $input = $inputs.eq(idx);
            if (!$input.length) {
                $input = this.addAnotherRecipientField().find("[name=hashmail]");
            }
            if (typeof(receiver) == "string") {
                let contact = Lang.find(this.contacts, x => x.getHashmail() == receiver);
                if (contact != null) {
                    let entry = ComposeWindowView.convertContactToAutocompleteEntry(contact);
                    this.toggleHashmailInputToReceiverInput($input, receiver, entry);
                    $input.data("defaultvalue", entry.getDisplayString.call(entry));
                }
                else if (receiver.indexOf("@") != -1) {
                    let entry = ComposeWindowView.getAutocompleteEntryFromEmail(receiver);
                    this.toggleHashmailInputToReceiverInput($input, receiver, entry);
                    $input.data("defaultvalue", entry.getDisplayString.call(entry));
                }
                else {
                    $input.data("defaultvalue", receiver).typeahead("val", receiver);
                }
            }
            else {
                let entry = this.convertReceiverToAutocompleteEntry(receiver);
                this.toggleHashmailInputToReceiverInput($input, receiver, entry);
                $input.data("defaultvalue", entry.getDisplayString.call(entry));
            }
        });
        this.addAnotherRecipientField(false);
    }
    
    setInputDefaultValue(name: string, value: string): void {
        this.$main.find("[name='" + name + "']:first").data("defaultvalue", value).val(value);
    }
    
    setSubject(subject: string): void {
        this.setInputDefaultValue("subject", subject);
        this.onSubjectChange();
    }
    
    setText(text: string): void {
        text = this.helper.nl2br(text);
        let html = this.helper.safeHtml(text).trim();
        this.messageEditor.setValue(html, true);
    }
    
    addAnotherRecipientField(focus?: boolean): JQuery {
        let $field = this.$toInputFieldTemplate.clone();
        let $input = $field.find("[name=hashmail]");
        this.$main.find(".fields-to").append($field);
        this.bindHashmailAutocomplete($input);
        if (focus) {
            $input.focus();
        }
        if (this.$main.find(".field-to").length > 3) {
            this.$main.find(".fake-field-to").hide();
        }
        else {
            this.$main.find(".fake-field-to").show();
        }
        return $field;
    }
    
    addAnotherRecipientFieldOrFocusOnExistingOne(): void {
        let $fields = this.$main.find(".fields");
        let $inputs = $fields.find("[name=hashmail]:not(:disabled)");
        let focused = false;
        $inputs.each((idx, elem: HTMLInputElement) => {
            if (!elem.value) {
                elem.focus();
                focused = true;
                return false;
            }
        });
        if (!focused) {
            this.addAnotherRecipientField(true);
        }
    }
    
    bindHashmailAutocomplete($input: JQuery) {
        let inputId = ++this.inputLastId;
        $input.data("input-id", inputId);
        this.inputs[inputId] = $input;
        $input.off();
        $input.removeData();
        $input.typeahead<AutocompleteEntry>({
            minLength: 1,
            highlight: true,
            hint: true
        }, {
            name: "contacts",
            source: this.hashmailAutocompleteMatcher.bind(this),
            templates: {suggestion: this.hashmailAutocompleteSuggestionTemplate()},
            display: (model: AutocompleteEntry) => {
                return model.getDisplayString();
            },
            limit: 100000
        });
        $input.on("typeahead:select", (event, model: AutocompleteEntry) => {
            $input.typeahead('close');
            if (model.sink) {
                this.triggerEvent("sinkSelect", inputId, model.hashmail, model.sink);
            }
            else {
                this.toggleHashmailInputToReceiverInput($input, model.hashmail, model);
                this.addAnotherRecipientFieldOrFocusOnExistingOne();
            }
        });
        $input.on("typeahead:autocomplete", (event, model: AutocompleteEntry) => {
            if (model.sink) {
                this.triggerEvent("sinkSelect", inputId, model.hashmail, model.sink);
            }
            else {
                let $menuToHide = $input.data('tt-menu');
                                
                this.toggleHashmailInputToReceiverInput($input, model.hashmail, model);
                this.addAnotherRecipientFieldOrFocusOnExistingOne();
                
                this.hideAutocompletionMenu($menuToHide);
            }
        });
        let $ttMenu = $input.siblings(".tt-menu");
        $input.data("tt-menu", $ttMenu);
        $ttMenu.detach().appendTo(this.$main.find(".meta"));
        $input.siblings("pre").remove();
        $input.on("typeahead:open typeahead:render", event => {
            let $ttMenu = $input.data("tt-menu");
            let $fields = $input.closest(".fields-to");
            let maxTop = $fields.outerHeight();
            let top = Math.min($input.closest(".input").position().top + $input.outerHeight() - $fields.scrollTop(), maxTop);
            $ttMenu.css({top: top});
        });
        $input.on("keydown", event => {
            let $inputs = $input.closest(".fields").find("[name=hashmail]:not(:disabled)");
            if (event.keyCode == 8) {
                if ((<string>$input.val()) == "" && $inputs.length > 1) {
                    $input.closest(".field").remove();
                    this.unbindHashmailAutocomplete($input);
                    this.$main.find(".fields-to").find("[name=hashmail]:not(:disabled)").last().focus();
                    event.preventDefault();
                }
            }
            else if (event.keyCode == 13) {
                if (!$ttMenu.find(".tt-cursor").length && (<string>$input.val()) != "") {
                    this.addAnotherRecipientFieldOrFocusOnExistingOne();
                }
            }
        });
    }
    
    hideAutocompletionMenu($ttMenu: JQuery):void{
        $ttMenu.hide();
    }
    
    unbindHashmailAutocomplete($input: JQuery): void {
        delete this.inputs[$input.data("input-id")];
        $input.typeahead("destroy");
    }
    
    hashmailAutocompleteSuggestionTemplate(): (model: AutocompleteEntry) => string {
        let template = this.templateManager.createTemplate(sinkSuggestionTemplate);
        return (model: AutocompleteEntry) => {
            return template.render(model);
        };
    }
    
    static buildDisplayString = function(this: AutocompleteEntry): string {
        if (!this.displayString) {
            if (this.displayName) {
                this.displayString = this.displayName + " <" + this.hashmail + ">";
            }
            else {
                this.displayString = this.hashmail;
            }
            if (this.sink && this.sink.name) {
                this.displayString += " - " + this.sink.name;
            }
        }
        return this.displayString;
    }
    
    static convertContactToAutocompleteEntry(contact: Contact): AutocompleteEntry {
        return {
            displayName: contact.hasName() ? contact.getDisplayName() : "",
            hashmail: contact.getHashmail(),
            profile: contact.profile,
            starred: contact.isStarred(),
            email: contact.isEmail(),
            getDisplayString: ComposeWindowView.buildDisplayString
        };
    }
    
    static getAutocompleteEntryFromEmail(email: string): AutocompleteEntry {
        return {
            displayName: "",
            hashmail: email,
            profile: null,
            starred: false,
            email: true,
            getDisplayString: ComposeWindowView.buildDisplayString
        };
    }
    
    convertReceiverToAutocompleteEntry(receiver: privfs.message.MessageReceiver): AutocompleteEntry {
        let contact = Lang.find(this.contacts, x => x.getHashmail() == receiver.user.hashmail);
        if (contact != null) {
            return ComposeWindowView.convertContactToAutocompleteEntry(contact);
        }
        return {
            displayName: receiver.user.name,
            hashmail: receiver.user.hashmail,
            profile: {
                name: receiver.user.name
            },
            starred: false,
            email: false,
            getDisplayString: ComposeWindowView.buildDisplayString
        };
    }
    
    hashmailAutocompleteMatcher(query: string, cb: (matches: AutocompleteEntry[]) => void): void {
        let options: AutocompleteEntry[] = [], matches: AutocompleteEntry[] = [];
        this.contacts.forEach(contact => {
            options.push(ComposeWindowView.convertContactToAutocompleteEntry(contact));
        });
        options.forEach(model => {
            let searchable: string[] = [];
            if (model.displayName) {
                searchable.push(model.displayName);
            }
            searchable.push(model.hashmail);
            if (model.sink && model.sink.name) {
                searchable.push(model.sink.name, model.sink.description || "", model.sink.id);
            }
            searchable = searchable.map(s => {
                return s.replace(/\s\s+/g, " ").trim().toLowerCase();
            });
            searchable.some(str => {
                if (str.indexOf(query.toLowerCase()) > -1) {
                    matches.push(model);
                    return true;
                }
            });
        });
        matches.sort((a, b) => {
            if (a.starred && !b.starred) {
                return -1;
            }
            if (b.starred && !a.starred) {
                return 1;
            }
            if (a.email != b.email) {
                return a.email ? 1 : -1;
            }
            return a.getDisplayString().toLowerCase().localeCompare(b.getDisplayString().toLowerCase());
        });
        cb(matches);
    }
    
    toggleHashmailInputToSelect($input: JQuery, receivers: privfs.message.MessageReceiver[]): void {
        let $select = $("<select>").attr("name", "hashmail");
        let $defaultOption = $("<option>");
        $defaultOption.text(this.i18n("window.compose.selectInbox.label", [receivers[0].user.hashmail])).hide();
        $select.append($defaultOption);
        receivers.forEach((receiver, index) => {
            let $option = $("<option>");
            $option.val(index);
            $option.text(receiver.user.hashmail + " - " + receiver.sink.name);
            $select.append($option);
        });
        $select.on("change", () => {
            let receiver = receivers[parseInt(<string>$select.val())];
            $select.data("receiver", receiver);
            this.focus();
        });
        let $closer = $("<span>&times;</span>").addClass("closer");
        let $parent = $input.closest(".input");
        if ($parent.hasClass("with-receiver")) {
            this.toggleReceiverInputToInput($input);
        }
        let $inputWrapper = $input.closest(".twitter-typeahead");
        $select.data("input", $inputWrapper);
        $parent.addClass("with-select");
        $inputWrapper.before($select).detach();
        $select.after($closer);
        $select.focus();
        $closer.on("click", () => {
            this.toggleHashmailSelectToInput($select);
        });
    }
    
    toggleHashmailInputToReceiverInput($input: JQuery, receiver: Receiver, model: AutocompleteEntry): void {
        this.unbindHashmailAutocomplete($input);
        let $parent = $input.closest(".input");
        $parent.addClass("with-receiver");
        $input.prop("disabled", true);
        $input.val(model.getDisplayString.call(model));
        $input.data("receiver", receiver);
        let $closer = $("<span>&times;</span>").addClass("closer");
        $input.after(this.templateManager.createTemplate(sinkSuggestionTemplate).renderToJQ(model));
        $input.after($closer);
        $closer.on("click", () => {
            this.toggleReceiverInputToInput($input);
        });
        let $parentWrapper = $parent.closest(".field");
        let $nextWrapper;
        let focused = false;
        while (true) {
            $nextWrapper = $parentWrapper.next();
            if (!$nextWrapper.length) {
                break;
            }
            if ($nextWrapper.hasClass("with-receiver") || $nextWrapper.hasClass("with-select")) {
                continue;
            }
            $nextWrapper.find("input").focus();
            focused = true;
            break;
        }
        if (!focused) {
            this.focus();
        }
    }
    
    jqueryFindNextPrev($parent: JQuery, func: ($e: JQuery) => boolean): void {
        let $e = $parent;
        while ($e.length > 0) {
            $e = $e.next();
            if (func($e)) {
                return;
            }
        }
        $e = $parent;
        while ($e.length > 0) {
            $e = $e.prev();
            if (func($e)) {
                return;
            }
        }
    }
    
    toggleReceiverInputToInput($input: JQuery): void {
        let $parent = $input.closest(".input");
        if (this.$main.find(".field-to").length > 2) {
            let $field = $parent.closest(".field-to");
            this.jqueryFindNextPrev($field, ($e) => {
                let $input = $e.find(".input")
                if ($input.hasClass("with-receiver") || $input.hasClass("with-select")) {
                    return false;
                }
                $input.find("input").focus();
                return true;
            });
            $field.remove();
        }
        else {
            $input.data("receiver", null);
            $parent.find(".closer").remove();
            $parent.find(".sink-suggestion").remove();
            $parent.removeClass("with-receiver");
            $input.prop("disabled", false);
            $input.val("");
            this.bindHashmailAutocomplete($input);
            $input.focus();
        }
    }
    
    toggleHashmailSelectToInput($select: JQuery): void {
        let $input = $select.data("input");
        let $parent = $select.closest(".input");
        $parent.find(".closer").remove();
        $select.before($input).remove();
        $parent.removeClass("with-select");
        $input.focus();
    }
    
    focus(): void {
        if (document.activeElement.tagName != "BODY") {
            return;
        }
        let $inputToFocus: JQuery;
        this.$main.find("[name=hashmail]").each((idx, input) => {
            let $input = $(input);
            if ((<string>$input.val()).trim()) {
                return false;
            }
            if (!$inputToFocus) {
                $inputToFocus = $input;
            }
        });
        if ($inputToFocus) {
            $inputToFocus.focus();
        }
        else if (!(<string>this.$main.find("[name=subject]").val()).trim()) {
            this.$main.find("[name=subject]").focus();
        }
        else {
            this.messageEditor.focus();
        }
    }
}
