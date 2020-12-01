import {TemplateManager} from "../../web-utils/template/Manager";
import {func as conversation} from "../template/conversation.html";
import {func as wiElement} from "../template/wi-element.html";
import {func as emoji} from "../template/emoji.html";
import {func as loading} from "../template/loading.html";
import {func as buttons} from "../template/buttons.html";
import {func as center} from "../template/center.html";

export class Templates {
    static loading(manager: TemplateManager, centered: boolean): JQuery {
        if (centered) {
            return manager.createTemplate(center).renderToJQ(() =>
                manager.createTemplate(loading).render());
        }
        return manager.createTemplate(loading).renderToJQ();
    }
}

export {
    conversation,
    wiElement,
    emoji,
    loading,
    buttons,
    center
}