import * as privfs from "privfs-client";
import * as Q from "q";
import {MutableCollection} from "../utils/collection/MutableCollection";

export class UserAdminService {
    
    usersCollection: MutableCollection<privfs.types.core.RawUserAdminData>; //zawsze pusta dopiero po refresh jest coś w niej
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure
    ) {
        this.usersCollection = new MutableCollection<privfs.types.core.RawUserAdminData>();
    }
    
    destroy() {
        this.usersCollection.destroy();
    }
    
    refreshUsersCollection(): Q.Promise<void> {
        return Q().then(() => {
            return this.srpSecure.getUsers();
        })
        .then(users => {
            this.usersCollection.clear();
            this.usersCollection.addAll(users);
        });
    }
    
    removeUser(username: string): Q.Promise<void> {
        return Q().then(() => {
            return this.srpSecure.removeUser(username);
        })
        .then(() => {
            this.usersCollection.removeBy("username", username);
        });
    }
    
    changeUserDescription(username: string, description: string): Q.Promise<void> {
        return this.changeUserProperty(username, "description", description, "changeDescription");
    }
    
    changeUserIsAdmin(username: string, isAdmin: boolean): Q.Promise<void> {
        return this.changeUserProperty(username, "isAdmin", isAdmin, "changeIsAdmin");
    }
    
    changeUserEmail(username: string, email: string): Q.Promise<void> {
        return this.changeUserProperty(username, "email", email, "changeEmail", user => {
            if (!user.activated && user.notificationsEntry) {
                user.notificationsEntry = {
                    enabled: !!email,
                    email: email,
                    tags: []
                };
            }
        });
    }
    
    changeUserPin(username: string, pin: string): Q.Promise<void> {
        return this.changeUserProperty(username, "pin", pin, "changePin", user => {
            user.pinAttemptsCount = 0;
        });
    }
    
    changeUserProperty(username: string, propertyName: string, propertyValue: any, apiMethodName: string, changeCallback?: (user: privfs.types.core.RawUserAdminData) => void): Q.Promise<void> {
        return Q().then(() => {
            return (<any>this.srpSecure)[apiMethodName](username, propertyValue);
        })
        .then(() => {
            let user = this.usersCollection.getBy("username", username);
            (<any>user)[propertyName] = propertyValue;
            if (typeof(changeCallback) == "function") {
                changeCallback(user);
            }
            this.usersCollection.updateElement(user);
        });
    }
}