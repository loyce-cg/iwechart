import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {Contact, ContactProfile, ContactType, SerializedContact} from "./Contact";
import {ImageTypeDetector} from "../../utils/ImageTypeDetector";
import {HashmailResolver} from "../HashmailResolver";
import {Model} from "../../utils/Model";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {Contacts} from "./Contacts";
import {mail} from "../../Types";
import { UtilApi } from "..";
import { Lang } from "../../utils/Lang";
import * as PmxApi from "privmx-server-api";
import { KvdbMap } from "../kvdb/KvdbMap";

let Logger = RootLogger.get("privfs-mail-client.mail.ContactService");

export interface StarredContactsPresenceModel {
    newCount: number;
    currentState: string[];
}

export type WithVersion<T> = T&{version?: number};
export type BaseCollectionWithVersion<T> = WithVersion<BaseCollection<T>>;
export type MutableCollectionWithVersion<T> = WithVersion<MutableCollection<T>>;

export class ContactService {
    
    starredContactsPresenceModel: Model<StarredContactsPresenceModel>;
    starredContactCountModel: Model<number>;
    contactCollection: MutableCollectionWithVersion<Contact>;
    initPromise: Q.Promise<Contacts>;
    defer: Q.Deferred<Contacts>;
    synchronizationTimer: any = null;
    deletedUsers: string[];
    usersExtraInfo: {[username: string]: PmxApi.api.user.UsernameEx} = {};
    
    constructor(
        public identity: privfs.identity.Identity,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public lowUserProvider: mail.LowUserProvider,
        public hashmailResolver: HashmailResolver,
        public utilApi: UtilApi
    ) {
        this.defer = Q.defer();
        this.starredContactsPresenceModel = new Model({
            currentState: [],
            newCount: 0
        });
        this.starredContactCountModel = new Model(0);
        this.starredContactsPresenceModel.changeEvent.add(() => {
            this.starredContactCountModel.setWithCheck(this.starredContactsPresenceModel.get().newCount);
        });
        this.contactCollection = new MutableCollection([]);
        this.deletedUsers = [];
    }
    
    destroy() {
        this.starredContactsPresenceModel.destroy();
        this.starredContactsPresenceModel.destroy();
        this.contactCollection.destroy();
    }
    
    init(kvdb: KvdbMap<SerializedContact>): Q.Promise<Contacts> {
        if (this.initPromise == null) {
            this.initPromise = Q().then(() => {
                let contactsDb = new Contacts(this.contactCollection, kvdb);
                this.defer.resolve(contactsDb);
                return contactsDb;
            });
        }
        return this.initPromise;
    }
    
    getContactsDb(): Q.Promise<Contacts> {
        return this.defer.promise;
    }
    
    refreshContact(hashmail: string, quiet?: boolean): Q.Promise<Contact> {
        return Q().then(() => {
            let contact = this.getContactByHashmail(hashmail);
            if (!contact) {
                if (quiet) {
                    return null;
                }
                throw new Error("ContactNotFound");
            }
            if (contact.isEmail()) {
                return;
            }
            return this.hashmailResolver.resolveHashmail(hashmail, true)
            .then(result => {
                let newRevision = result.data.keystoreMsg.getLeaf().getRevision().toString("hex");
                let newProfile = this.convertProfile(result.data.profile);
                if (!this.compareProfiles(contact.profile, newProfile) || contact.revision != newRevision) {
                    return this.updateContact(contact.getHashmail(), contact => {
                        contact.profile = newProfile;
                        contact.revision = newRevision;
                        contact.validateNames();
                        contact.dataVersion = new Date().getTime();
                    });
                }
                return contact;
            });
        });
    }

    addUserToContactCore(user: privfs.identity.User, sink: privfs.message.MessageSink, checkExisting?: boolean, refreshDuringAdd?: boolean, refreshExisting?: boolean) {
        if (user.user == "anonymous") {
            return Q<void>(null);
        }
        let lowUser = this.lowUserProvider.getLowUserByUser(user);
        if (lowUser == null) {
            if (checkExisting === false || this.getContactByHashmail(user.hashmail) == null) {
                return this.addToContacts(user, sink, refreshDuringAdd !== false);
            }
            else if (refreshExisting) {
                return this.refreshContact(user.hashmail).then(() => {});
            }
        }
        else {
            return this.addEmailToContacts(lowUser.email);
        }
    }
    
    addSenderToContacts(indexEntry: SinkIndexEntry, refreshDuringAdd?: boolean, refreshExisting?: boolean) {
        let msg = indexEntry.getMessage();
        if (indexEntry.isContactFormMessage()) {
            let email = indexEntry.getContactFormMessageSender();
            return this.addEmailToContacts(email);
        }
        else {
            return this.addUserToContactCore(msg.sender, null, true, refreshDuringAdd, refreshExisting);
        }
    }
    
    addReceiverToContacts(receiver: privfs.message.MessageReceiver, forceRefresh?: boolean) {
        return this.addUserToContactCore(receiver.user, receiver.sink, false, forceRefresh);
    }
    
    addSenderAndReceiversToContacts(indexEntry: SinkIndexEntry): void {
        let msg = indexEntry.getMessage();
        this.addSenderToContacts(indexEntry, true, true);
        msg.receivers.forEach(receiver => {
            this.addReceiverToContacts(receiver, false);
        });
    }
    
    compareProfiles(a: ContactProfile, b: ContactProfile): boolean {
        return a.description == b.description && a.image == b.image && a.name == b.name;
    }
    
    convertProfile(profile: privfs.types.core.UserInfoProfile): ContactProfile {
        return {
            name: profile.name,
            description: profile.description,
            image: profile.image == null ? null : ImageTypeDetector.createDataUrlFromBuffer(profile.image)
        };
    }
    
    createContact(hashmail: string, basicUser?: boolean, basicName?: string, isAdmin?: boolean): Q.Promise<Contact> {
        Logger.debug("on createContact");
        return Q().then(() => {
            return this.getContactsDb();
        })
        .then(contactsDb => {
            let contact = this.getContactByHashmail(hashmail);
            if (contact != null) {
                return contact;
            }
            return Q().then(() => {
                return this.hashmailResolver.resolveHashmail(hashmail, true);
            })
            .then(info => {
                return contactsDb.set(hashmail, (contact) => {
                    contact.dataVersion = new Date().getTime();
                    contact.user = info.data.user;
                    contact.user.name = null;
                    contact.sinks = [];
                    contact.starred = false;
                    contact.revision = info.data.keystoreMsg.getLeaf().getRevision().toString("hex");
                    contact.profile = this.convertProfile(info.data.profile);
                    contact.basicUser = basicUser;
                    contact.basicName = basicName;
                    contact.isAdmin = isAdmin;
                    (info.data.profile.sinks || []).forEach(x => {
                        contact.sinks.push(x);
                    });
                    contact.validateNames();
                });
            });
            
        });
    }
    
    createEmailContact(email: string): Q.Promise<Contact> {
        Logger.debug("on createEmailContact");
        return Q().then(() => {
            return this.getContactsDb();
        })
        .then(contactsDb => {
            return contactsDb.set(email, (contact, newlyCreated) => {
                if (!newlyCreated) {
                    return false;
                }
                contact.type = ContactType.EMAIL;
                contact.email = email;
            });
        });
    }
    
    addEmailToContacts(email: string): Q.Promise<void> {
        return this.createEmailContact(email).then(() => {});
    }
    
    addToContacts(user: privfs.identity.User, sink?: privfs.message.MessageSink, forceRefresh?: boolean): Q.Promise<void> {
        Logger.debug("on addToContacts");
        return Q().then(() => {
            return this.getContactsDb();
        })
        .then(contactDb => {
            contactDb.set(user.hashmail, (contact, newlyCreated) => {
                if (newlyCreated) {
                    contact.user = user;
                    contact.sinks = [];
                    contact.starred = false;
                    contact.profile = {};
                    if (sink) {
                        contact.sinks.push(sink);
                    }
                    contact.validateNames();
                }
                else {
                    if (!sink) {
                        return false;
                    }
                    let foundSink = null;
                    for (let i = 0; i < contact.sinks.length; i++) {
                        if (contact.sinks[i].id == sink.id) {
                            foundSink = contact.sinks[i];
                            break;
                        }
                    }
                    if (foundSink) {
                        return false;
                    }
                    contact.dataVersion = new Date().getTime();
                    contact.sinks.push(sink);
                }
            });
        })
        .then(() => {
            if (forceRefresh) {
                this.refreshContact(user.hashmail)
                .fail(e => {
                    Logger.error("Error during refreshing contact", user.hashmail, e);
                });
            }
        });
    }
    
    getContactByHashmail(hashmail: string): Contact {
        return this.contactCollection.find(contact => {
            return contact.getHashmail() == hashmail;
        });
    }
    
    getContactByPub58(pub58: string): Contact {
        return this.contactCollection.find(contact => {
            return contact.user && contact.user.pub58 == pub58;
        });
    }
    
    deleteContact(contact: Contact): Q.Promise<void> {
        Logger.debug("on deleteContact");
        return Q().then(() => {
            return this.getContactsDb();
        })
        .then(contactsDb => {
            return contactsDb.remove(contact);
        });
    }
    
    updateContact(hashmail: string, updater: (contact: Contact, newlyCreated: boolean) => any): Q.Promise<Contact> {
        Logger.debug("on updateContact");
        return Q().then(() => {
            return this.getContactsDb();
        })
        .then(contactsDb => {
            return contactsDb.set(hashmail, updater);
        });
    }
    
    hashmailInContacts(hashmail: string): boolean {
        return this.getContactByHashmail(hashmail) != null;
    }
    
    userHasStarredContacts(): boolean {
        let list = this.contactCollection.getEnumerable();
        if (list.length == 0) {
            return false;
        }
        return list.some(contact => {
            return contact.isStarred();
        });
    }
    
    getContactsAcl(onlyStarred?: boolean): privfs.types.core.PresenceAcl {
        let acl: privfs.types.core.PresenceAcl = {
            type: "whitelist",
            pubs: []
        };
        this.contactCollection.forEach(contact => {
            if (contact.isPrivmx() && (onlyStarred == false || contact.isStarred())) {
                acl.pubs.push(contact.user.pub);
            }
        });
        return acl;
    }
    
    updateStarredContactsPresenceModel(): void {
        let model = this.starredContactsPresenceModel.get();
        let currentState: string[] = [];
        let newCount = 0;
        this.contactCollection.forEach(contact => {
            if (contact.isStarred()) {
                let hashmail = contact.getHashmail();
                if (contact.presence) {
                    currentState.push(hashmail);
                    if (model.currentState.indexOf(hashmail) == -1) {
                        newCount++;
                    }
                }
            }
        });
        this.starredContactsPresenceModel.set({
            currentState: currentState,
            newCount: newCount
        });
    }
    
    presenceEquals(a: privfs.types.core.PresenceEntry, b: privfs.types.core.PresenceEntry, checkTimestampDiff?: boolean): boolean {
        if ((a == null && b != null) || (a != null && b == null)) {
            return false;
        }
        if (a != null && b != null) {
            if (a.status != b.status) {
                return false;
            }
            if (checkTimestampDiff && a.timestamp != b.timestamp) {
                return false;
            }
        }
        return true;
    }
    
    synchronizeContacts(users: PmxApi.api.user.UsernameEx[], forceDelete?: boolean): Q.Promise<void> {
        Logger.debug("Synchronizing contacts");
        this.deletedUsers = users.filter(x => x.deleted).map(x => x.username);
        return this.getContactsDb().then(() => {
            let prom = Q();
            for (let contact of this.contactCollection.list) {
                if (!Lang.containsFunc(users, x => x.username == contact.user.user)) {
                    // Logger.debug("Removing contact " + contact.user.user);
                    
                    // standardowo kontakty userow, ktorzy nie schodza z serwera - powinny byc usuwane,
                    // ale ze obecnie usunieci userzy dostaja jedynie flage, ale nie sa stricte usuwani
                    // to usuwanie nie powinno zachodzic
                    // jednoczesnie przy tworzeniu basic usera pozbywamy sie side-effectu usuwania admina, ktory takiego basic usera stworzyl
                    // z listy kontaktow basic usera, a chcielibysmy, zeby taki admin jednak pozostal na liscie usera
                    if (forceDelete) {
                        prom = prom.then(() => { return this.deleteContact(contact); });
                    }
                }
            }
            users.forEach(userEntry => {
                let contact = this.contactCollection.find(x => x.user.user == userEntry.username);
                if (contact == null) {
                    Logger.debug("Adding contact " + userEntry.username);
                    prom = prom.then(() => {
                        return this.createContact(userEntry.username + "#" + this.identity.host, userEntry.type == "basic", userEntry.name, userEntry.isAdmin).thenResolve(null);
                    });
                }
                else if (contact.basicUser != (userEntry.type == "basic") || contact.isAdmin != userEntry.isAdmin) {
                    prom = prom.then(() => {
                        return this.updateContact(userEntry.username + "#" + this.identity.host, c => {
                            c.basicUser = userEntry.type == "basic";
                            c.basicName = userEntry.name;
                            c.dataVersion = (new Date()).getTime();
                            c.isAdmin = userEntry.isAdmin;
                        }).thenResolve(null);
                    })
                }
            });
            return prom;
        });
    }
    
    isUserDeleted(userName: string): boolean {
        return this.deletedUsers.indexOf(userName) > -1;
    }

    updateUsersExtraInfo(usernames: PmxApi.api.user.UsernameEx[]): void {
        usernames.forEach(u => {
            let hashmail = new privfs.identity.Hashmail({user: u.username, host: this.identity.host});
            this.usersExtraInfo[hashmail.hashmail] = u;
        })
    }
    
    getUserExtraInfo(hashmail: string): PmxApi.api.user.UsernameEx {
        return this.usersExtraInfo[hashmail];
    }
    
    updateExtraInfoForUser(hashmail: string, data: PmxApi.api.user.UsernameEx, triggerChangeEvent: boolean): void {
        this.usersExtraInfo[hashmail] = data;
        let contact = this.getContactByHashmail(hashmail);
        if (contact) {
            if (contact.revision != data.pkiRevision) {
                this.refreshContact(hashmail);
            }
            if (triggerChangeEvent) {
                this.contactCollection.updateElement(contact);
            }
        }
    }
    
    updatePkiRevisionForUser(hashmail: string, pkiRevision: PmxApi.api.pki.PkiRevision) {
        let extraInfo = this.getUserExtraInfo(hashmail);
        if (extraInfo != null) {
            extraInfo.pkiRevision = pkiRevision;
        }
        let contact = this.getContactByHashmail(hashmail);
        if (contact != null && contact.revision != pkiRevision) {
            this.refreshContact(hashmail);
        }
    }
}