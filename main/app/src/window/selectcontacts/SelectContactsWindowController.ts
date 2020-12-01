import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {app, utils} from "../../Types";
import {Contact} from "../../mail/contact/Contact";
import {Inject, Dependencies} from "../../utils/Decorators"
import {UtilApi} from "../../mail/UtilApi";
import {ContactService} from "../../mail/contact/ContactService";
import { PersonsController } from "../../component/persons/PersonsController";
import { SectionUtils } from "../../mail/section/SectionUtils";
import { Person, PersonService } from "../../mail/person";
import { SectionService, SectionManager, Conv2Service, Conv2Section } from "../../mail/section";
import { NotificationController } from "../../component/notification/NotificationController";
import { LocaleService, UserPreferences } from "../../mail";
import { i18n } from "./i18n";

// export type Contactable = Contact|string;

export interface ContactEntry {
    type: "contact" | "group" | "section" | "userGroup";
    id: string;
    hashmail?: string;
    avatar?: string;
    isStarred?: boolean;
    displayName: string;
    isPublic?: boolean;
}

export interface Options {
    message: string;
    editable: boolean;
    hashmails: string[];
    allowMyself?: boolean;
    allowGroups?: boolean;
    allowSections?: boolean;
    fromServerUsers?: boolean;
    allowEmpty?: boolean;
    allowExternalUsers?: boolean;
    allowUserGroups?: boolean;
}

export interface Model {
    message: string;
    choosenContacts: ContactEntry[];
    othersContacts: ContactEntry[];
    editable: boolean;
    allowEmpty: boolean;
}

export type Hashmails = string[];

@Dependencies(["persons", "notification"])
export class SelectContactsWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.selectContacts.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    @Inject utilApi: UtilApi;
    @Inject personService: PersonService;
    @Inject contactService: ContactService;
    @Inject sectionManager: SectionManager;
    @Inject identityProvider: utils.IdentityProvider;
    @Inject conv2Service: Conv2Service;
    @Inject userPreferences: UserPreferences.UserPreferences;
    options: Options;
    deferred: Q.Deferred<Hashmails>;
    availableHashmails: string[];
    personsComponent: PersonsController;
    groups: string[];
    sections: SectionService[];
    notifications: NotificationController;
    userGroups: Conv2Section[];
    
    constructor(parent: app.WindowParent, options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.options = options;
        this.options.allowExternalUsers = options.allowExternalUsers !== false ? true : false;
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            maximizable: false,
            show: false,
            position: "center",
            width: 650,
            height: 350,
            resizable: false,
            modal: true,
            
            title: this.i18n("window.selectContacts.title")
        };
        this.deferred = Q.defer();
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.groups = [];
        this.sections = [];
    }
    
    init() {
        this.sections = this.sectionManager.filteredCollection.list.filter(x => !x.isPrivateOrUserGroup() && x.isFileModuleEnabled());
        this.userGroups = this.conv2Service.collection.list.filter(x => !x.isSingleContact());
        if (!this.options.fromServerUsers) {
            return;
        }
        return Q().then(() => {
            return this.personService.synchronizeWithUsernames();
        })
        .then(() => {
            return this.app.mailClientApi.privmxRegistry.getIdentityProvider();
        })
        .then(identityProvider => {
            this.groups = this.options.allowGroups ? SectionUtils.getPredefinedGroups(identityProvider.getRights()) : [];
            return this.utilApi.getUsernames();
        })
        .then(usernames => {
            this.availableHashmails = usernames.filter(x => {
                if (! this.options.allowMyself && x == this.identity.user) {
                    return false;
                }

                return true;
            }).map(x => x + "#" + this.identity.host);
        });
    }
    
    getPromise(): Q.Promise<Hashmails> {
        return this.deferred.promise;
    }
    
    invalidHashmail(hashmail: string): boolean {
        return (!this.options.allowMyself && hashmail == this.identity.hashmail) || hashmail.indexOf("chat-channel-") == 0 || hashmail.indexOf("anonymous#") == 0 || hashmail.indexOf("@") != -1 || this.groups.indexOf(hashmail) != -1;
    }
    
    invalidGroup(groups: string[], group: string): boolean {
        return groups.indexOf(group) == -1;
    }
    
    getModel(): Model {
        let othersContacts: ContactEntry[] = [];
        if (this.availableHashmails) {
            this.availableHashmails.forEach(hashmail => {
                let contact = this.contactService.getContactByHashmail(hashmail);
                if (contact != null) {
                    if (! this.options.allowExternalUsers && contact.basicUser) {
                        return;
                    }
                    othersContacts.push(this.convertToContactEntry(contact));
                }
                else {
                    let person = this.personsComponent.persons.get(hashmail);
                    if (person != null) {
                        othersContacts.push(this.convertToContactEntry(person));
                    }
                }
            });
        }
        else {
            this.contactService.contactCollection.forEach(contact => {
                if (contact.isEmail() || this.invalidHashmail(contact.getHashmail())) {
                    return;
                }
                othersContacts.push(this.convertToContactEntry(contact));
            });
        }
        if (this.options.allowGroups) {
            this.groups.forEach(group => {
                othersContacts.push(this.convertToContactEntry(group));
            })
        }
        if (this.options.allowSections) {
            this.sections.forEach(section => {
                othersContacts.push(this.convertToContactEntry(section));
            });
        }
        if (this.options.allowUserGroups) {
            this.userGroups.forEach(userGroup => {
                othersContacts.push(this.convertToContactEntry(userGroup));
            });
        }

        // othersContacts = othersContacts.sort((a, b) => {
        //     if (a.type == "group" && b.type != "group") {
        //         return -1;
        //     }
        //     else if (b.type == "group" && a.type != "group") {
        //         return 1;
        //     }
        //     else if (a.type == "contact" && (b.type == "section" || b.type == "userGroup")) {
        //         return 1;
        //     }
        //     else if (b.type == "contact" && (a.type == "section" || a.type == "userGroup")) {
        //         return -1;
        //     }
        //     else if (a.type == "userGroup" && b.type == "section") {
        //         return 1;
        //     }
        //     else if (b.type == "userGroup" && a.type == "section") {
        //         return -1;
        //     }
        //     else if (a.type == "userGroup" && b.type == "userGroup") {
        //         let res = a.displayName.split(",").length < b.displayName.split(",").length ? -1 : 1;
        //         console.log("comparing usergroups", a.displayName, "with", b.displayName, "result: ", res)

        //         return res;
        //     }
        //     else {
        //         return a.displayName.localeCompare(b.displayName)
        //     }
        // });

        let choosenContacts: ContactEntry[] = [];
        if (this.options.hashmails) {
            this.options.hashmails.forEach(hashmail => {
                if (!this.invalidHashmail(hashmail)) {
                    let hashmailObj = new privfs.identity.Hashmail(hashmail);
                    if (this.contactService.deletedUsers.indexOf(hashmailObj.user) > -1) {
                        return;
                    }
                }
                if (!this.invalidGroup(this.groups, hashmail)) {
                    let entry = this.convertToContactEntry(hashmail);
                    let index = this.indexOfContact(othersContacts, entry);
                    if (index != -1) {
                        othersContacts.splice(index, 1);
                    }
                    
                    choosenContacts.push(entry);
                    return;
                }
                
                if (this.invalidHashmail(hashmail)) {
                    return;
                }
                
                let contact = this.contactService.getContactByHashmail(hashmail);
                if (!contact || contact.isEmail()) {
                    return;
                }
                let index = this.indexOfContact(othersContacts, this.convertToContactEntry(contact));
                if (index != -1) {
                    othersContacts.splice(index, 1);
                }
                
                choosenContacts.push(this.convertToContactEntry(contact));
            });
        }
        
        return {
            message: this.options.message,
            choosenContacts: choosenContacts,
            othersContacts: othersContacts,
            editable: this.options.editable,
            allowEmpty: !!this.options.allowEmpty
        };
    }
    
    indexOfContact(list: ContactEntry[], contact: ContactEntry) {
        if (!contact) {
            return -1;
        }
        let index: number = -1;
        list.forEach((x, i) => {
            if (x && contact.id == x.id && contact.hashmail == x.hashmail) {
                index = i;
                return;
            }
        });
        return index;
    }
    
    convertToContactEntry(contact: Contact|Person|SectionService|Conv2Section|String): ContactEntry {
        if (contact instanceof Contact) {
            return {
                type: "contact",
                id: contact.getHashmail(),
                hashmail: contact.getHashmail(),
                displayName: contact.getDisplayNameWithHashmail()
            };
        }
        else if (contact instanceof Person) {
            return {
                type: "contact",
                id: contact.getHashmail(),
                hashmail: contact.getHashmail(),
                displayName: contact.getName()
            };
        }
        else if (contact instanceof SectionService) {
            return {
                type: "section",
                id: contact.getId(),
                hashmail: contact.getId(),
                displayName: contact.getFullSectionName(true),
                isPublic: contact.getScope() == "public",
            };
        }
        else if (contact instanceof Conv2Section) {
            return {
                type: "userGroup",
                id: contact.id,
                displayName: this.getConv2SectionDisplayName(contact),
            }
        }
        else if (typeof(contact) === "string") {
            if (this.groups.indexOf(contact) > -1) {
                return {
                    type: "group",
                    id: contact,
                    displayName: this.i18n("core.usersgroup." + contact.substring(1, contact.length - 1)),
                }
            }
            else {
                return {
                    type: "contact",
                    id: contact,
                    hashmail: contact,
                    displayName: contact
                }
            }
        }
    }
    
    getConv2SectionDisplayName(c2s: Conv2Section): string {
        let customNames = this.userPreferences.getCustomSectionNames();
        if (c2s.id in customNames && customNames[c2s.id]) {
            return customNames[c2s.id];
        }
        return c2s.persons.map(x => x.getName() != x.username ? `${x.getName()} (${x.username})` : x.getName()).join(", ");
    }
    
    onViewConfirm(contacts: ContactEntry[]): void {
        let hashmails: string[] = [];
        contacts.forEach(contact => {
            hashmails.push(contact.id);
        });
        this.deferred.resolve(hashmails);
        this.close();
    }
    
    onViewCancel(): void {
        this.close();
    }
    
    onViewNotifyNotAllowed() {
        let str = this.i18n("window.selectContacts.notAllowed");
        this.notifications.showNotification(str, {
            duration: 2000,
        });
    }
}
