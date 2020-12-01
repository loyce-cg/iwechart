import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import {ExtListController} from "../../../component/extlist/ExtListController";
import {AutoRefreshController} from "../../../component/autorefresh/AutoRefreshController";
import {SortedCollection} from "./../../../utils/collection/SortedCollection";
import * as privfs from "privfs-client";
import {AdminAddExternalUserWindowController} from "../../adminaddexternaluser/AdminAddExternalUserWindowController";
import {AdminEditUserWindowController} from "../../adminedituser/AdminEditUserWindowController";
import {MsgBoxOptions, MsgBoxResult} from "../../msgbox/MsgBoxWindowController";
import {UserAdminService} from "../../../mail/UserAdminService";
import {AdminKeyHolder} from "../../../mail/admin/AdminKeyHolder";
import {Inject, Dependencies} from "../../../utils/Decorators";
import { FilteredCollection } from "../../../utils/collection/FilteredCollection";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";
import * as PmxApi from "privmx-server-api"; 
import { TransformCollection } from "../../../utils/collection/TransformCollection";
import { UserInfo, UsersController } from "../users/UsersController";
import {Lang} from "../../../utils/Lang";
import { PersonsController } from "../../../component/persons/PersonsController";

@Dependencies(["autorefresh", "extlist"])
export class ExternalUsersController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.externalUsers.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "externalusers";
    
    @Inject identity: privfs.identity.Identity;
    @Inject userAdminService: UserAdminService;
    @Inject adminKeyHolder: AdminKeyHolder;
    
    alert: (message?: string) => Q.Promise<MsgBoxResult>;
    promptEx: (options: MsgBoxOptions) => Q.Promise<MsgBoxResult>;
    confirm: (message?: string) => Q.Promise<MsgBoxResult>;
    usersCollection: SortedCollection<privfs.types.core.RawUserAdminData>;
    transformCollection: TransformCollection<UserInfo, privfs.types.core.RawUserAdminData>;
    filteredCollection: FilteredCollection<privfs.types.core.RawUserAdminData>;
    users: ExtListController<privfs.types.core.RawUserAdminData>;
    usersSize: AutoRefreshController<number>;
    currentUsername: string;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.identity = this.parent.identity;
        this.userAdminService = this.parent.userAdminService;
        this.adminKeyHolder = this.parent.adminKeyHolder;
        this.alert = this.parent.alert.bind(this.parent);
        this.promptEx = this.parent.promptEx.bind(this.parent);
        this.confirm = this.parent.confirm.bind(this.parent);
        this.filteredCollection = new FilteredCollection(this.userAdminService.usersCollection, user => UsersController.isUserRemote(user, this.identity.host));
        this.transformCollection = this.addComponent("collectionWithMyself", new TransformCollection<UserInfo, privfs.types.core.RawUserAdminData>(this.filteredCollection, this.convertToUserInfo.bind(this)))

        this.usersCollection = this.addComponent("usersCollection", new SortedCollection(this.transformCollection,
            SortedCollection.stringNullableNumericComparator<privfs.types.core.RawUserAdminData>("lastLoginDate", "desc", SortedCollection.stringComparator("username"))));
        this.users = this.addComponent("users", this.componentFactory.createComponent("extlist", [this, this.usersCollection]));
        this.users.ipcMode = true;
        this.usersSize = this.addComponent("usersSize", this.componentFactory.createComponent<number, void>("autorefresh", [this, {model: this.usersCollection, isCollectionSize: true}]));
        this.usersSize.ipcMode = true;
        this.currentUsername = this.identity.user;
    }
    
    onViewRefreshUsers(channelId: number): void {
        this.addTaskExWithProgress("", true, channelId, () => {
            return this.userAdminService.refreshUsersCollection();
        });
    }
    
    onViewAddUser(): void {
        if (this.adminKeyHolder.adminKey == null) {
            this.alert(this.i18n("window.admin.externalUsers.noAdminKey"));
            return;
        }
        this.app.ioc.create(AdminAddExternalUserWindowController, [this.parent]).then(win => {
            this.parent.openChildWindow(win);
        });
    }
    
    onViewRemoveUser(channelId: number, username: string): void {
        this.confirm()
        .then(res => {
            if (res.result != "yes") {
                return;
            }
            this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
                return this.userAdminService.removeUser(username);
            });
        });
    }
    
    onViewEditUser(username: string): void {
        if (this.adminKeyHolder.adminKey == null) {
            this.alert(this.i18n("window.admin.externalUsers.noAdminKey"));
            return;
        }
        let userAlias: string;
        this.users.collection.forEach(u => {
            if (u.username == username) {
                userAlias = u.email;
            }
        })
        this.app.ioc.create(AdminEditUserWindowController, [this.parent, username, userAlias]).then(win => {
            win.parent = this.parent;
            this.app.openSingletonWindow("edit-" + username, win);
        });
    }
    
    prepare(): Q.Promise<void> {
        return this.userAdminService.refreshUsersCollection()
        .then(() => {
            this.callViewMethod("setAddUserButtonState", this.parent.isMaxUsersLimitReached());
        })

    }

    onViewDisable2Fa(channelId: number, username: string): void {
        this.confirm()
        .then(res => {
            if (res.result != "yes") {
                return;
            }
            this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
                return this.parent.utilApi.disableUserTwofa(username as PmxApi.api.core.Username);
            })
            .then(() => {
                let user = this.usersCollection.getBy("username", username);
                (<any>user).twofa = false;
                this.usersCollection.triggerUpdateElement(user);
            })
        });
    }

    onViewBlockUser(channelId: number, username: string): void {
        this.confirm()
        .then(res => {
            if (res.result != "yes") {
                return;
            }
            this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
                return this.parent.utilApi.setUserBlocked((username as PmxApi.api.core.Username), true);
            })
            .then(() => {
                let user = this.usersCollection.getBy("username", username);
                (<any>user).blocked = true;
                this.usersCollection.triggerUpdateElement(user);
            })
        });
    }

    onViewUnblockUser(channelId: number, username: string): void {
        this.confirm()
        .then(res => {
            if (res.result != "yes") {
                return;
            }
            this.addTaskExWithProgress(this.i18n(""), true, channelId, () => {
                return this.parent.utilApi.setUserBlocked((username as PmxApi.api.core.Username), false);
            })            
            .then(() => {
                let user = this.usersCollection.getBy("username", username);
                (<any>user).blocked = false;
                this.usersCollection.triggerUpdateElement(user);
            })
        });
    }

    convertToUserInfo(element: privfs.types.core.RawUserAdminData): UserInfo {
        let ret = <UserInfo>Lang.shallowCopy(element); 
        ret.myself = this.currentUsername == element.username;
        let hashmail = element.username + "#" + this.parent.identity.host;
        let person = this.parent.persons.get(hashmail);
        let extraInfo = this.parent.persons.contactService.getUserExtraInfo(hashmail);
        let personModelFull = PersonsController.getPersonModelFull(person, extraInfo);
        ret.present = person.isPresent();
        ret.lastClientVersion = personModelFull.client;
        ret.lastDevice = personModelFull.deviceName;
        ret.lastSeenDate = personModelFull.lastSeen;
        ret.loggedInSince = personModelFull.loggedInSince;
        ret.lastIp = personModelFull.ipAddress;
        ret.displayName = this.parent.persons.contactService.getContactByHashmail(hashmail).getDisplayName();
        return ret;
    }

}
