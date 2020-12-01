import {Bracket} from "../../utils/Bracket";
import {Contact} from "../contact/Contact";
import {Lang} from "../../utils/Lang";
import * as PmxApi from "privmx-server-api";

export class Person {
    
    usernameCore: string;
    username: string;
    hashmail: string;
    hashmailIsEmail: boolean;
    contact: Contact;
    lastUpdate: Date;
    extraInfo?: PmxApi.api.user.UsernameEx;
    isMe?: boolean;

    constructor(hashmail: string, extraInfo: PmxApi.api.user.UsernameEx, contact?: Contact) {
        this.hashmail = hashmail;
        this.hashmailIsEmail = this.hashmail.indexOf("@") != -1;
        this.usernameCore = this.hashmailIsEmail ? this.hashmail : this.hashmail.split("#")[0];
        this.setContact(contact);
        this.lastUpdate = new Date(0);
    }
    
    static fromContact(extraInfo: PmxApi.api.user.UsernameEx, contact: Contact): Person {
        return new Person(contact.getHashmail(), extraInfo, contact);
    }
    
    hasContact(): boolean {
        return this.contact != null;
    }
    
    getContact(): Contact {
        return this.contact;
    }
    
    updateContact(contact: Contact): void {
        if (this.contact == null) {
            this.setContact(contact);
        }
        else {
            this.lastUpdate = new Date();
            this.username = this.contact && this.contact.basicUser && this.contact.basicName ? this.contact.basicName : this.usernameCore;
        }
    }
    
    setContact(contact: Contact): void {
        if (contact != null && contact.isEmail() != this.hashmailIsEmail) {
            throw new Error("Inconsistent contact type");
        }
        this.contact = contact;
        this.lastUpdate = new Date();
        this.username = this.contact && this.contact.basicUser && this.contact.basicName ? this.contact.basicName : this.usernameCore;
    }
    
    getHashmail(): string {
        return this.hashmail;
    }
    
    getName(defaultName?: string): string {
        if (this.contact && this.contact.hasName()) {
            return this.contact.getDisplayName();
        }
        let trimmed = Lang.getTrimmedString(defaultName);
        return trimmed || this.username;
    }
    
    getNameWithHashmail(bracketType?: number): string {
        return this.contact ? this.contact.getDisplayNameWithHashmail(bracketType) : this.hashmail;
    }
    
    getNameWithHashmailA(bracketType?: number): string {
        return this.getNameWithHashmail(bracketType == null ? Bracket.Angle: bracketType);
    }
    
    hasDescription(): boolean {
        return this.contact != null && this.contact.profile != null && !!this.contact.profile.description;
    }
    
    getDescription(): string {
        return this.hasDescription() ? this.contact.profile.description : "";
    }
    
    hasAvatar(): boolean {
        return this.contact != null && this.contact.profile != null && !!this.contact.profile.image;
    }
    
    getAvatar(): string {
        return this.hasAvatar() ? this.contact.profile.image : "";
    }
    
    isStarred(): boolean {
        return this.contact != null && this.contact.isStarred();
    }
    
    isPresent(): boolean {
        // return this.contact != null && this.contact.presence != null;
        return this.isMe == true || this.extraInfo && this.extraInfo.isOnline == true;
    }
    
    isEmail(): boolean {
        return this.hashmailIsEmail;
    }
    
    getLastUpdate(): Date {
        return this.lastUpdate;
    }
    
    isAnonymous(): boolean {
        return this.hashmail.indexOf("anonymous#") == 0;
    }
}
