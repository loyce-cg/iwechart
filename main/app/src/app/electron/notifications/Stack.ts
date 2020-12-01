import { SinkIndexEntry } from "../../../mail/SinkIndexEntry";
import { RecvNotification, NotificationGroup } from "./Types";

/**
Klasa pomocnicza dla NotificationService - zarządzająca grupowaniem notyfikacji
*/
export class RecvNotificationsStack {
    items: RecvNotification[] = [];
    groups: NotificationGroup[] = [];
    
    add(notifications: SinkIndexEntry[]) {
        const timeNow:number = (new Date()).getTime();
        notifications.forEach(item => this.items.push({notif: item, displayed: false, receiveTime: timeNow}));
    }
    
    getNewest(fromTime?: number) {
        let toRet: SinkIndexEntry[] = [];
        
        this.items.forEach( item => {
            if (!item.displayed) {
                if (fromTime !== undefined) {
                    if (item.receiveTime > fromTime) {
                        toRet.push(item.notif);
                        item.displayed = true;
                    }
                } else {
                    toRet.push(item.notif);
                    item.displayed = true;
                }
            }
        });
        return toRet;
    }
    
    getNewestGrouped(fromTime?: number) {
        let newest = this.getNewest(fromTime);
        this.groups = [];
        
        newest.forEach( item => {
            const message = item.getMessage();
            if (message && message.sender) {
                const groupId = this.getUserGroupId(message.sender.pub58);
                this.groups[groupId].notifs.push(item);
            }
        });
        
        let toRet:SinkIndexEntry[][] = [];
        this.groups.forEach( group => toRet.push( group.notifs ));
        return toRet;
    }
    
    getUserGroupId(user: string) {
        let toRet: number = null;
        for(let i=0;i<this.groups.length;i++) {
            if (this.groups[i].user === user) {
                toRet = i;
                break;
            }
        }
        if (toRet === null) {
            this.groups.push({user: user, notifs: []});
            return this.groups.length - 1;
        } else {
            return toRet;
        }
    }
    
    clearDisplayed() {
        let i=0;
        while ( i < this.items.length ) {
            if ( this.items[i].displayed ) {
                this.items.splice(i,1);
            } else {
                i++;
            }
        }
    }
}
