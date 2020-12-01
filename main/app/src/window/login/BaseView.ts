import {ComponentView} from "../../component/base/ComponentView";
import {webUtils} from "../../Types";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import {LoginWindowView} from "./LoginWindowView";

export class BaseView<M, C = void> extends ComponentView {
    
    parent: LoginWindowView;
    helper: MailClientViewHelper;
    mainTemplate: webUtils.MailTemplate<M, C>;
    $main: JQuery;
    $form: JQuery;
    $error: JQuery;
    activeView: boolean;
    name?: string;
    constructor(parent: LoginWindowView, mainTemplate: webUtils.MailTemplateDefinition<M, C>) {
        super(parent);
        this.helper = this.parent.helper;
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
    }
    
    init(model: M): void {
        this.render(model);
    }
    
    render(model: M): void {
    }
    
    enableForm(): void {
        this.$form.find(":input").prop("disabled", false);
    }
    
    disableForm(): void {
        if (this.$form) {
            this.$form.find(":input").prop("disabled", true);
        }
    }
    
    clearError(): void {
        if (this.$error) {
            this.$error.html("");
        }
    }
    
    beforeFocus(): void {
    }
    
    focus(): void {
    }
    
    beforeBlur(): void {
    }
    
    blur(): void {
    }
    
    activate(callback?: () => void, noDecoration?: boolean) {
        this.beforeFocus();
        this.clearError();
        this.$main.addClass("active");
        let toDo = () => {
            this.activeView = true;
            this.focus();
            if (callback) {
                callback();
            }
            this.onAfterActivate();
        };
        return noDecoration ? toDo() : this.$main.hide().fadeIn(toDo);
    }
    
    onAfterActivate() {
    }
    
    deactivate(callback?: () => void, noDecoration?: boolean) {
        this.beforeBlur();
        this.activeView = false;
        let toDo = () => {
            this.$main.removeClass("active");
            this.blur();
            if (callback) {
                callback();
            }
        };
        return noDecoration ? toDo() : this.$main.fadeOut(toDo);
    }
}
