import {ComponentController} from "../base/ComponentController";
import {Persons} from "../../mail/person/Persons";
import {Person} from "../../mail/person/Person";
import * as Types from "../../Types";
import * as Q from "q";
import {Inject} from "../../utils/Decorators";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import * as PmxApi from "privmx-server-api";
import { EventDispatcher } from "../../utils";
import * as privfs from "privfs-client";

export interface Model {
    persons: {[hashmail: string]: Types.webUtils.PersonModelFullOptymized};
}

export class PersonsController extends ComponentController {
    static textsPrefix: string = "component.persons.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject persons: Persons;
    @Inject eventDispatcher: EventDispatcher;

    lastSeqOnUpdate: {[hashmail: string]: number} = {};

    constructor(parent: Types.app.IpcContainer) {
        super(parent);
        this.ipcMode = true;


        this.registerChangeEvent<Person>(this.persons.changeEvent, (person) => {
            this.onPersonChange(person);
        });
    
        this.eventDispatcher.addEventListener<Types.event.UserPresenceChangeEvent>("user-presence-change", e => {
            if (e.role == "onlineState" && e.host == this.persons.identity.host) {
                let userHashmail = new privfs.identity.Hashmail({user: e.data.username, host: this.persons.identity.host});
                let person = this.persons.get(userHashmail.hashmail);
                this.onPersonChange(person);
            }
        }, "main");

    }
    
    getModel(): Model {   
        let persons: {[hashmail: string]: Types.webUtils.PersonModelFullOptymized} = {};
        let map = this.persons.map;
        for (let hashmail in map) {
            persons[hashmail] = PersonsController.getPersonModelFull(map[hashmail], this.persons.contactService.getUserExtraInfo(map[hashmail].hashmail));
        }
        return {
            persons: persons
        };
    }
    
    onPersonChange(person: Person): void {
        if (person.hashmail in this.lastSeqOnUpdate && person.changeSeq <= this.lastSeqOnUpdate[person.hashmail]) {
            return;
        }
        this.lastSeqOnUpdate[person.hashmail] = person.changeSeq;
        this.callViewMethod("refreshPerson", PersonsController.getPersonModelFull(person, this.persons.contactService.getUserExtraInfo(person.hashmail)));                    
    }
    
    static getPersonModelFull(person: Person, userExtraInfo: PmxApi.api.user.UsernameEx): Types.webUtils.PersonModelFullOptymized {
        let avatar = person.getAvatarWithVersion();
        let contact = person.getContact();
        let client: string = "";
        if (userExtraInfo) {
            let data = <any>userExtraInfo;
            if (data.client) {
                client = data.client.platform ? "Desktop " + data.client.version + " (" + data.client.platform + ")" : "Web" + data.client.version;  
            }
        }
        return {
            hashmail: person.getHashmail(),
            username: person.username,
            name: person.hasContact() && person.contact.hasName() ? person.contact.getDisplayName() : "",
            description: person.getDescription(),
            present: userExtraInfo && (<any>userExtraInfo).isOnline ? (<any>userExtraInfo).isOnline : false,
            avatar: {avatar: avatar.avatar ? PersonsController.getBlobDataFromDataURL(avatar.avatar): null, revision: avatar.revision},
            lastUpdate: person.getLastUpdate().getTime(),
            isEmail: person.isEmail(),
            isStarred: person.isStarred(),
            isExternal: person.username.indexOf("@") >= 0,
            client: client,
            deviceName: userExtraInfo && userExtraInfo.osName ? userExtraInfo.osName : "",
            isAdmin: userExtraInfo ? userExtraInfo.isAdmin : false,
            lastSeen: userExtraInfo && (<any>userExtraInfo).lastSeenDate ? Number((<any>userExtraInfo).lastSeenDate): null,
            loggedInSince: userExtraInfo ? Number(userExtraInfo.lastLoginDate) : null,
            ipAddress: userExtraInfo && (<any>userExtraInfo).lastIp ? (<any>userExtraInfo).lastIp : null,
        };
    }
    
    static getBlobDataFromDataURL(dataURI: string): Types.app.BlobData {
        return {
            mimetype: dataURI.split(',')[0].split(':')[1].split(';')[0],
            buffer: Buffer.from(dataURI.split(',')[1], 'base64')
        }
    }
    
}