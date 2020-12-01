import {SettingsWindowView} from "./SettingsWindowView";
import {BaseView} from "./BaseView";
import {AccountView} from "./account/AccountView";
// import {ContactFormView} from "./contactform/ContactFormView";
// import {MailView} from "./mail/MailView";
import {NotificationsView} from "./notifications/NotificationsView";
import {PublicProfileView} from "./publicprofile/PublicProfileView";
// import {SecureFormsView} from "./secureforms/SecureFormsView";
// import {SubidentitiesView} from "./subidentities/SubidentitiesView";
import {SysInfoView} from "./sysinfo/SysInfoView";
import {UserInterfaceView} from "./userinterface/UserInterfaceView";
// import {WhitelistView} from "./whitelist/WhitelistView";
import {HotkeysView} from "./hotkeys/HotkeysView";
import { SysInfoExtView } from "./sysinfoext/SysInfoExtView";
import { AudioConfigView } from "./audioconfig/AudioConfigView";
import { TextView } from "./text/TextView";

export type TabsViewClass = {
    new(parent: SettingsWindowView): BaseView<any>;
}

export let TabsViews: TabsViewClass[] = [
    AccountView,
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
];
