import { WindowComponentController } from "../base/WindowComponentController";
import { SettingsWindowController } from "./SettingsWindowController";
import { AlternativeLoginController } from "./alternativeLogin/AlternativeLoginController";
import { ChangePasswordController } from "./changePassword/ChangePasswordController";
import { NotificationsController } from "./notifications/NotificationsController";
import { PublicProfileController } from "./publicprofile/PublicProfileController";
import { SysInfoController } from "./sysinfo/SysInfoController";
import { UserInterfaceController } from "./userinterface/UserInterfaceController";
import { TextController } from "./text/TextController";
import { DevicesController } from "./devices/DevicesController";

export type TabController = WindowComponentController<SettingsWindowController> & {
    prepare(): Q.IWhenable<void>;
};

export type TabControllerClass = {
    new (parentWindow: SettingsWindowController): TabController;
    tabId: string;
};

export let TabsControllers: TabControllerClass[] = [
    AlternativeLoginController,
    ChangePasswordController,
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
    DevicesController,
];
