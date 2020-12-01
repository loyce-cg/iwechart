import * as Types from "../../Types";
import { SectionManager } from "../../mail/section";
import { TooltipController } from "../tooltip/main";
import {Inject, Dependencies} from "../../utils/Decorators";
import { PersonService } from "../../mail/person";
import { ContactService } from "../../mail/contact";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { webUtils } from "../../Types";
import { SessionManager } from "../../mail/session/SessionManager";
import { WebSocketNotifier } from "../../mail/session/WebSocketNotifier";
export class UsersListModel {
    persons: webUtils.PersonSimpleModel[];  
}

export class UsersListTooltipController extends TooltipController {
    
    static textsPrefix: string = "component.usersListTooltip.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }

    onViewRequestContent(sectionId: string): void {
        if (this.getContent) {
            let cnt = this.getContent(sectionId);
            this.callViewMethod("setContent", sectionId, cnt);
        }
    }    
}