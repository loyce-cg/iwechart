import {Person} from "./Person";
import {Persons} from "./Persons";
import * as privfs from "privfs-client";
import {app, mail} from "../../Types";
import * as PmxApi from "privmx-server-api";
import * as Lodash from "lodash";
import {Lang} from "../../utils/Lang";
import * as Q from "q";
import * as RootLogger from "simplito-logger";

let Logger = RootLogger.get("privfs-mail-client.mail.PersonService");

export class PersonService {
    
    static SYNCHRONIZATION_INTERVAL = 60 * 1000;
    
    personsGetter: (hashmail: string) => Person;
    synchronizationTimer: any = null;
    
    constructor(
        public identity: privfs.identity.Identity,
        public persons: Persons,
        public lowUserProvider: mail.LowUserProvider,
    ) {
        this.personsGetter = hashmail => this.getPerson(hashmail);
    }
    
    getMe(): Person {
        return this.getPerson(this.identity.hashmail);
    }
    
    getPerson(hashmail: string): Person {
        let lowUser = this.lowUserProvider.getLowUserByHashmail(hashmail);
        return this.persons.get(lowUser ? lowUser.email : hashmail);
    }
    
    getPersonProxy(user: privfs.identity.User): Person {
        let lowUser = this.lowUserProvider.getLowUserByHashmail(user.hashmail);
        return this.persons.getProxyEx(lowUser ? lowUser.email : user.hashmail, user);
    }
    
    getPersonALUR(hashmail: string): Person {
        let lowUser = this.lowUserProvider.getLowUserFromAlternativeRegistry(hashmail);
        return this.persons.get(lowUser ? lowUser.email : hashmail);
    }
    
    getPersonProxyALUR(user: privfs.identity.User): Person {
        let lowUser = this.lowUserProvider.getLowUserFromAlternativeRegistry(user.hashmail);
        return this.persons.getProxyEx(lowUser ? lowUser.email : user.hashmail, user);
    }
    
    getPersonAvatarByHashmail(hashmail: string): app.PersonAvatar {
        let person = this.getPerson(hashmail);
        if (person == null) {
            return {
                hashmail: hashmail,
                avatar: null,
                isEmail: false,
                lastUpdate: 0
            };
        }
        return {
            hashmail: hashmail,
            avatar: person.getAvatar(),
            isEmail: person.isEmail(),
            lastUpdate: person.getLastUpdate().getTime()
        };
    }
    
    updateExtraInfos(extraInfo: PmxApi.api.user.UsernameEx[]): void {
        extraInfo.forEach(extInfo => {
            let hashmail = new privfs.identity.Hashmail({user: extInfo.username, host: this.identity.host});
            this.updateExtraInfo(hashmail.hashmail, extInfo);
        });
    }
    
    updateExtraInfo(hashmail: string, extraInfo: PmxApi.api.user.UsernameEx): void {
        let oldExtraInfo = this.persons.contactService.getUserExtraInfo(hashmail);
        let hasMajorChange = oldExtraInfo == null || !PersonService.isExtraInfoEqualIgnoreLastSeen(oldExtraInfo, extraInfo);
        this.persons.contactService.updateExtraInfoForUser(hashmail, extraInfo, hasMajorChange);
        this.persons.updateExtraInfoForPerson(hashmail, extraInfo, hasMajorChange);
    }
    
    updatePkiRevision(hashmail: string, pkiRevision: PmxApi.api.pki.PkiRevision): void {
        this.persons.contactService.updatePkiRevisionForUser(hashmail, pkiRevision);
        this.persons.updatePkiRevisionForPerson(hashmail, pkiRevision);
    }
    
    static isExtraInfoEqualIgnoreLastSeen(extra1: PmxApi.api.user.UsernameEx, extra2: PmxApi.api.user.UsernameEx) {
        let a = Lang.shallowCopy(extra1);
        a.lastSeenDate = null;
        let b = Lang.shallowCopy(extra2);
        b.lastSeenDate = null;
        return Lodash.isEqual(a, b);
    }
    
    synchronizeWithUsernames(forceDelete?: boolean): Q.Promise<void> {
        Logger.debug("Synchronizing contacts");
        return this.persons.contactService.utilApi.getUsernamesEx(true).then(users => {
            this.updateExtraInfos(users);
            return this.persons.contactService.synchronizeContacts(users, forceDelete);
        });
    }
    
    startSynchronizationTimer(): Q.Promise<void> {
        if (this.synchronizationTimer !== null) {
            return;
        }
        this.synchronizationTimer = setInterval(this.synchronizeWithUsernames.bind(this), PersonService.SYNCHRONIZATION_INTERVAL);
        return this.synchronizeWithUsernames();
    }
    
    stopSynchronizationTimer(): void {
        if(this.synchronizationTimer) {
            clearInterval(this.synchronizationTimer);
        }
    }
}