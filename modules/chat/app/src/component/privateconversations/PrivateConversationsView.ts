import {component, webUtils, window as wnd, Q, JQuery as $} from "pmc-web";
import {mail, Types} from "pmc-mail";
import {func as privateConversationsTemplate} from "./template/private-conversations.html";
import {Model} from "./PrivateConversationsController";

export interface EntryToRemove {
    sendingId: number;
    realMessageId: number;
}

export class PrivateConversationsView extends component.base.ComponentView {
    parent: wnd.base.BaseWindowView<any>;
    $container: JQuery;
    privateConversations: PrivateConversationsView;
    constructor(parent: wnd.base.BaseWindowView<any>) {
        super(parent);
    }
    
    init(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$container.append(this.templateManager.createTemplate(privateConversationsTemplate).renderToJQ());
            this.$container.attr("tabindex", "-1");
            return;
        });
    }
    
    onDeactivate(): void {}
    onActivate(): void {}
    blurInputFocus(): void {}
}