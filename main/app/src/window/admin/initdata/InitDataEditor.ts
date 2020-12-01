import * as $ from "jquery";
import {Lang} from "../../../utils/Lang";
import {InitDataView} from "./InitDataView";
import {func as mainTemplate} from "./template/initdata.html";
import {func as contentTemplate} from "./template/initdata-content.html";
import {func as menuLangsTemplate} from "./template/initdata-langs.html";
import {func as contactTemplate} from "./template/initdata-contact.html";
import {func as fileTemplate} from "./template/initdata-file.html";
import {func as mailTemplate} from "./template/initdata-mail.html";
import {TemplateManager} from "../../../web-utils/template/Manager";
import {MailClientViewHelper} from "../../../web-utils/MailClientViewHelper";
import {ContentEditableEditor} from "../../../web-utils/ContentEditableEditor";
import * as privfs from "privfs-client";
import {webUtils} from "../../../Types"
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.window.admin.initdata.InitDataEditor");;

export interface Contact {
    hashmail: string;
}

export interface File {
    name: string;
    content: string;
    mimetype: string;
}

export interface Mail {
    subject: string;
    content: string;
}

export interface LangData {
    name: string;
    isDefaultLang: boolean;
    contacts: Contact[];
    files: File[];
    mails: Mail[];
}

export interface LangModel {
    lang: LangData;
    isDefaultLang: boolean;
    mailsEnabled: boolean;
}

export interface LangsMenuModel {
    langs: string[];
    activeLang: string;
}

export class InitDataEditor {
    
    templates: {
        main: webUtils.MailTemplate<void>;
        content: webUtils.MailTemplate<LangModel>;
        menuLangs: webUtils.MailTemplate<LangsMenuModel>;
        contact: webUtils.MailTemplate<Contact>;
        file: webUtils.MailTemplate<File>;
        mail: webUtils.MailTemplate<Mail>;
    };
    templateManager: TemplateManager;
    helper: MailClientViewHelper;
    view: InitDataView;
    $container: JQuery;
    langs: LangData[];
    defaultLang: string;
    currentLang: string;
    mailsEnabled: boolean;
    savingData: {langs: LangData[], formLang: LangData};
    
    constructor(options: {view: InitDataView, $container: JQuery, templateManager: TemplateManager}) {
        this.view = options.view;
        this.$container = options.$container;
        this.templateManager = options.templateManager;
        this.helper = this.templateManager.getHelperByClass(MailClientViewHelper);
        this.templates = {
            main: this.templateManager.createTemplate(mainTemplate),
            content: this.templateManager.createTemplate(contentTemplate),
            menuLangs: this.templateManager.createTemplate(menuLangsTemplate),
            contact: this.templateManager.createTemplate(contactTemplate),
            file: this.templateManager.createTemplate(fileTemplate),
            mail: this.templateManager.createTemplate(mailTemplate)
        };
        this.langs = [];
        this.defaultLang = "";
        this.prepareEvents();
    }
    
    prepareEvents(): void {
        this.$container.on("click", "[data-action=add-lang]", this.addLang.bind(this));
        this.$container.on("click", "[data-action=save]", this.save.bind(this));
        this.$container.on("click", "[data-action=switch-lang]", e => {
            let lang = $(e.currentTarget).data("lang");
            this.renderLang(lang);
        });
        this.$container.on("click", "[data-action=add-contact]", () => {
            this.addContact(null, true);
        });
        this.$container.on("click", "[data-action=add-file]", () => {
            this.addFile(null, null, true);
        });
        this.$container.on("click", "[data-action=add-mail]", () => {
            this.addMail(null, null, true);
        });
        this.$container.on("click", "[data-action=remove-item]", e => {
            $(e.currentTarget).closest(".item").remove();
        });
        this.$container.on("click", "[data-action=remove-lang]", e => {
            e.stopPropagation();
            let $lang = $(e.currentTarget).closest("[data-lang]");
            this.view.triggerEvent("confirmLangRemoval", $lang.data("lang"));
            return false;
        });
        this.$container.on("change", "[name=mailsEnabled]", this.onMailsEnabledChange.bind(this));
    }
    
    onMailsEnabledChange(event: Event): void {
        this.mailsEnabled = (<HTMLInputElement>event.currentTarget).checked;
        this.mailsEnabled ? this.enable() : this.disable();
    }
    
    enable(): void {
        this.$container.find(".mails-section .items").slideDown();
    }
    
    disable(): void {
        this.$container.find(".mails-section .items").slideUp();
    }
    
    removeLang(name: string): void {
        for (let i = 0; i < this.langs.length; i++) {
            if (this.langs[i].name == name) {
                this.langs.splice(i, 1);
                break;
            }
        }
        this.$container.find("[data-lang='" + name + "']").remove();
        if (this.currentLang == null || this.currentLang == name) {
            this.renderLang(this.langs[0].name);
        }
        this.save();
    }
    
    addLang(): void {
        this.renderLang(null);
    }
    
    jqueryMap<T>($e: JQuery, func: (idx: number, ele: Element) => T): T[] {
        let result: T[] = [];
        $e.each((i, e) => {
            result.push(func(i, e));
        })
        return result;
    }
    
    getLangDataFromForm(): LangData {
        let form = <HTMLFormElement>this.$container.find(".lang-form")[0];
        let model: LangData = {
            name: form.code.value,
            isDefaultLang: form.isdefault.checked,
            contacts: [],
            files: [],
            mails: []
        };
        model.contacts = this.jqueryMap($(form).find("[name=hashmail]"), (_idx, elem) => {
            return {hashmail: <string>$(elem).val()};
        });
        model.files = this.jqueryMap($(form).find(".files-section .item"), (_idx, elem) => {
            let $elem = $(elem);
            return {
                name: <string>$elem.find("[name='file.name']").val(),
                content: <string>$elem.find("[name='file.content']").val(),
                mimetype: "plain/text"
            };
        });
        model.mails = this.jqueryMap($(form).find(".mails-section .item"), (_idx, elem) => {
            let $elem = $(elem);
            let $contentEditor = $elem.find(".mail-content");
            return {
                subject: <string>$elem.find("[name='mail.subject']").val(),
                content: (<ContentEditableEditor>$contentEditor.data("editor")).getValue()
            };
        });
        return model;
    }
    
    save(): void {
        this.blockUI();
        let formLang = this.getLangDataFromForm();
        if (!formLang.name) {
            this.showError(this.i18n("window.admin.initData.error.noLangName"));
            this.unblockUI();
            return;
        }
        let initData: privfs.types.core.FullInitData = {
            defaultLang: this.defaultLang || formLang.name,
            mailsDisabled: !this.mailsEnabled,
            langs: {}
        };
        if (!initData.defaultLang) {
            this.showError(this.i18n("window.admin.initData.error.noDefaultLang"));
            this.unblockUI();
            return;
        }
        if (formLang.isDefaultLang) {
            initData.defaultLang = formLang.name;
        }
        let duplicatedName = false;
        if (this.currentLang !== formLang.name) {
            this.langs.some(lang => {
                if (lang.name === formLang.name) {
                    duplicatedName = true;
                    return true;
                }
            });
        }
        if (duplicatedName) {
            this.showError(this.i18n("window.admin.initData.error.duplicatedLangName"));
            this.unblockUI();
            return;
        }
        let langs: LangData[];
        if (this.currentLang) {
            langs = this.langs.map(lang => {
                if (this.currentLang === lang.name) {
                    return formLang;
                }
                return lang;
            });
        }
        else {
            langs = this.langs.slice();
            langs.push(formLang);
        }
        langs.forEach(lang => {
            initData.langs[lang.name] = this.prepareLangToSave(lang);
        });
        this.savingData = {
            langs: langs,
            formLang: formLang
        };
        this.view.triggerEvent("saveInitData", initData);
    }
    
    prepareLangToSave(lang: LangData): privfs.types.core.InitData {
        let out: privfs.types.core.InitData = [];
        lang.contacts.forEach(contact => {
            if (contact.hashmail == "") {
                return;
            }
            out.push({
                type: "addContact",
                hashmail: contact.hashmail
            });
        });
        lang.files.forEach(file => {
            if (file.name == "") {
                return;
            }
            let content = Lang.endsWith(file.name, ".stt") ? JSON.stringify({
                style: {name: "default"},
                content: file.content
            }) : file.content;
            out.push({
                type: "addFile",
                name: file.name,
                mimetype: file.mimetype,
                content: encodeBase64(content)
            });
        });
        lang.mails.forEach(mail => {
            if (!(mail.subject && mail.content)) {
                return;
            }
            out.push({
                type: "sendMail",
                subject: mail.subject,
                content: encodeBase64(mail.content),
                attachments: []
            });
        });
        return out;
    }
    
    blockUI(): void {
        this.$container.find(".initdata-editor-overlay").show();
    }
    
    unblockUI(): void {
        this.$container.find(".initdata-editor-overlay").hide();
    }
    
    onInitDataSave(success: boolean): void {
        if (success) {
            this.langs = this.savingData.langs;
            this.currentLang = this.savingData.formLang.name;
            if (this.savingData.formLang.isDefaultLang) {
                this.defaultLang = this.savingData.formLang.name;
            }
            this.renderMenuLangs();
        }
        this.unblockUI();
    }
    
    renderLang(lang: string): void {
        this.currentLang = lang;
        let model: LangModel = {
            lang: {
                name: lang,
                isDefaultLang: lang === this.defaultLang,
                contacts: [],
                files: [],
                mails: []
            },
            isDefaultLang: lang === this.defaultLang,
            mailsEnabled: this.mailsEnabled
        };
        this.langs.some(m => {
            if (m.name == lang) {
                model.lang = m;
                model.isDefaultLang = m.name === this.defaultLang;
                return true;
            }
        });
        let html = this.templates.content.renderToJQ(model);
        this.$container.find(".initdata-editor-content").content(html);
        this.renderMenuLangs();
        if (model.lang.contacts) {
            model.lang.contacts.forEach(elem => {
                this.addContact(elem.hashmail);
            });
        }
        if (model.lang.files) {
            model.lang.files.forEach(elem => {
                this.addFile(elem.name, elem.content);
            });
        }
        if (model.lang.mails) {
            model.lang.mails.forEach(elem => {
                this.addMail(elem.subject, elem.content);
            });
        }
    }
    
    renderMenuLangs(): void {
        let model: LangsMenuModel = {
            langs: this.langs.map(lang => {
                return lang.name;
            }),
            activeLang: this.currentLang
        };
        let html = this.templates.menuLangs.renderToJQ(model);
        this.$container.find(".initdata-editor-menu-langs").content(html);
    }
    
    loadInitData(initData: privfs.types.core.FullInitData, editMultipleLangs: boolean): void {
        this.defaultLang = initData.defaultLang;
        this.langs = [];
        this.mailsEnabled = !initData.mailsDisabled;
        for (var langName in initData.langs) {
            let lang: LangData = {
                name: langName,
                isDefaultLang: initData.defaultLang == langName,
                contacts: [],
                files: [],
                mails: []
            };
            initData.langs[langName].forEach(entry => {
                if (entry.type == "addContact") {
                    let addContactEntry = <privfs.types.core.InitDataAddContact>entry;
                    lang.contacts.push({hashmail: addContactEntry.hashmail});
                }
                else if (entry.type == "addFile") {
                    let addFileEntry = <privfs.types.core.InitDataAddFile>entry;
                    let content = decodeBase64(addFileEntry.content);
                    if (Lang.endsWith(addFileEntry.name, ".stt") && Lang.startsWith(content, "{") && Lang.endsWith(content, "}")) {
                        try {
                            content = JSON.parse(content).content;
                        }
                        catch( e){
                            Logger.error("[Warning] Styled file (.stt) contains plain text");
                        }
                    }
                    lang.files.push({
                        name: addFileEntry.name,
                        mimetype: addFileEntry.mimetype,
                        content: content
                    });
                }
                else if (entry.type == "sendMail") {
                    let sendMailEntry = <privfs.types.core.InitDataSendMail>entry;
                    lang.mails.push({
                        subject: sendMailEntry.subject,
                        content: decodeBase64(sendMailEntry.content)
                    });
                }
            });
            this.langs.push(lang);
        }
        let $html = this.templates.main.renderToJQ();
        if (this.langs.length > 0 && !editMultipleLangs) {
            $html.find(".initdata-editor").addClass("single-lang-mode");
        }
        this.$container.content($html);
        this.renderMenuLangs();
        if (this.currentLang != null) {
            this.renderLang(this.currentLang);
        }
        else if (this.langs.length) {
            this.renderLang(this.langs[0].name);
        }
        if (initData.mailsDisabled) {
            this.$container.find(".mails-section .items").hide();
        }
        this.$container.find("[name=mailsEnabled]").prop("checked", !initData.mailsDisabled);
    }
    
    addContact(hashmail: string, autofocus?: boolean): void {
        let model: Contact = {
            hashmail: hashmail
        };
        let $container = this.$container.find(".contacts-section .items");
        let html = this.templates.contact.renderToJQ(model);
        $container.append(html);
        if (autofocus) {
            html.find("input:first").focus();
        }
    }
    
    addFile(name: string, content: string, autofocus?: boolean): void {
        let model: File = {
            name: name,
            content: content,
            mimetype: ""
        };
        let $container = this.$container.find(".files-section .items");
        let html = this.templates.file.renderToJQ(model);
        $container.append(html);
        if (autofocus) {
            html.find("input:first").focus();
        }
    }
    
    addMail(subject: string, content: string, autofocus?: boolean): void {
        let model: Mail = {
            subject: subject,
            content: content
        };
        let $container = this.$container.find(".mails-section .items");
        let $html = this.templates.mail.renderToJQ(model);
        $container.append($html);
        let $contentEditor = $html.find(".mail-content");
        let editor = new ContentEditableEditor($contentEditor);
        $contentEditor.data("editor", editor);
        editor.setValue(this.helper.nl2br(model.content));
        if (autofocus) {
            $html.find("input:first").focus();
        }
    }
    
    showError(msg: string): void {
        this.view.triggerEvent("showAlert", msg);
    }
    
    i18n(_key: string, ..._args: any[]): string {
        return this.helper.i18n.apply(this.helper, arguments);
    }
}

function encodeUtf8(s: string): string {
    return unescape(encodeURIComponent(s));
}

function decodeUtf8(s: string): string {
    return decodeURIComponent(escape(s));
}

function encodeBase64(s: string): string {
    return btoa(encodeUtf8(s));
}

function decodeBase64(s: string): string {
    return decodeUtf8(atob(s));
}
