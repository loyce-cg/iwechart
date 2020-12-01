import {WindowComponentController} from "../base/WindowComponentController";
import {AdminWindowView} from "./AdminWindowView";
import {BaseView} from "./BaseView";
import {BlacklistView} from "./blacklist/BlacklistView";
import {InitDataView} from "./initdata/InitDataView";
import {SysInfoView} from "./sysinfo/SysInfoView";
import {SysMsgView} from "./sysmsg/SysMsgView";
import {TrustedView} from "./trusted/TrustedView";
import {UsersView} from "./users/UsersView";
import {ExternalUsersView} from "./externalusers/ExternalUsersView";
import {CustomizationView} from "./customization/CustomizationView";
import {LoginsView} from "./logins/LoginsView";
import {PrivMsgView} from "./privmsg/PrivMsgView";
import {ProxyWhitelistView} from "./proxywhitelist/ProxyWhitelistView";

import {PaymentsView} from "./payments/PaymentsView";
// import { PaymentsController } from "./payments/main";
export type TabsViewClass = {
    new(parent: AdminWindowView): BaseView<any>;
}

export let TabsViews: TabsViewClass[] = [
    ProxyWhitelistView,
    //BlacklistView,
    //InitDataView,
    SysInfoView,
    //SysMsgView,
    //TrustedView,
    UsersView,
    ExternalUsersView,
    CustomizationView,
    LoginsView,
    PrivMsgView,
    // PaymentsView
];
