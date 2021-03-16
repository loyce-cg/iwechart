import { SettingsWindowView } from "./SettingsWindowView";
import { BaseView } from "./BaseView";
import { AlternativeLoginView } from "./alternativeLogin/AlternativeLoginView";
import { ChangePasswordView } from "./changePassword/ChangePasswordView";
import { NotificationsView } from "./notifications/NotificationsView";
import { PublicProfileView } from "./publicprofile/PublicProfileView";
import { SysInfoView } from "./sysinfo/SysInfoView";
import { UserInterfaceView } from "./userinterface/UserInterfaceView";
import { TextView } from "./text/TextView";
import { DevicesView } from "./devices/DevicesView";

export type TabsViewClass = {
    new (parent: SettingsWindowView): BaseView<any>;
};

export let TabsViews: TabsViewClass[] = [
    AlternativeLoginView,
    ChangePasswordView,
    // ContactFormView,
    // MailView,
    NotificationsView,
    PublicProfileView,
    // SecureFormsView,
    // SubidentitiesView,
    SysInfoView,
    // SysInfoExtView,
    UserInterfaceView,
    // WhitelistView
    // HotkeysView,
    // AudioConfigView,
    TextView,
    DevicesView,
];
