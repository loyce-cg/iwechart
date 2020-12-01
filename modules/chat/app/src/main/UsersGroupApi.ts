import {privfs} from "pmc-mail";

export interface UsersGroup {
    id: string;
    type: string;
    users: string[];
}

export class UsersGroupApi {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure
    ) {
    }
    
    getUsersGroup(id: string): Q.Promise<UsersGroup> {
        return this.srpSecure.request("getUsersGroup", {id: id});
    }
    
    getUsersGroups(): Q.Promise<UsersGroup[]> {
        return this.srpSecure.request("getUsersGroups", {});
    }
    
    createUsersGroup(id: string, type: string, users: string[]): Q.Promise<void> {
        return this.srpSecure.request("createUsersGroup", {id: id, type: type, users: users});
    }
    
    updateUsersGroup(id: string, type: string, users: string[]): Q.Promise<void> {
        return this.srpSecure.request("updateUsersGroup", {id: id, type: type, users: users});
    }
    
    addToUsersGroup(id: string, username: string): Q.Promise<void> {
        return this.srpSecure.request("addToUsersGroup", {id: id, username: username});
    }
    
    deleteUsersGroup(id: string): Q.Promise<void> {
        return this.srpSecure.request("deleteUsersGroup", {id: id});
    }
}