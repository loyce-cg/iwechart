import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {PromiseUtils} from "simplito-promise";
import {UserAdminService} from "../../../mail/UserAdminService";
import {HashmailResolver} from "../../../mail/HashmailResolver";
import {MessageService} from "../../../mail/MessageService";
import {Inject} from "../../../utils/Decorators";
import { SelectContactsWindowController } from "../../selectcontacts/SelectContactsWindowController";
import { Conv2Service } from "../../../mail/section/Conv2Service";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export interface SendResult {
    hashmail: string;
    username: string;
    name: string;
    status: string;
}

export interface ProgressModel {
    type: string;
    i: number;
    size: number;
    username: string;
}

export interface Model {
    usersInfo: UsersInfo;
}

export interface UsersInfo {
    all: boolean;
    admins: boolean;
    users: {
        hashmail: string;
        username: string;
        name: string;
    }[];
}

export class PrivMsgController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.privmsg.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "privmsg";
    
    @Inject identity: privfs.identity.Identity;
    @Inject userAdminService: UserAdminService;
    @Inject hashmailResolver: HashmailResolver;
    @Inject messageService: MessageService;
    
    hashmails: string[];
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.identity = this.parent.identity;
        this.userAdminService = this.parent.userAdminService;
        this.hashmailResolver = this.parent.hashmailResolver;
        this.messageService = this.parent.messageService;
        this.hashmails = ["<local>"];
    }
    
    getUsersInfo(hashmails: string[]): UsersInfo {
        return {
            all: hashmails.indexOf("<local>") != -1,
            admins: hashmails.indexOf("<admins>") != -1,
            users: hashmails.filter(x => x != "<local>" && x != "<admins>").map(x => ({
                hashmail: x,
                username: x.split("#")[0],
                name: this.parent.personsComponent.persons.get(x).getName()
            }))
        };
    }
    
    prepare(): Q.Promise<void> {
        this.hashmails = ["<local>"];
        return Q().then(() => {
            let model: Model = {
                usersInfo: this.getUsersInfo(this.hashmails)
            };
            this.callViewMethod("renderContent", model);
        });
    }
    
    onViewChooseUsers() {
        this.app.ioc.create(SelectContactsWindowController, [this.parent, {
            editable: true,
            hashmails: this.hashmails,
            fromServerUsers: true,
            allowGroups: true,
            allowEmpty: true,
            message: this.i18n("window.admin.privmsg.chooseUsers")
        }])
        .then(win => {
            this.parent.openChildWindow(win).getPromise().then(hashmails => {
                this.hashmails = hashmails;
                this.callViewMethod("updateUsers", this.getUsersInfo(this.hashmails));
            });
        });
    }
    
    onViewSendSysMsg(channelId: number, text: string): void {
        let results: SendResult[] = [];
        if (!text) {
            return;
        }
        this.addTaskExWithProgress(this.i18n(""), true, channelId, notify => {
            let hasLocalUsers = this.hashmails.indexOf("<local>") != -1;
            let hasAdmins = this.hashmails.indexOf("<admins>") != -1;
            let hashmails = this.hashmails.filter(x => x != "<local>" && x != "<admins>");
            let conv2Service: Conv2Service;
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getConv2Service()
            ])
            .then(res => {
                conv2Service = res[0];
                return hasLocalUsers || hasAdmins ? this.userAdminService.refreshUsersCollection() : null;
            })
            .then(() => {
                let choosenUsers = hasLocalUsers ? this.userAdminService.usersCollection.getListCopy().filter(user => !user.loginAlias || (user.loginAlias && user.loginAlias.length == 0)).map(x => x.username + "#" + this.identity.host) : [];
                let choosenAdmins = hasAdmins ? this.userAdminService.usersCollection.getListCopy().filter(user => user.isAdmin).filter(user => !user.loginAlias || (user.loginAlias && user.loginAlias.length == 0)).map(x => x.username + "#" + this.identity.host) : [];
                hashmails = hashmails.concat(choosenUsers.filter(x => hashmails.indexOf(x) == -1 && x != this.identity.hashmail));
                hashmails = hashmails.concat(choosenAdmins.filter(x => hashmails.indexOf(x) == -1 && x != this.identity.hashmail));
                return PromiseUtils.oneByOne(hashmails, (i, hashmail) => {
                    let progressModel: ProgressModel = {
                        type: "mail-info",
                        i: parseInt(i),
                        size: hashmails.length,
                        username: this.parent.personsComponent.persons.get(hashmail).getName()
                    };
                    notify(progressModel);
                    return Q().then(() => {
                        let conversationId = conv2Service.getConvIdFromHashmails([hashmail]);
                        let conv2Users = conv2Service.getUsersFromConvId(conversationId);
                        let conversation = conv2Service.collection.find(x => x.id == conversationId);
                        if (conversation == null) {
                            conversation = conv2Service.getOrCreateConv(conv2Users, true);
                        }
                        if (conversation.hasSection()) {
                            return conversation.section;
                        }
                        return conv2Service.createUserGroup(conv2Users)
                    })
                    .then(section => {
                        return section.getChatModule().sendMessage({text: text});
                    })
                    .then(() => {
                        results.push({
                            hashmail: hashmail,
                            username: hashmail.split("#")[0],
                            name: this.parent.personsComponent.persons.get(hashmail).getName(),
                            status: "ok"
                        });
                    })
                    .fail(e => {
                        this.logError(e);
                        results.push({
                            hashmail: hashmail,
                            username: hashmail.split("#")[0],
                            name: this.parent.personsComponent.persons.get(hashmail).getName(),
                            status: "error"
                        });
                    });
                });
            })
            .then(() => {
                this.callViewMethod("showSendSysMsgResults", results);
            });
        });
    }
}
