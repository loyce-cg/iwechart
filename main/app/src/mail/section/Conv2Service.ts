import { SectionManager } from "./SectionManager";
import { SectionService } from "./SectionService";
import * as privfs from "privfs-client";
import { ProxyCollection } from "../../utils/collection/ProxyCollection";
import { SinkIndexEntry } from "../SinkIndexEntry";
import * as nt from "../filetree/NewTree";
import * as Q from "q";
import { MutableCollection } from "../../utils/collection/MutableCollection";
import { Lang } from "../../utils/Lang";
import { SinkIndexStats } from "../SinkIndexStats";
import { Person } from "../person/Person";
import { PersonService } from "../person/PersonService";
import { ContactService } from "../contact/ContactService";
import { Contact } from "../contact/Contact";
import { mail, utils } from "../../Types";
import * as RootLogger from "simplito-logger";
import { MailStats } from "../MailStats";
import { SinkIndex } from "../SinkIndex";
let Logger = RootLogger.get("privfs-mail-client.mail.section.Conv2Section");

export class Conv2Section {
    
    sinkIndex: SinkIndex;
    messagesCollection: ProxyCollection<SinkIndexEntry>;
    filesCollection: ProxyCollection<nt.Entry>;
    fileTree: nt.Tree;
    section: SectionService;
    requestFiles: boolean;
    requestMessages: boolean;
    stats: mail.UnreadStatsBySid;
    
    constructor(
        public id: string,
        public usersId: string,
        public users: string[],
        public persons: Person[],
        public predefined: boolean,
        public conv2Service: Conv2Service
    ) {
        this.messagesCollection = new ProxyCollection();
        this.filesCollection = new ProxyCollection();
    }
    
    static getUsersId(users: string[]): string {
        return users.concat([]).sort().join("|");
    }
    
    hasSection(): boolean {
        return this.section != null;
    }
    
    setSection(section: SectionService): void {
        this.section = section;
        if (this.requestFiles) {
            this.prepareFilesCollection().fail(e => {
                Logger.error("Error during preparing files collection", e);
            });
        }
        if (this.requestMessages) {
            this.prepareMessagesCollection().fail(e => {
                Logger.error("Error during preparing messages collection", e);
            });
        }
    }
    
    hasPreparedMessages(): boolean {
        return this.messagesCollection.collection != null;
    }
    
    prepareMessagesCollection(): Q.Promise<void> {
        this.requestMessages = true;
        if (this.section == null || !this.section.hasChatModule()) {
            return Q();
        }
        return Q().then(() => {
            return this.section.getChatSinkIndex();
        })
        .then(sinkIndex => {
            this.sinkIndex = sinkIndex;
            if (this.messagesCollection.collection != this.sinkIndex.entries) {
                this.messagesCollection.setCollection(this.sinkIndex.entries);
                this.sinkIndex.entries.changeEvent.add(() => {
                    this.conv2Service.collection.updateElement(this);
                }, "multi");
            }
            this.requestMessages = false;
            this.conv2Service.collection.updateElement(this);
        });
    }
    
    hasPreparedFiles(): boolean {
        return this.filesCollection.collection != null;
    }
    
    prepareFilesCollection(): Q.Promise<void> {
        this.requestFiles = true;
        if (this.section == null || !this.section.hasFileModule()) {
            return Q();
        }
        return Q().then(() => {
            return this.section.getFileTree();
        })
        .then(fileTree => {
            this.fileTree = fileTree;
            if (this.filesCollection.collection != this.fileTree.collection) {
                this.filesCollection.setCollection(this.fileTree.collection);
            }
            this.requestFiles = false;
            this.conv2Service.collection.updateElement(this);
        });
    }
    
    getLastTime(): number {
        return this.sinkIndex ? this.sinkIndex.getLastDate() : 0;
    }

    getLastTimeIgnoreSaveFileMessageType(): number {
        return this.sinkIndex ? this.sinkIndex.getLastDateIgnoreSaveFileMessageType() : 0;
    }

    
    getFileMessageLastDate(): number {
        return this.section ? this.section.getFileMessageLastDate() : 0;
    }
    
    isSingleContact(): boolean {
        return this.persons.length == 1 && this.persons[0].hasContact();
    }
    
    getFirstPerson(): Person {
        if (this.persons.length == 0) {
            return null;
        }
        let person = this.persons[0];
        if (person.extraInfo == null) {
            person.extraInfo = this.conv2Service.contactService.getUserExtraInfo(person.getHashmail());
        }
        return person;
    }
    
    hasPerson(person: Person): boolean {
        for (let i = 0; i < this.persons.length; i++) {
            if (this.persons[i] == person) {
                return true;
            }
        }
        return false;
    }
    
    isPredfined(): boolean {
        return !!this.predefined;
    }
    
    canBeRemoved(): boolean {
        return this.section == null && !this.isPredfined() && !this.isSingleContact();
    }
    
    hasDeletedUserOnly(): boolean {
        let allUsersDeleted: boolean = true;
        this.persons.forEach(person => {
            if (person.contact.user.user != this.conv2Service.identity.user && this.conv2Service.contactService.deletedUsers.indexOf(person.contact.user.user) == -1 ) {
                allUsersDeleted = false;
            }
        
        });
        return allUsersDeleted;
    }
}
Object.defineProperty(Conv2Section.prototype, "stats", {
    get: function(this: Conv2Section): mail.UnreadStatsBySid {
        if (this.section && this.section.hasChatModule()) {
            let sinkStats = this.conv2Service.mailStats.map[this.section.getChatSink().id];
            if (sinkStats) {
                return sinkStats.stats.getStats();
            }
        }
        return SinkIndexStats.getEmptyStatsBySid();
    },
    enumerable: true
});

export class Conv2Service {
    
    map: {[usersId: string]: Conv2Section};
    collection: MutableCollection<Conv2Section>;
    createUserGroupsMap: {[usersId: string]: Q.Promise<SectionService>};
    
    constructor(
        public sectionManager: SectionManager,
        public contactService: ContactService,
        public personService: PersonService,
        public identity: privfs.identity.Identity,
        public mailStats: MailStats
    ) {
        sectionManager.customSectionNames.conv2Service = this;
        this.map = {};
        this.createUserGroupsMap = {};
        let conversations: Conv2Section[] = [];
        this.contactService.contactCollection.forEach(contact => {
            if (!this.isValidContact(contact)) {
                return;
            }
            let users = [this.identity.user, contact.getUsername()];
            let usersId = Conv2Section.getUsersId(users);
            let conv = this.map[usersId];
            if (conv == null) {
                conv = this.createConv2("c2:default:" + usersId, users, false);
                this.map[usersId] = conv;
                conversations.push(conv);
            }
        });
        this.collection = new MutableCollection(conversations);
        this.personService.persons.changeEvent.add(this.onPersonChange.bind(this));
        this.sectionManager.filteredCollection.forEach(x => {
            if (x.isUserGroup()) {
                this.addSection(x);
            }
        });
        this.sectionManager.filteredCollection.changeEvent.add(this.onSectionChange.bind(this));
        this.sectionManager.sectionAccessManager.eventDispatcher.addEventListener("refresh-sections", this.onRefreshConversations.bind(this));
    }
    
    onRefreshConversations(): void {
        this.personService.synchronizeWithUsernames(true);
    }
    
    onSectionChange(event: utils.collection.CollectionEvent<SectionService>) {
        if (event.type == "add" || event.type == "update") {
            this.addSection(event.element);
        }
        else if (event.type == "remove") {
            this.removeSection(event.element);
        }
    }
    
    getUsersFromHashmails(hashmails: string[]): string[] {
        let parsed = hashmails.map(x => new privfs.identity.Hashmail(x));
        let users = parsed.map(x => x.user);
        users.push(this.identity.user);
        return users;
    }
    
    getConvIdFromHashmails(hashmails: string[]): string {
        let usersId = Conv2Section.getUsersId(this.getUsersFromHashmails(hashmails));
        return "c2:default:" + usersId;
    }
    
    getUsersFromConvId(convId: string): string[] {
        let splitted = convId.split(":");
        return (splitted[2] || "").split("|");
    }
    
    isValidContact(contact: Contact): boolean {
        return contact.getHost() == this.identity.host && contact.getHashmail() != this.identity.hashmail && !contact.isEmail();
    }
    
    onPersonChange(person: Person): void {
        // console.log("conv2Service onPersonChange", person);
        let toRemove: Conv2Section[] = [];
        this.collection.forEach(conversation => {
            if (conversation.hasPerson(person)) {
                if (conversation.canBeRemoved()) {
                    toRemove.push(conversation);
                }
                else {
                    this.collection.updateElement(conversation);
                }
            }
        });
        for (let i = 0; i < toRemove.length; i++) {
            delete this.map[toRemove[i].id];
            this.collection.remove(toRemove[i]);
        }
        if (person.hasContact() && !person.isEmail() && !person.isAnonymous() && this.isValidContact(person.getContact())) {
            let users = [this.identity.user, person.getContact().getUsername()];
            let usersId = Conv2Section.getUsersId(users);
            if (!(usersId in this.map)) {
                let conv = this.createConv2("c2:default:" + usersId, users, false);
                this.map[usersId] = conv;
                this.collection.add(conv);
            }
        }
    }
    
    createConv2(id: string, users: string[], predefined: boolean): Conv2Section {
        let persons: Person[] = [];
        users.forEach(user => {
            if (user != this.identity.user) {
                persons.push(this.personService.getPerson(user + "#" + this.identity.host));
            }
        });
        return new Conv2Section(id, Conv2Section.getUsersId(users), users, persons, predefined, this);
    }
    
    getOrCreateConv(users: string[], predefined: boolean): Conv2Section {
        if (users.length == 0) {
            return null;
        }
        let usersId = Conv2Section.getUsersId(users);
        let conv = this.collection.find(x => x.usersId == usersId);
        if (conv == null) {
            conv = this.createConv2("c2:default:" + usersId, users, predefined);
            this.map[usersId] = conv;
            this.collection.add(conv);
        }
        return conv;
    }
    
    addSection(section: SectionService): Conv2Section {
        if (!section.isUserGroup() || section.sectionData.group.type != "usernames" || section.sectionData.group.users.length == 0) {
            return null;
        }
        let users = section.sectionData.group.users;
        let usersId = Conv2Section.getUsersId(users);
        let conv = this.collection.find(x => x.usersId == usersId);
        if (conv == null) {
            conv = this.createConv2("c2:default:" + usersId, users, false);
            this.map[usersId] = conv;
            conv.setSection(section);
            this.collection.add(conv);
        }
        else {
            if (conv.hasSection()) {
                if (conv.section == section) {
                    //set section to load files/messages if they were requested but they are not loaded yet
                    conv.setSection(section);
                    this.collection.updateElement(conv);
                    return conv;
                }
                let newId = "c2:" + section.getId() + ":" + usersId;
                conv = this.collection.find(x => x.id == newId);
                if (conv == null) {
                    conv = this.createConv2(newId, users, false);
                    this.map[usersId] = conv;
                    conv.setSection(section);
                    this.collection.add(conv);
                }
                else {
                    //set section to load files/messages if they were requested but they are not loaded yet
                    conv.setSection(section);
                    this.collection.updateElement(conv);
                }
            }
            else {
                if (!Lang.startsWith(conv.id, "c2:default:")) {
                    throw new Error("Conv2 without section has invalid id '" + conv.id + "'");
                }
                conv.setSection(section);
                this.collection.updateElement(conv);
            }
        }
        return conv;
    }
    
    removeSection(section: SectionService) {
        let idx = this.collection.indexOfBy(x => x.section == section);
        if (idx >= 0) {
            Logger.debug("Removing section")
            this.collection.removeAt(idx);
        }
    }
    
    createUserGroup(usernames: string[]): Q.Promise<SectionService> {
        let usersId = Conv2Section.getUsersId(usernames);
        if (usersId in this.createUserGroupsMap) {
            return this.createUserGroupsMap[usersId];
        }
        let conv = this.collection.find(x => x.usersId == usersId);
        if (conv && conv.section) {
            return Q(conv.section);
        }
        return this.createUserGroupsMap[usersId] = this.sectionManager.createSectionWithModules({
            id: "usergroup:" + privfs.crypto.service.randomBytes(10).toString("hex"),
            parentId: null,
            acl: {
                createSubsections: {
                    admins: false,
                    all: false,
                    users: []
                },
                manage: {
                    admins: false,
                    all: false,
                    users: usernames
                }
            },
            group: {
                type: "usernames",
                users: usernames
            },
            data: {
                name: "<usergroup:" + usernames.join(",") + ">",
                modules: {},
                description: null,
                extraOptions: null
            },
            state: "enabled",
            primary: false
        }, [
            {
                name: "chat",
                enabled: true
            },
            {
                name: "file",
                enabled: true
            },
            {
                name: "kvdb",
                enabled: false
            },
            {
                name: "calendar",
                enabled: false
            }
        ], false).fin(() => {
            delete this.createUserGroupsMap[usersId];
        });
    }
}