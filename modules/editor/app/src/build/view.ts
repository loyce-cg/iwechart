import * as Web from "pmc-web";
import {EditorWindowView} from "../window/editor/EditorWindowView";
import {MindmapHelpWindowView} from "../window/mindmaphelp/MindmapHelpWindowView";
import {SettingsNotesView} from "../window/settingsnotes/SettingsNotesView";
import {EditorViewHelper} from "../main/EditorViewHelper";

Web.Starter.objectFactory.register(EditorWindowView);
Web.Starter.objectFactory.register(MindmapHelpWindowView);

Web.Starter.addEventListener<Web.Types.event.TemplateManagerCreatedEvent>("templatemanagercreated", event => {
    event.templateManager.registerHelper(new EditorViewHelper(event.templateManager, event.helperModel));
}, "editor", "ethernal");

Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.settings.SettingsWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.settings.SettingsWindowView") {
        new SettingsNotesView(event.instance);
    }
}, "editor", "ethernal");