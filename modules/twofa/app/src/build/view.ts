import {SettingsTwofaWindowView} from "../window/settingstwofa/SettingsTwofaWindowView";
import {CodeWindowView} from "../window/code/CodeWindowView";
import * as Web from "pmc-web";

Web.Starter.objectFactory.register(CodeWindowView);

Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.settings.SettingsWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.settings.SettingsWindowView") {
        new SettingsTwofaWindowView(event.instance);
    }
}, "twofa", "ethernal");