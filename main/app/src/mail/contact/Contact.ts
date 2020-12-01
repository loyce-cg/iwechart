import * as privfs from "privfs-client";
import {Bracket} from "../../utils/Bracket";
import {MutableCollection} from "../../utils/collection/MutableCollection";
import {FileDb} from "../FileDb";
import {Lang} from "../../utils/Lang";

export interface ContactProfile {
    name?: string;
    description?: string;
    image?: string;
}

export interface SerializedContact {
    dataVersion?: number;
    user: privfs.types.identity.SerializedUser;
    sinks: privfs.types.message.SerializedMessageSink[];
    starred: boolean;
    profile: ContactProfile;
    type: ContactType;
    email: string;
    revision: string;
    basicUser: boolean;
    basicName: string;
    isAdmin: boolean;
}

export enum ContactType {
    PRIVMX,
    EMAIL
}

export class Contact {
    
    dataVersion?: number;
    toRemove?: boolean;
    user: privfs.identity.User;
    starred: boolean;
    profile: ContactProfile;
    sinks: privfs.message.MessageSink[];
    presence: privfs.types.core.PresenceEntry;
    type: ContactType;
    email: string;
    revision: string;
    basicUser: boolean;
    basicName: string;
    isAdmin: boolean;
    
    constructor() {
    }
    
    isStarred(): boolean {
        return this.starred;
    }
    
    setStarred(starred: boolean): void {
        this.starred = starred;
    }
    
    setDisplayName(name: string): void {
        if (this.user) {
            this.user.name = name;
        }
        else {
            if (this.profile == null) {
                this.profile = {};
            }
            this.profile.name = name;
        }
    }
    
    isPrivmx(): boolean {
        return this.type === null || this.type == ContactType.PRIVMX;
    }
    
    isEmail(): boolean {
        return this.type == ContactType.EMAIL;
    }
    
    hasName(): boolean {
        return !!((this.isPrivmx() && this.user && this.user.name) || (this.profile && this.profile.name));
    }
    
    getDisplayName(): string {
        if (this.isPrivmx() && this.user && this.user.name) {
            return this.user.name;
        }
        if (this.profile && this.profile.name) {
            return this.profile.name;
        }
        if (this.basicUser && this.basicName) {
            return this.basicName;
        }
        return this.getHashmail();
    }
    
    getDisplayNameWithHashmail(bracketType?: number): string {
        let bracket = Bracket.getChars(bracketType);
        if (this.basicUser && this.basicName) {
            if (this.user && this.user.name && this.user.name != this.basicName) {
                return this.user.name + " " + bracket.open + this.basicName + bracket.close;
            }
            if (this.profile && this.profile.name && this.profile.name != this.basicName) {
                return this.profile.name + " " + bracket.open + this.basicName + bracket.close;
            }
            return this.basicName;
        }
        if (this.isPrivmx() && this.user && this.user.name) {
            return this.user.name + " " + bracket.open + this.user.hashmail + bracket.close;
        }
        if (this.profile && this.profile.name) {
            return this.profile.name + " " + bracket.open + this.getHashmail() + bracket.close;
        }
        return this.getHashmail()
    }
    
    getHashmail(): string {
        return this.isEmail() ? this.email : this.user.hashmail;
    }
    
    getUsername(): string {
        return this.isEmail() ? null : this.user.user;
    }
    
    getHost(): string {
        return this.isEmail() ? null : this.user.host;
    }
    
    serialize(): SerializedContact {
        let raw: SerializedContact = {
            user: this.user ? this.user.serialize() : null,
            sinks: [],
            starred: this.starred,
            profile: this.profile || {},
            type: this.type == null ? ContactType.PRIVMX : this.type,
            email: this.email,
            dataVersion: this.dataVersion,
            revision: this.revision,
            basicUser: this.basicUser,
            basicName: this.basicName,
            isAdmin: this.isAdmin
        };
        (this.sinks || []).forEach(sink => {
            raw.sinks.push(sink.serialize());
        });
        return raw;
    }
    
    validateNames(): void {
        if (this.user) {
            this.user.name = Lang.getTrimmedString(this.user.name);
        }
        if (this.profile) {
            if (this.profile.name) {
                this.profile.name = Lang.getTrimmedString(this.profile.name);
            }
            if (this.profile.description) {
                this.profile.description = Lang.getTrimmedString(this.profile.description);
            }
        }
        (this.sinks || []).forEach(sink => {
            if (sink.name) {
                sink.name = Lang.getTrimmedString(sink.name);
            }
            if (sink.description) {
                sink.description = Lang.getTrimmedString(sink.description);
            }
        });
    }
    
    static deserialize(raw: SerializedContact): Contact {
        let contact = new Contact();
        contact.toRemove = false;
        contact.dataVersion = raw.dataVersion || 0;
        contact.user = raw.user ? privfs.identity.User.fromSerialized(raw.user.hashmail, raw.user.pub58, raw.user.name) : null;
        contact.starred = !!raw.starred;
        contact.sinks = [];
        contact.profile = raw.profile || {};
        contact.type = "type" in raw ? raw.type : ContactType.PRIVMX;
        contact.email = raw.email;
        contact.revision = raw.revision;
        contact.basicUser = raw.basicUser;
        contact.basicName = raw.basicName;
        contact.isAdmin = raw.isAdmin;
        (raw.sinks || []).forEach(sink => {
            contact.sinks.push(privfs.message.MessageSink.fromSerialized(sink.id, sink.name, sink.description));
        });
        contact.validateNames();
        return contact;
    }
    
    static serializeMany(contacts: Contact[]): SerializedContact[] {
        let list: SerializedContact[] = [];
        contacts.forEach(contact => {
            list.push(contact.serialize());
        });
        return list;
    }
    
    static deserializeMany(contacts: SerializedContact[]): Contact[] {
        let list: Contact[] = [];
        contacts.forEach(contact => {
            list.push(Contact.deserialize(contact));
        });
        return list;
    }
}

export interface SerializedContactsFile {
    version: number;
    dataVersion?: number;
    items: SerializedContact[];
}

export class ContactsFileDb extends FileDb<SerializedContactsFile> {
    
    constructor(
        fileSystem: privfs.fs.file.FileSystem,
        filePath: string,
        public contactCollection: MutableCollection<Contact>&{version?: number}
    ) {
        super(fileSystem, filePath);
    }
    
    getDefaultData(): SerializedContactsFile {
        return {
            version: 1,
            dataVersion: -1,
            items: []
        };
    }
    
    onDataLoad(data: SerializedContactsFile): Q.IWhenable<void> {
        this.contactCollection.rebuild(Contact.deserializeMany(data.items));
        this.contactCollection.version = data.version;
    }
    
    getDataToSave(): Q.IWhenable<SerializedContactsFile> {
        return {
            version: this.contactCollection.version,
            items: Contact.serializeMany(this.contactCollection.list)
        };
    }
    
    add(contact: Contact): Q.Promise<void> {
        this.contactCollection.add(contact);
        return this.save();
    }
    
    update(contact: Contact): Q.Promise<void> {
        this.contactCollection.updateElement(contact);
        return this.save();
    }
    
    remove(contact: Contact): Q.Promise<void> {
        this.contactCollection.remove(contact);
        return this.save();
    }
}
