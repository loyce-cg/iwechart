import {Person} from "./Person";
import {PersonProxy} from "./PersonProxy";
import {Contact, ContactProfile} from "../contact/Contact";
import {Event} from "../../utils/Event";
import {BaseCollection} from "../../utils/collection/BaseCollection";
import {utils} from "../../Types";
import * as privfs from "privfs-client";
import {ContactService} from "../contact/ContactService";
import {IdentityProfile} from "./IdentityProfile";
import * as PmxApi from "privmx-server-api";

export class Persons {
    
    contactCollection: BaseCollection<Contact>;
    changeEvent: Event<any, any, any>;
    map: {[hashmail: string]: Person};
    myHashmail: privfs.identity.Hashmail;

    constructor(
        public identity: privfs.identity.Identity,
        public contactService: ContactService,
        public identityProfile: IdentityProfile
    ) {
        this.contactCollection = this.contactService.contactCollection;
        this.changeEvent = new Event();
        this.map = {};
        this.myHashmail = new privfs.identity.Hashmail({user: this.identity.user, host: this.identity.host});

        this.contactCollection.forEach(contact => {
            let extraInfo = this.contactService.getUserExtraInfo(contact.getHashmail());
            this.map[contact.getHashmail()] = Person.fromContact(extraInfo, contact);
        });
        this.contactCollection.changeEvent.add(this.onContactCollectionChange.bind(this));
    }
    
    onContactCollectionChange(event: utils.collection.CollectionEvent<Contact>): void {
        if (event.type == "add") {
            let person = this.get(event.element.getHashmail());
            person.setContact(event.element);
            this.changeEvent.trigger(person);
        }
        else if (event.type == "remove") {
            if (event.element.user == null) {
                return;
            }
            let person = this.get(event.element.getHashmail());
            person.setContact(null);
            if (event.element.getHashmail() == this.identity.hashmail) {
                let userInfoProfile = this.identityProfile.buildUserInfoProfile();
                this.updateIdentity(this.identity, userInfoProfile, () => {
                    return true;
                });
            }
            this.changeEvent.trigger(person);
        }
        else if (event.type == "update") {
            let person = this.get(event.element.getHashmail());
            person.updateContact(event.element);
            this.changeEvent.trigger(person);
        }
        else if (event.type == "rebuild") {
            this.contactCollection.forEach(x => {
                if (x.user == null) {
                    this.contactService.deleteContact(x);
                    return;
                }
                let person = this.get(x.getHashmail());
                person.setContact(x);
                this.changeEvent.trigger(person);
            });
        }
    }
    
    updateIdentity(identity: privfs.identity.Identity, identityUserInfoProfile: privfs.types.core.UserInfoProfile, profilesComparer: (a: ContactProfile, b: ContactProfile) => boolean): void {
        let person = this.get(identity.hashmail);
        let identityContactProfile = this.contactService.convertProfile(identityUserInfoProfile);
        if (person.hasContact()) {
            let contact = person.getContact();
            if (!profilesComparer(contact.profile, identityContactProfile)) {
                contact.dataVersion = new Date().getTime();
                contact.profile = identityContactProfile;
                person.updateContact(contact);
                this.changeEvent.trigger(person);
            }
        }
        else {
            let identityContact = new Contact();
            identityContact.dataVersion = new Date().getTime();
            identityContact.user = identity;
            identityContact.sinks = identityUserInfoProfile.sinks;
            identityContact.profile = identityContactProfile;
            identityContact.starred = false;
            person.setContact(identityContact);
            this.changeEvent.trigger(person);
        }
    }
    
    refreshIdentityContactCore(): void {
        let userInfoProfile = this.identityProfile.buildUserInfoProfile();
        this.updateIdentity(this.identity, userInfoProfile, this.contactService.compareProfiles.bind(this));
    }
    
    refreshIdentityContact(): void {
        this.refreshIdentityContactCore();
        let person = this.get(this.identity.hashmail);
        if (person && person.hasContact()) {
            let contact = person.getContact();
            if (contact.user && contact.user.name && (contact.user.name != contact.profile.name)) {
                contact.dataVersion = new Date().getTime();
                contact.user.name = contact.profile.name;
                this.contactService.contactCollection.updateElement(contact);
            }
        }
    }
    
    get(hashmail: string): Person {
        if (!(hashmail in this.map)) {
            this.map[hashmail] = new Person(hashmail, this.contactService.getUserExtraInfo(hashmail));
        }
        if (hashmail == this.myHashmail.hashmail) {
            this.map[hashmail].isMe = true;
        }
        // update presence info
        return this.map[hashmail];
    }
    
    getProxy(user: privfs.identity.User): PersonProxy {
        return this.getProxyEx(user.hashmail, user);
    }
    
    getProxyEx(hashmail: string, user: privfs.identity.User): PersonProxy {
        return new PersonProxy(this.get(hashmail), user);
    }
    
    destroy() {
        this.changeEvent.clear();
    }
    
    updateExtraInfoForPerson(hashmail: string, extraInfo: PmxApi.api.user.UsernameEx, triggerChangeEvent: boolean): void {
        let person = this.map[hashmail];
        if (person) {
            person.extraInfo = extraInfo;
            if (triggerChangeEvent) {
                this.changeEvent.trigger(person);
            }
        }
    }
    
    updatePkiRevisionForPerson(hashmail: string, pkiRevision: PmxApi.api.pki.PkiRevision): void {
        let person = this.map[hashmail];
        if (person && person.extraInfo) {
            person.extraInfo.pkiRevision = pkiRevision;
        }
    }
}
