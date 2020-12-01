import {WindowComponentController} from "../../base/WindowComponentController";
import {AdminWindowController} from "../AdminWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {PromiseUtils} from "simplito-promise";
import {UserAdminService} from "../../../mail/UserAdminService";
import {HashmailResolver} from "../../../mail/HashmailResolver";
import {MessageService} from "../../../mail/MessageService";
import {Inject} from "../../../utils/Decorators";
import { LocaleService } from "../../../mail";
import { i18n } from "./i18n";

export interface SendResult {
    username: string;
    status: string;
}

export interface ProgressModel {
    type: string;
    i: number;
    size: number;
    username: string;
}

export class SysMsgController extends WindowComponentController<AdminWindowController> {
    
    static textsPrefix: string = "window.admin.sysimg.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "sysmsg";
    
    @Inject identity: privfs.identity.Identity;
    @Inject userAdminService: UserAdminService;
    @Inject hashmailResolver: HashmailResolver;
    @Inject messageService: MessageService;
    
    constructor(parent: AdminWindowController) {
        super(parent);
        this.ipcMode = true;
        this.identity = this.parent.identity;
        this.userAdminService = this.parent.userAdminService;
        this.hashmailResolver = this.parent.hashmailResolver;
        this.messageService = this.parent.messageService;
    }
    
    onViewSendSysMsg(channelId: number, title: string, text: string): void {
        let results: SendResult[] = [];
        this.addTaskExWithProgress(this.i18n(""), true, channelId, notify => {
            return Q().then(() => {
                return this.userAdminService.refreshUsersCollection();
            })
            .then(() => {
                let users = this.userAdminService.usersCollection.getListCopy();
                return PromiseUtils.oneByOne(users, (i, user) => {
                    let progressModel: ProgressModel = {
                        type: "mail-info",
                        i: parseInt(i),
                        size: users.length,
                        username: user.username
                    };
                    notify(progressModel);
                    if (!user.activated) {
                        return results.push({
                            username: user.username,
                            status: "no-activated"
                        });
                    }
                    if (!user.cachedPkiEntry || !user.cachedPkiEntry.sinks || user.cachedPkiEntry.sinks.length == 0) {
                        return results.push({
                            username: user.username,
                            status: "no-sink"
                        });
                    }
                    return Q().then(() => {
                        return this.hashmailResolver.resolveHashmail(user.username + "#" + this.identity.host);
                    })
                    .then(u => {
                        if (!u || !u.receivers || u.receivers.length == 0) {
                            throw "no-sink";
                        }
                        let message = this.messageService.createMessage(u.receivers[0], title, text);
                        return this.messageService.sendSimpleMessage(message);
                    })
                    .then(info => {
                        if (info[0].success) {
                            results.push({
                                username: user.username,
                                status: "ok"
                            });
                        }
                        else {
                            this.logError(info[0].couse);
                            results.push({
                                username: user.username,
                                status: "error"
                            });
                        }
                    })
                    .fail(e => {
                        this.logError(e);
                        results.push({
                            username: user.username,
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
    
    prepare(): void {
    }
}
