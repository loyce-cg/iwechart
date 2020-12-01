import {WindowComponentController} from "../base/WindowComponentController";
import {SettingsWindowController} from "./SettingsWindowController";
import {AccountController} from "./account/AccountController";
// import {ContactFormController} from "./contactform/ContactFormController";
// import {MailController} from "./mail/MailController";
import {NotificationsController} from "./notifications/NotificationsController";
import {PublicProfileController} from "./publicprofile/PublicProfileController";
// import {SecureFormsController} from "./secureforms/SecureFormsController";
// import {SubidentitiesController} from "./subidentities/SubidentitiesController";
import {SysInfoController} from "./sysinfo/SysInfoController";
import {UserInterfaceController} from "./userinterface/UserInterfaceController";
// import {WhitelistController} from "./whitelist/WhitelistController";
import {HotkeysController} from "./hotkeys/HotkeysController";
import { SysInfoExtController } from "./sysinfoext/SysInfoExtController";
import { AudioConfigController } from "./audioconfig/AudioConfigController";
import { TextController } from "./text/TextController";

export type TabController = WindowComponentController<SettingsWindowController>&{
    prepare(): Q.IWhenable<void>;
};

export type TabControllerClass = {
    new(parentWindow: SettingsWindowController): TabController;
    tabId: string;
}

export let TabsControllers: TabControllerClass[] = [
    AccountController,
    // ContactFormController,
    // MailController,
    NotificationsController,
    PublicProfileController,
    // SecureFormsController,
    // SubidentitiesController,
    SysInfoController,
    // SysInfoExtController,
    UserInterfaceController,
    // WhitelistController
    // HotkeysController,
    // AudioConfigController,
    TextController,
];
