import * as Mail from "pmc-mail";
import {TwofaService, AdditionalLoginStepData} from "../main/TwofaService";
import {SettingsTwofaWindowController} from "../window/settingstwofa/SettingsTwofaWindowController";
import {CodeWindowController} from "../window/code/CodeWindowController";
import {TwofaApi} from "../main/TwofaApi";

export class Plugin {
    
    register(_mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let twofaService = new TwofaService(app);
        
        // i18n: main
        twofaService.registerTexts(app.localeService);
        
        // i18n: components
        
        // i18n: windows
        CodeWindowController.registerTexts(app.localeService);
        SettingsTwofaWindowController.registerTexts(app.localeService);
        
        app.addComponent("twofa-plugin", twofaService);
        
        app.addEventListener<Mail.Types.event.AfterLoginEvent>("afterlogin", () => {
            twofaService.onLogin();
        }, "twofa", "ethernal");
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.settings.SettingsWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.settings.SettingsWindowController") {
                new SettingsTwofaWindowController(event.instance);
            }
        }, "twofa", "ethernal");
        
        app.addEventListener<Mail.Types.event.AdditionalLoginStepEvent<AdditionalLoginStepData>>("additionalloginstep", event => {
            if (event.data && event.data.reason == "twofa" && CodeWindowController.isSupported(event.data)) {
                let host = event.basicLoginResult.gateway.getHost();
                let login = (<any>event.data).webauthnLogin;
                event.result = app.ioc.create(CodeWindowController, [app, {
                    data: event.data,
                    api: new TwofaApi(event.basicLoginResult.gateway),
                    cancellable: false,
                    host: host,
                    u2f: {register: null, login: login}
                }]).then(win => {
                    app.openSingletonWindow("twofa-window" , win);
                    return win.getPromise();
                });
            }
        }, "twofa", "ethernal");
    }
}