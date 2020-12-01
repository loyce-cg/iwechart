import {Person} from "./Person";
import * as privfs from "privfs-client";

export class PersonProxy extends Person {
    
    user: privfs.identity.User;
    
    constructor(person: Person, user: privfs.identity.User) {
        super(person.hashmail, person.extraInfo, person.contact);
        this.user = user;
    }
    
    getName(): string {
        return super.getName(this.user == null ? null : this.user.name);
    }
}

