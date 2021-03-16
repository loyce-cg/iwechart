import * as Types from "../Types";
import * as WebUtils from "./WebUtils";

export class PersonProvider {
    
    private persons: {[hashmail: string]: Types.webUtils.PersonModelFull};
    
    constructor() {
        this.persons = {};
    }
    
    setPerson(modelPerson: Types.webUtils.PersonModelFullOptymized): void {
        const oldPerson = this.persons[modelPerson.hashmail];
        
        let avatarNeedRefresh: boolean = false;
        if (oldPerson && oldPerson.avatar.revision != modelPerson.avatar.revision) {
            if (oldPerson.avatar.avatar) {
                const objectUrlId = "avatar:" + modelPerson.hashmail + ":" + oldPerson.avatar.revision;
                WebUtils.WebUtils.revokeNamedObjectURL(objectUrlId);
            }
            avatarNeedRefresh = true;
        }
        
        let avatar: Types.webUtils.AvatarWithVersion;
        if (avatarNeedRefresh || oldPerson == null) {
            const objectUrlId = "avatar:" + modelPerson.hashmail + ":" + modelPerson.avatar.revision;
            avatar = {
                avatar: modelPerson.avatar.avatar ? WebUtils.WebUtils.createNamedObjectURL(objectUrlId, modelPerson.avatar.avatar) : "",
                revision: modelPerson.avatar.revision
            };
        }
        else {
            avatar = oldPerson.avatar;
        }
        
        let person: Types.webUtils.PersonModelFull = {
            hashmail: modelPerson.hashmail,
            username: modelPerson.username,
            name: modelPerson.name,
            present: modelPerson.present,
            description: modelPerson.description,
            avatar: avatar,
            lastUpdate: modelPerson.lastUpdate,
            isEmail: modelPerson.isEmail,
            isStarred: modelPerson.isStarred,
            isExternal: modelPerson.isExternal,
            deviceName: modelPerson.deviceName,
            client: modelPerson.client,
            isAdmin: modelPerson.isAdmin,
            lastSeen: modelPerson.lastSeen,
            loggedInSince: modelPerson.loggedInSince,
            ipAddress: modelPerson.ipAddress
        }
        this.persons[person.hashmail] = person;
    }
    
    getPersonName(hashmail: string, defaultName?: string): string {
        let person = this.persons[hashmail];
        return (person ? person.name : "") || defaultName || hashmail;
    }
    
    getPersonAvatarByHashmail(hashmail: string): Types.app.PersonAvatar {
        let person = this.persons[hashmail];
        if (person == null) {
            return {
                hashmail: hashmail,
                avatar: {avatar: "", revision: ""},
                isEmail: false
            };
        }
        return person;
    }
    
    getPerson(hashmail: string): Types.webUtils.PersonModelFull {
        let person = this.persons[hashmail];
        if (person == null) {
            return  {
                hashmail: hashmail,
                username: hashmail,
                name: hashmail,
                present: false,
                description: "",
                avatar: null,
                lastUpdate: 0,
                isEmail: false,
                isStarred: false,
                isExternal: false,
                deviceName: "",
                client: "",
                isAdmin: false,
                lastSeen: 0,
                loggedInSince: 0,
                ipAddress: ""
            };
        }
        return person;
    }
}