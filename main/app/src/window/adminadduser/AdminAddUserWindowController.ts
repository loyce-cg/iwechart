import { BaseWindowController } from "../base/BaseWindowController";
import * as privfs from "privfs-client";
import * as Q from "q";
import { app } from "../../Types";
import { Inject } from "../../utils/Decorators"
import { UserAdminService } from "../../mail/UserAdminService";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { PrivateUserCreator } from "../../mail/admin/userCreation/PrivateUserCreator";
import { ManagableUserCreator } from "../../mail/admin/userCreation/ManagableUserCreator";

export interface Model {
    showSendActivationLink: boolean;
    config: privfs.types.core.ConfigEx;
}

export type UserType = "keeper" | "regular" | "basic";

export interface AddUserModel {
    username: string;
    email: string;
    description: string;
    sendActivationLink: boolean;
    notificationEnabled: boolean;
    privateSectionAllowed?: boolean;
    userType: UserType;
}

export interface ManagableAlertModel {
    username: string;
    host: string;
    password: string;
    isExternalUser: boolean;
    height: number;
}

export class AdminAddUserWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.admin.userAdd.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static SHARE_COMMON_KVDB_KEY: boolean = true;
    static HEIGHT_FULL: number = 550;
    static HEIGHT_COLLAPSED = 390;
    @Inject private identity: privfs.identity.Identity;
    @Inject private gateway: privfs.gateway.RpcGateway;
    @Inject private userAdminService: UserAdminService;
    @Inject private privateUserCreator: PrivateUserCreator;
    @Inject private managableUserCreator: ManagableUserCreator;
    private serverConfig: privfs.types.core.ConfigEx;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = AdminAddUserWindowController.HEIGHT_COLLAPSED;
        this.openWindowOptions.resizable = false;
        this.openWindowOptions.minimizable = true;
        this.openWindowOptions.maximizable = false;
        this.openWindowOptions.title = this.i18n("window.admin.userAdd.title");
        this.openWindowOptions.icon = "icon fa fa-user-plus";
        this.msgBoxBaseOptions = {bodyClass: "admin-alert"};
    }
    
    init() {
        return Q().then(() => {
            return this.app.serverConfigPromise;
        })
        .then(cfg => {
            this.serverConfig = cfg;
        })
    }
    
    getModel(): Model {
        return {
            showSendActivationLink: !AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY,
            config: this.serverConfig
        }
    }
    
    // ======================
    //         VIEW
    // ======================
    
    onViewAddUser(model: AddUserModel, managable: boolean): void {
        if (managable) {
            this.tryCreateManagableUser(model);
        }
        else {
            this.tryCreatePrivateUser(model);
        }
    }
    
    onViewClose(): void {
        this.close();
    }
    
    onViewSetWindowHeightForMode(mode: string) {
        this.nwin.setHeight(mode == "collapse" ? AdminAddUserWindowController.HEIGHT_COLLAPSED : AdminAddUserWindowController.HEIGHT_FULL);
    }
    
    // ======================
    //      MANAGABLE
    // ======================
    
    private tryCreateManagableUser(model: AddUserModel) {
        if (!model.username) {
            this.callViewMethod("unlockForm");
            this.showNoUsernameAlert();
            return;
        }
        this.withLockAgainstClosing(async () => {
            try {
                await this.createManagableUser(model);
            }
            catch (e) {
                this.callViewMethod("unlockForm");
                if (this.isUserAlreadyExistsError(e)) {
                    this.showUserAlreadyExistsAlert();
                }
                else if (this.isInvalidEmailError(e)) {
                    this.showInvalidEmailAlert();
                }
                else if (this.isInvalidUsernameError(e)) {
                    this.showInvalidUsernameAlert();
                }
                else {
                    throw e;
                }
            }
        });
    }
    
    private async createManagableUser(model: AddUserModel) {
        if (model.userType == "keeper") {
            return this.createKeeper(model);
        }
        else if (model.userType == "regular") {
            return this.createRegularUser(model);
        }
        else if (model.userType == "basic") {
            return this.createBasicUser(model);
        }
    }
    
    private async createKeeper(model: AddUserModel) {
        return this.createNormalUser(model, true);
    }
    
    private async createRegularUser(model: AddUserModel) {
        return this.createNormalUser(model, false);
    }
    
    private async createNormalUser(model: AddUserModel, admin: boolean) {
        const {context, job} = await this.managableUserCreator.createNormalUser({
            username: model.username,
            host: this.getHost(),
            language: this.getCurrentLanguage(),
            email: model.email,
            description: model.description,
            admin: admin,
            shareCommonKvdb: AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY
        });
        const alert = this.showOnNormalUserCreatedAlert(context.username, context.host, context.password);
        this.finalizeUserCreationAndCloseWindow(alert, job);
    }
    
    private async createBasicUser(model: AddUserModel) {
        const {context, job} = await this.managableUserCreator.createBasicUser({
            username: model.username,
            host: this.getHost(),
            language: this.getCurrentLanguage(),
            description: model.description,
            privateSectionAllowed: model.privateSectionAllowed || false,
        });
        const alert = this.showOnBasicUserCreatedAlert(context.username, context.host, context.password);
        this.finalizeUserCreationAndCloseWindow(alert, job);
    }
    
    // ======================
    //       PRIVATE
    // ======================
    
    private tryCreatePrivateUser(data: AddUserModel): void {
        const emailRequired = this.isEmailRequired(data);
        if (emailRequired && !data.email) {
            this.callViewMethod("unlockForm");
            this.showInvalidEmailOptionsAlert();
            return;
        }
        this.withLockAgainstClosing(async () => {
            try {
                await this.createPrivateUser(data);
            }
            catch (e) {
                this.callViewMethod("unlockForm");
                if (this.isUserAlreadyExistsError(e)) {
                    this.showUserAlreadyExistsAlert();
                }
                else if (this.isInvalidEmailError(e)) {
                    this.showRequiredEmailAlert(emailRequired);
                }
                else if (this.isInvalidUsernameError(e)) {
                    this.showInvalidUsernameAlert();
                }
                else {
                    throw e;
                }
            }
        });
    }
    
    private async createPrivateUser(model: AddUserModel) {
        if (model.userType == "regular") {
            return this.createRegularPrivateUser(model);
        }
    }
    
    private async createRegularPrivateUser(model: AddUserModel) {
        const result = await this.privateUserCreator.createPrivateUser({
            creator: this.identity.user,
            username: model.username,
            host: this.getHost(),
            language: this.getCurrentLanguage(),
            email: model.email,
            description: model.description,
            notificationEnabled: model.notificationEnabled,
            sendActivationLink: model.sendActivationLink,
            shareCommonKvdb: AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY
        });
        const alert = this.showOnPrivateUserCreatedAlert(result.linkSent, result.email, result.activationToken, result.shareCommonKvdb);
        this.finalizeUserCreationAndCloseWindow(alert);
    }
    
    // ======================
    //       HELPERS
    // ======================
    
    private getCurrentLanguage() {
        return this.app.localeService.currentLang;
    }
    
    private getHost() {
        return this.gateway.getHost();
    }
    
    private isEmailRequired(data: AddUserModel) {
        return data.notificationEnabled || data.sendActivationLink;
    }
    
    private isUserAlreadyExistsError(e: any) {
        return privfs.core.ApiErrorCodes.is(e, "USER_ALREADY_EXISTS");
    }
    
    private isInvalidEmailError(e: any) {
        return privfs.core.ApiErrorCodes.is(e, "INVALID_EMAIL");
    }
    
    private isInvalidUsernameError(e: any) {
        return privfs.core.ApiErrorCodes.is(e, "FORBIDDEN_USERNAME") || privfs.core.ApiErrorCodes.is(e, "INVALID_USERNAME");
    }
    
    // ====================
    //       JOBS
    // ====================
    
    private withLockAgainstClosing(func: () => any) {
        this.addTaskEx("", true, async () => {
            try {
                this.setLockAgainstClosing();
                await func();
            }
            finally {
                this.resetLockAgainstClosing();
            }
        });
    }
    
    private setLockAgainstClosing(): void {
        this.nwin.setClosable(false);
    }
    
    private resetLockAgainstClosing(): void {
        this.nwin.setClosable(true);
    }
    
    private finalizeUserCreationAndCloseWindow(finalAlert: Q.Promise<any>, additionalJob?: Promise<any>) {
        const finalJob = this.createAndTriggerFinalJob(additionalJob);
        finalAlert.then(() => {
            this.waitForJobAndCloseWindow(finalJob);
        });
    }
    
    private async createAndTriggerFinalJob(job?: Promise<any>) {
        await job;
        await this.refreshUsersCollection();
    }
    
    private async refreshUsersCollection() {
        await this.userAdminService.refreshUsersCollection();
    }
    
    private async waitForJobAndCloseWindow(job: Promise<any>) {
        try {
            await job;
        }
        catch (e) {
            this.logErrorCallback(e);
        }
        finally {
            this.close();
        }
    }
    
    // ====================
    //       ALERTS
    // ====================
    
    private showNoUsernameAlert() {
        return this.alert(this.i18n("window.admin.userAdd.error.noUsername"));
    }
    
    private showInvalidEmailOptionsAlert() {
        return this.alert(this.i18n("window.admin.userAdd.error.invalidEmailOptions"));
    }
    
    private showUserAlreadyExistsAlert() {
        return this.alert(this.i18n("window.admin.userAdd.error.userAlreadyExists"));
    }
    
    private showInvalidEmailAlert() {
        return this.alert(this.i18n("window.admin.userAdd.error.invalidEmail"));
    }
    
    private showInvalidUsernameAlert() {
        return this.alert(this.i18n("window.admin.userAdd.error.invalidUsername"));
    }
    
    private showRequiredEmailAlert(emailRequired: boolean) {
        return emailRequired ? this.showInvalidEmailOptionsAlert() : this.showInvalidEmailAlert();
    }
    
    private showOnBasicUserCreatedAlert(username: string, host: string, password: string) {
        return this.showOnManagableUserCreatedAlert({
            username: username,
            host: host,
            password: password,
            isExternalUser: true,
            height: 290
        });
    }
    
    private showOnNormalUserCreatedAlert(username: string, host: string, password: string) {
        return this.showOnManagableUserCreatedAlert({
            username: username,
            host: host,
            password: password,
            isExternalUser: false,
            height: 260
        });
    }
    
    private showOnManagableUserCreatedAlert(model: ManagableAlertModel) {
        return this.alertEx({
            width: 560,
            height: model.height,
            focusOn: "",
            contentTemplate: {
                templateId: "adminEditUserResetSummaryTemplate",
                model: {
                    username: model.username,
                    hashmail: model.username + "#" + model.host,
                    password: model.password,
                    createMode: true,
                    isExternalUser: model.isExternalUser
                }
            },
            extraHandlers: {
                "send-link": () => this.app.sendActivationData(model.username, model.password)
            }
        });
    }
    
    private showOnPrivateUserCreatedAlert(linkSent: privfs.core.LinkSentStatus, email: string, activationToken: string, shareKvdb: boolean) {
        const {moreInfo, info} = this.getAfterPrivateUserCreationAlertMessage(linkSent, email, shareKvdb);
        return this.promptEx({
            message: this.i18n("window.admin.userAdd.info") + " " + moreInfo,
            info: info,
            height: 220,
            autoHeight: true,
            width: 600,
            input: {
                value: activationToken,
                multiline: true,
                readonly: true,
                continous: true,
                height: 83
            },
            cancel: {
                visible: false
            }
        });
    }
    
    private getAfterPrivateUserCreationAlertMessage(linkSent: privfs.core.LinkSentStatus, email: string, shareKvdb: boolean) {
        if (shareKvdb) {
            return {
                moreInfo: this.i18n("window.admin.userAdd.info.send", email),
                info: ""
            };
        }
        return {
            moreInfo: this.getMoreInfo(linkSent, email),
            info: this.i18n("window.admin.userAdd.info2")
        };
    }
    
    private getMoreInfo(linkSent: privfs.core.LinkSentStatus, email: string) {
        if (linkSent == privfs.core.LinkSentStatus.ERROR) {
            return this.i18n("window.admin.userAdd.info.unknownError", email);
        }
        else if (linkSent == privfs.core.LinkSentStatus.INVALID_CONFIG) {
            return this.i18n("window.admin.userAdd.info.invalidConfigError", email);
        }
        else if (linkSent == privfs.core.LinkSentStatus.NOT_WANTED) {
            return this.i18n("window.admin.userAdd.info.send");
        }
        else if (linkSent == privfs.core.LinkSentStatus.SENT) {
            return this.i18n("window.admin.userAdd.info.sent", email);
        }
        return "";
    }
}
