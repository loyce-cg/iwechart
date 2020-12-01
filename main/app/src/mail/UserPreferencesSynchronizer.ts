import {event} from "../Types";
import {UserPreferences} from "./UserPreferences";
import * as privfs from "privfs-client";
import {UserEntryService} from "./person/UserEntryService";
import {Persons} from "./person/Persons";

export class UserPreferencesSynchronizer {
    
    constructor(
        public userPreferences: UserPreferences,
        public identity: privfs.identity.Identity,
        public userEntryService: UserEntryService,
        public persons: Persons
    ) {
    }
    
    onUserPreferencesChange(event: event.UserPreferencesChangeEvent): void {
        this.identity.name = this.userPreferences.getValue("profile.name", "");
        if (event.operation == "load") {
            if (this.userPreferences.getValue("presence.autoPresenceAfterLogin", false)) {
            }
            else {
            }
        }
        else if (event.operation == "save") {
        }
        this.userEntryService.publishUserEntry();
        this.persons.refreshIdentityContact();
    }
}