import * as Mail from "pmc-mail";
import { AppsWindowController } from "../window/apps/AppsWindowController";
import { AppsPlugin } from "../main/AppsPlugin";

export class Plugin {
    
    register(mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let appsPlugin = app.addComponent("apps-plugin", new AppsPlugin(app));
        
        // i18n: main
        appsPlugin.registerTexts(app.localeService);
        
        // i18n: components
        
        // i18n: windows
        AppsWindowController.registerTexts(app.localeService);
        
        app.addEventListener<Mail.Types.event.AfterLoginEvent>("afterlogin", event => {
            let cnt = <Mail.window.container.ContainerWindowController>app.windows.container;
            let entry = cnt.registerAppWindow({
                id: "apps",
                label: "",
                icon: "",
                controllerClass: AppsWindowController,
                visible: false,
                historyPath: "/apps"
            });
            cnt.initApp = entry.id;
            cnt.activateLogoAction = entry.id;
        }, "apps", "ethernal");
        
        app.addEventListener<Mail.Types.event.AfterLogoutPlugin>("afterlogout", () => {
            appsPlugin.reset();
        }, "tasks", "ethernal");
    }
}