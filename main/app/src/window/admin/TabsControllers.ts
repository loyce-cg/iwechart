import {WindowComponentController} from "../base/WindowComponentController";
import {AdminWindowController} from "./AdminWindowController";
import {BlacklistController} from "./blacklist/BlacklistController";
import {InitDataController} from "./initdata/InitDataController";
import {SysInfoController} from "./sysinfo/SysInfoController";
import {SysMsgController} from "./sysmsg/SysMsgController";
import {TrustedController} from "./trusted/TrustedController";
import {UsersController} from "./users/UsersController";
import {ExternalUsersController} from "./externalusers/ExternalUsersController";
import {CustomizationController} from "./customization/CustomizationController";
import {LoginsController} from "./logins/LoginsController";
import {PrivMsgController} from "./privmsg/PrivMsgController";
import {ProxyWhitelistController} from "./proxywhitelist/ProxyWhitelistController";
// import {PaymentsController} from "./payments/PaymentsController";

export type TabController = WindowComponentController<AdminWindowController>&{
    prepare(): Q.IWhenable<void>;
};

export type TabControllerClass = {
    new(parentWindow: AdminWindowController): TabController;
    tabId: string;
}

export let TabsControllers: TabControllerClass[] = [
    ProxyWhitelistController,
    //BlacklistController,
    //InitDataController,
    SysInfoController,
    //SysMsgController,
    //TrustedController,
    UsersController,
    ExternalUsersController,
    CustomizationController,
    LoginsController,
    PrivMsgController,
    // PaymentsController,
];
