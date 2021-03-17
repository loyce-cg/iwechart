import { component, webUtils, window as wnd, Q, JQuery as $ } from "pmc-web";

export class GongMessagePopup {
    
    constructor(
        private parent: component.base.ComponentView
    ) {
    }
    
    async show($target: JQuery): Promise<string|false> {
        const templateManager: webUtils.template.TemplateManager = this.parent.templateManager;
        const helper: webUtils.MailClientViewHelper = templateManager.getHelperByClass(webUtils.MailClientViewHelper);
        const simplePopup = new component.simplepopup.SimplePopup(templateManager);
        const placeholder = helper.escapeHtml(helper.i18n("plugin.chat.gongQuestionPopup.titleInput.placeholder"));
        const $input = $(`<input type="text" placeholder="${placeholder}" maxlength="100" />`);
        let send: boolean = false;
        await simplePopup.init({
            $content: $input,
            buttons: [
                {
                    icon: "fa fa-bell",
                    text: helper.i18n("plugin.chat.gongQuestionPopup.startButton.text"),
                    cssClasses: "btn-success btn-sm small",
                    onClick: () => { send = true; simplePopup.close(); },
                },
                {
                    text: helper.i18n("plugin.chat.gongQuestionPopup.cancelButton.text"),
                    cssClasses: "btn-default gray btn-sm small",
                    onClick: () => { send = false; simplePopup.close(); },
                },
            ],
            outsideClickBehavior: component.simplepopup.OutsideClickBehavior.CLOSE_POPUP,
            width: 360,
            height: 100,
            $target: $target,
            horizontalPlacement: webUtils.PopupPlacement.COMMON_END,
            verticalPlacement: webUtils.PopupPlacement.BEFORE,
        });
        simplePopup.show();
        $input[0].focus();
        $input.on("keydown", e => {
            if (e.key == "Escape") {
                send = false;
                simplePopup.close();
            }
            else if (e.key == "Enter") {
                send = true;
                simplePopup.close();
            }
        });
        await simplePopup.getClosePromise();
        if (send == false) {
            return false;
        }
        const title = $input.val().toString().trim().substr(0, 100);
        return title;
    }
    
}
