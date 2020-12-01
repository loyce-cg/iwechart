import {BaseWindowController} from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import {app, mail, event} from "../../Types";
import {Utils} from "../../utils/Utils";
import {Inject} from "../../utils/Decorators"
import {UserAdminService} from "../../mail/UserAdminService";
import {AdminDataCreatorService} from "../../mail/admin/AdminDataCreatorService";
import { MailConst } from "../../mail/MailConst";
import { AdminKeySender } from "../../mail/admin/AdminKeySender";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { ContactService } from "../../mail/contact/ContactService";
import { PersonService } from "../../mail/person/PersonService";

export type UserType = "managable"|"private";

export interface Model {
    userType: UserType;
    user: privfs.types.core.RawUserAdminData;
    isExternalUser: boolean;
    basicUser?: boolean;
    currentUsername: string;
    secureFormsCount: number;
    contactFormLink: string;
    adminData: mail.AdminData;
}

export class AdminEditUserWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.adminEditUser.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    username: string;
    userDisplayName: string;
    isExternalUser: boolean;
    externalUserLoginAlias: string;
    secureFormsCount: number;
    adminData: mail.AdminData;

    @Inject srpSecure: privfs.core.PrivFsSrpSecure;
    @Inject identity: privfs.identity.Identity;
    @Inject userAdminService: UserAdminService;
    @Inject adminDataCreatorService: AdminDataCreatorService;
    @Inject userConfig: privfs.types.core.UserConfig;
    @Inject adminKeySender: AdminKeySender;
    @Inject authData: privfs.types.core.UserDataEx;
    @Inject personService: PersonService;
    @Inject contactService: ContactService;
    
    constructor(parent: app.WindowParent, username: string, userAlias: string) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.username = username;
        this.userDisplayName = userAlias || username;
        let user = this.userAdminService.usersCollection.getBy("username", this.username);
        if (user) {
            this.isExternalUser = user.loginAlias && user.loginAlias.length > 0;
            if (this.isExternalUser) {
                this.externalUserLoginAlias = user.loginAlias;
            }
        }
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = 505;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.minimizable = true;
        this.openWindowOptions.maximizable = false;
        this.openWindowOptions.title = this.i18n("window.adminEditUser.title" + (this.isExternalUser ? ".externalUser" : ""), this.userDisplayName);
        this.openWindowOptions.icon = "icon fa fa-user";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
    }
    
    init(): Q.Promise<void> {
        return Q().then(() => {
            return this.srpSecure.sinkGetAllByUser(this.username)
            .then(data => {
                if (data && data.length) {
                    this.secureFormsCount = data.filter(s => {
                        return s.acl == "anonymous";
                    }).length;
                }
                else {
                    this.secureFormsCount = 0;
                }
                let user = this.userAdminService.usersCollection.getBy("username", this.username);
                if (!user || !user.adminData) {
                    return;
                }
                return this.adminDataCreatorService.decryptAdminData(this.username, user.adminData)
                .then(adminData => {
                    this.adminData = adminData;
                    
                    if (adminData && Object.keys(adminData).indexOf("masterSeed") > -1) {
                        this.adminData = <mail.AdminDataManagable>adminData;
                    }
                    else
                    if (adminData && Object.keys(adminData).indexOf("key") > -1) {
                        this.adminData = <mail.AdminDataPrivate>adminData;
                    }
                })
                
                .fail(e => {
                    this.logError(e);
                });
            });
        })
    }
    
    getModel(): Model {
        let user = this.userAdminService.usersCollection.getBy("username", this.username);
        // console.log("user", user);
        if (typeof user.invitedBy === 'object' && user.invitedBy !== null) {
            user.invitedBy = (<privfs.types.core.RawUserAdminData>user.invitedBy).username;
        }
        let userType: UserType = null;
        if (this.adminData && Object.keys(this.adminData).indexOf("masterSeed") > -1 ) {
            userType = "managable";
        }
        else
        if (this.adminData && Object.keys(this.adminData).indexOf("key") > -1) {
            userType = "private";
        }
        return {
            user: this.userAdminService.usersCollection.getBy("username", this.username),
            isExternalUser: this.isExternalUser,
            basicUser: user.rights.indexOf("basic") > -1 && user.rights.indexOf("normal") == -1,
            currentUsername: this.identity.user,
            secureFormsCount: this.secureFormsCount,
            contactFormLink: this.userConfig.userContactFormUrl + "?" + this.username,
            adminData: this.adminData,
            userType: userType
        };
    }
    
    onViewSaveChanges(dataStr: string): void {
        let data: privfs.types.core.UserDataChange&{admin: boolean, privateSectionAllowed: boolean} = JSON.parse(dataStr);
        let old = this.userAdminService.usersCollection.getBy("username", this.username);
        this.addTaskEx("", true, () => {
            let promises: Q.Promise<any>[] = [];
            if (old.loginAlias && old.loginAlias != "") {
                data.admin = false;
            }

            if (old.loginAlias != "" && old.isAdmin != data.admin && old.activated && this.username != this.identity.user) {
                if (!old.cachedPkiEntry || !old.cachedPkiEntry.primaryKey) {
                    throw new Error("Cannot change admin flag for not activated user");
                }
                promises.push(this.srpSecure.changeIsAdmin(this.identity.priv, this.username, data.admin, privfs.crypto.ecc.PublicKey.fromBase58DER(old.cachedPkiEntry.primaryKey)));
                if (data.admin) {
                    promises.push(this.adminKeySender.sendAdminKey(this.username))
                }
            }
            data.contactFormEnabled = <any>data.contactFormEnabled === "true";
            data.secureFormsEnabled = <any>data.secureFormsEnabled === "true";
            delete data.admin;

            promises.push(
                // this.srpSecure.request("modifyUser", {
                //     username: this.username,
                //     properties: {
                //         privateSectionAllowed: data.privateSectionAllowed ? true : false
                //     }
                // })
                this.srpSecure.modifyUser(this.username, {
                    privateSectionAllowed: data.privateSectionAllowed ? true : false
                })
            )
            delete data.privateSectionAllowed;

            promises.push(this.srpSecure.changeUserData(this.username, data));
            return Q.all(promises)
            .then(() => {
                this.userAdminService.refreshUsersCollection();
                if (this.username == this.identity.user) {
                    this.authData.myData.raw.contactFormEnabled = data.contactFormEnabled;
                    this.authData.myData.raw.secureFormsEnabled = data.secureFormsEnabled;
                }
                this.callViewMethod("unlockSaveButton");
            })
            .fail(e => {
                this.callViewMethod("unlockSaveButton");
                return Q.reject(e);
            });
        });
    }
    
    onViewRemoveUser(): void {
        this.confirm().then(res => {
            if (res.result != "yes") {
                return;
            }
            this.addTaskEx("", true, () => {
                return this.userAdminService.removeUser(this.username);
            })
            .then(() => {
                return this.contactService.deleteContact(this.contactService.getContactByHashmail(this.username + "#" + this.identity.host));
            })
            .then(() => {
                return this.personService.synchronizeWithUsernames();
            })
            .then(() => {
                this.app.eventDispatcher.dispatchEvent<event.UserDeletedEvent>({type: "user-deleted", hashmail: this.username + "#" + this.identity.host});
                this.close(true);
            });
        });
    }
    
    onViewResetPassword(): void {
        if (!this.adminData) {
            return;
        }
        this.confirmEx({
            message: this.i18n("window.adminEditUser.button.resetPassword.areYouSure" + (this.isExternalUser ? ".externalUser" : ""), this.userDisplayName),
            processing: "yes",
            onClose: modal => {
                if (modal.result != "yes") {
                    modal.close();
                    return;
                }
                modal.startProcessing();
                let recoveryEntropy = new Buffer((<mail.AdminDataManagable>this.adminData).recovery, "base64");
                let password = Utils.randomTemporaryPassword(6);
                return Q().then(() => {
                    return privfs.core.PrivFsRpcManager.getKeyLoginByHost(MailConst.IDENTITY_INDEX, this.identity.host)
                })
                .then(keyLogin => {
                    return keyLogin.login(recoveryEntropy, true);
                })
                .then(authData => {
                    let login = authData.myData.raw.login;
                    return authData.srpSecure.changePasswordByRecovery(recoveryEntropy, this.username, login, password, false);
                })
                .then(() => {
                    let adminData: mail.AdminDataManagable = {
                        masterSeed: (<mail.AdminDataManagable>this.adminData).masterSeed,
                        recovery: (<mail.AdminDataManagable>this.adminData).recovery,
                        generatedPassword: password
                    };
                    return this.adminDataCreatorService.setAdminData(this.username, adminData);
                })
                .then(() => {
                    this.userAdminService.refreshUsersCollection();
                    modal.close();
                    this.callViewMethod("renderPasswordSection", password);
                    let username = this.isExternalUser ? this.externalUserLoginAlias : this.username;
                    this.alertEx({
                        width: 560,
                        height: 260,
                        focusOn: "",
                        contentTemplate: {
                            templateId: "adminEditUserResetSummaryTemplate",
                            model: {
                                username: username,
                                hashmail: username + "#" + this.identity.host,
                                password: password,
                                createMode: false,
                                isExternalUser: this.isExternalUser,
                            }
                        },
                        extraHandlers: {
                            "send-link": () => this.sendActivationData(username, password, this.isExternalUser ? username : null),
                        },
                    });
                })
                .fail(e => {
                    this.onError(e);
                })
                .fin(() => {
                    modal.stopProcessing();
                });
            }
        });
    }
    
    onViewClose(): void {
        this.close();
    }
    
    sendActivationData(username: string, password: string, email: string): void {
        this.app.sendActivationData(username, password, email, false);
    }

    onViewSendEmail(): void {
        let model = this.getModel();
        this.sendActivationData(model.currentUsername, (<any>model.adminData).generatedPassword, model.user.email);
    }
    
}
