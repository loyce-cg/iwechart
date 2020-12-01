import {app, Logger as RootLogger, mail} from "pmc-mail";
import {TwofaApi} from "./TwofaApi";
import {i18n} from "../i18n/index";

let Logger = RootLogger.get("privfs-twofa-plugin.TwofaService");

export interface AdditionalLoginStepData {
    reason: string;
    type: string;
    email: string;
    mobile: string;
}

export class TwofaService {
    
    api: TwofaApi;
    
    constructor(
        public app: app.common.CommonApplication
    ) {
    }
    
    registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.twofa.");
    }
    
    onLogin() {
        this.app.mailClientApi.privmxRegistry.getGateway().then(gateway => {
            this.api = new TwofaApi(gateway);
        })
        .fail(e => {
            Logger.error("Error during creating 2FA api", e);
        });
    }
}