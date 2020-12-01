import * as Types from "../../Types";
import { SectionManager } from "../../mail/section";
import { TooltipController } from "../tooltip/main";
import {Inject, Dependencies} from "../../utils/Decorators";
import { PersonService } from "../../mail/person";
import { ContactService } from "../../mail/contact";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export class SectionModel {
    id: string;
    name: string;
    parentId: string;
    parentName: string;
    modules: { chat: boolean, notes2: boolean, tasks: boolean, calendar: boolean };
    group: { type: string, users: string[] };
    groupListModel: { admins: boolean, all: boolean, users: string[] };
    acl: {
        createSubsections: { admins: boolean, all: boolean, users: string[] };
        manage: { admins: boolean, all: boolean, users: string[] };
    };
    scope: string;
    host: string;
    usernames: { [hashmail: string ] : string };
}

export class SectionTooltipController extends TooltipController {
    
    static textsPrefix: string = "component.sectionTooltip.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject sectionManager: SectionManager;
    @Inject identityProvider: Types.utils.IdentityProvider;
    @Inject personService: PersonService;
    @Inject contactService: ContactService;
    
    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    onViewRequestContent(sectionId: string): void {
        let model: SectionModel = null;
        let host = this.identityProvider.getIdentity().host;
        if (this.sectionManager) {
            let section = this.sectionManager ? this.sectionManager.getSection(sectionId) : null;
            if (section) {
                let data = this.sectionManager ? section.getSectionUpdateModelDecrypted() : null;
                let parent = this.sectionManager.getSection(data.parentId);
                model = data ? {
                    id: sectionId,
                    name: section.getName(),
                    parentId: data.parentId,
                    parentName: parent ? parent.getFullSectionName(true, false, false) : "",
                    modules: {
                        chat: data.data.modules["chat"] ? data.data.modules["chat"].enabled : false,
                        notes2: data.data.modules["file"] ? data.data.modules["file"].enabled : false,
                        tasks: data.data.modules["kvdb"] ? data.data.modules["kvdb"].enabled : false,
                        calendar: data.data.modules["calendar"] ? data.data.modules["calendar"].enabled : false,
                    },
                    group: data.group,
                    groupListModel: { admins: data.group.type == "admin", all: data.group.type == "local", users: data.group.users.filter(x => section.contactHasAccess(this.contactService.getContactByHashmail(x + "#" + host))) },
                    acl: {
                        createSubsections: {
                            admins: data.acl.createSubsections.admins,
                            all: data.acl.createSubsections.all,
                            users: data.acl.createSubsections.users.filter(x => section.contactCanCreateSubsections(this.contactService.getContactByHashmail(x + "#" + host))),
                        },
                        manage: {
                            admins: data.acl.manage.admins,
                            all: data.acl.manage.all,
                            users: data.acl.manage.users.filter(x => section.contactCanManage(this.contactService.getContactByHashmail(x + "#" + host))),
                        }
                    },
                    scope: section.getScope(),
                    host: this.identityProvider.getIdentity().host,
                    usernames: this.getUsernames([data.acl.createSubsections.users, data.acl.manage.users, data.group.users]),
                } : null;
            }
        }
        this.callViewMethod("setContent", sectionId, JSON.stringify(model));
    }
    
    getUsernames(usernamesArrs: string[][]): { [key: string]: string } {
        let hash = "#" + this.identityProvider.getIdentity().host;
        let usernames: { [key: string]: string } = {};
        for (let arr of usernamesArrs) {
            for (let hashmail of arr.filter(x => this.contactService.getContactByHashmail(x + hash) != null)) {
                let user = this.personService.getPerson(hashmail + hash);
                usernames[hashmail] = hashmail;
                if (user && user.contact && user.contact.profile && user.contact.profile.name) {
                    usernames[hashmail] = user.contact.profile.name;
                }
            }
        }
        return usernames;
    }
    
}