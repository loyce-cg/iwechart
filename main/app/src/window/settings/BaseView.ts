import {ComponentView} from "../../component/base/ComponentView";
import {func as mainTemplate} from "./template/tab-container.html";
import {ProgressViewContainer} from "../../component/channel/ProgressViewContainer";
import * as $ from "jquery";
import {webUtils} from "../../Types";
import {SettingsWindowView} from "./SettingsWindowView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {PreferencesToSave} from "./SettingsWindowController";
import {Lang} from "../../utils/Lang";

export interface MenuModel {
    id: string;
    priority: number;
    groupId: string;
    icon: string;
    label?: string;
    labelKey: string;
    hidden?: boolean;
    addSeparatorBefore?: boolean;
    addSeparatorAfter?: boolean;
}

export class BaseView<T> extends ComponentView {
    
    parent: SettingsWindowView;
    helper: MailClientViewHelper;
    contentTemplate: webUtils.MailTemplateDefinition<T>;
    instantContentRender: boolean;
    menuModel: MenuModel;
    $main: JQuery;
    $saveButton: JQuery;
    savedState: string = null;
    
    constructor(parent: SettingsWindowView, contentTemplate: webUtils.MailTemplateDefinition<T>, instantContentRender?: boolean) {
        super(parent);
        this.helper = this.parent.helper;
        this.contentTemplate = contentTemplate;
        this.instantContentRender = instantContentRender;
    }
    
    init(model?: any): Q.IWhenable<void> {
        this.$main = this.templateManager.createTemplate(mainTemplate).renderToJQ(this.menuModel.id);
        if (this.instantContentRender) {
            this.renderContent(null);
        }
        this.$main.on("click", ".save-button", this.onSaveButtonClick.bind(this));
        this.$main.on("click", "[data-copy]", (e: Event) => this.helper.onCopyClick(<MouseEvent>e));
        this.$main.on("change", "select", () => this.updateDirty());
        this.$main.on("change", "input", () => this.updateDirty());
        this.$main.on("input", "input, textarea", () => this.updateDirty());
        return this.initTab(model);
    }
    
    initTab(model?: any): Q.IWhenable<void> {
    }
    
    renderContent(model: T): void {
        if (this.contentTemplate != null) {
            this.$main.content(this.templateManager.createTemplate(this.contentTemplate).renderToJQ(model));
        }
        this.$saveButton = this.$main.find(".save-button, .change-password-button");
        this.afterRenderContent(model);
        this.savedState = this.getState();
        this.updateDirty();
    }
    
    afterRenderContent(model: T): void {
    }
    
    activate(): Q.IWhenable<void> {
    }
    
    afterDeactivated(): void {
    }
    
    triggerEventWithProgress(event: Event, ...args: any[]): ProgressViewContainer {
        return this.triggerEventWithProgressCore.apply(this, Array.prototype.slice.call(arguments, 1))
            .addButton($(event.target).closest("button"));
    }
    
    triggerEventWithProgressCore(name: string, ...argsArg: any[]): ProgressViewContainer {
        let progress = new ProgressViewContainer(this.parent);
        let args = [name, progress.id].concat(Array.prototype.slice.call(arguments, 1));
        this.triggerEvent.apply(this, args);
        return progress;
    }
    
    toggleSaveButtonState(): void {
        let $button = this.$main.find(".section .progress-button");
        let $buttonText = $button.find(".button-text");
        let workingText = $button.data("working-text") || this.helper.i18n("window.settings.form.button.save.loading");
        if (!$button.hasClass("loading")) {
            $button.addClass("loading");
            $button.data("prev-label", $buttonText.text());
            $buttonText.text(workingText);
            $button.prop("disabled", true);
        }
        else {
            $button.removeClass("loading");
            $buttonText.text($button.data("prev-label"));
            $button.prop("disabled", false);
        }
    }
    
    clearSaveButtonState(): void {
        this.savedState = this.getState();
        this.toggleSaveButtonState();
        this.updateDirty();
    }
    
    onSaveButtonClick(): void {
        if (this.validateForm()) {
            let values = this.collectValues();
            this.toggleSaveButtonState();
            this.triggerEvent("save", JSON.stringify(values));
        }
    }
    
    collectValues(readonly: boolean = false): PreferencesToSave {
        let result: PreferencesToSave = {};
        let view = this;
        this.$main.find(".section").find(":input").each((idx, elem: HTMLInputElement) => {
            if (!elem.name) {
                return;
            }
            let $elem = $(elem);
            if ($elem.data("value-converter")) {
                let converterName = $elem.data("value-converter");
                result[elem.name] = (<any>this)[converterName]($elem);
            }
            else if ($elem.is(":checkbox")) {
                result[elem.name] = elem.checked;
            }
            else if ($elem.is(":radio")) {
                if (elem.checked) {
                    result[elem.name] = elem.value;
                }
            }
            else if ($elem.is("select[multiple]")) {
                result[elem.name] = JSON.stringify($elem.val());
            }
            else {
                let value = Lang.getTrimmedString(elem.value);
                if (elem.name == "profile.name") {
                    value = value.substring(0, 100);
                }
                else if (elem.name == "profile.description") {
                    value = value.substring(0, 500);
                }
                else if (elem.name == "notifications.email") {
                    if (!readonly) {
                        value = view.checkEmail(value) ? value : "";
                        $elem.val(value).removeClass("invalid");
                    }
                }
                result[elem.name] = value;
            }
        });
        return result;
    }
    
    validateForm(): boolean {
        let $section = this.$main.find(".section");
        if ($section.hasClass("notifications-section")) {
            let $input = $section.find("input[name='notifications.email']");
            let value = (<string>$input.val()).trim();
            if (value && !this.checkEmail(value)) {
                $input.addClass("invalid");
                $input.next(".error").show();
                return false;
            }
        }
        return true;
    }
    
    checkEmail(text: string): boolean {
        let re = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
        return re.test(text);
    }
    
    getState(): string {
        return JSON.stringify(this.collectValues());
    }
    
    isDirty(): boolean {
        let currState = JSON.stringify(this.collectValues(true));
        return (currState != this.savedState);
    }
    
    updateDirty(): void {
        this.$saveButton.prop("disabled", !this.isDirty());
    }
    
}
