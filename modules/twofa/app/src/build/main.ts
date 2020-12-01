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
                event.result = app.ioc.create(CodeWindowController, [app, event.data, new TwofaApi(event.basicLoginResult.srpSecure.gateway)]).then(win => {
                    app.openSingletonWindow("twofa-window" , win);
                    return win.getPromise();
                });
            }
        }, "twofa", "ethernal");
    }
}