import * as privfs from "privfs-client";
import { event } from "../../../Types";

export interface NotificationReference {
    notification: Electron.Notification;
    time: number;
    context: event.NotificationContext;
    id: string;
}

export class NotificationsReferencesQueue {
    static readonly maxRefs: number = 1000;
    static readonly cleanupDelayTime: number = 60 * 1000;
    private lastCleanupAttemptTime: number = 0;
    private refs: {[id: string]: NotificationReference} = {};
    private refsCount: number = 0;
    
    public getNewRef(): string {
        const timeNow = Date.now();
        return privfs.crypto.service.randomBytes(16).toString("hex") + "." + timeNow.toString();;
    }

    public getNotification(ref: string): NotificationReference {
        return this.refs[ref];
    }

    public addNotification(withRef: string, notificationReference: NotificationReference): void {
        this.refs[withRef] = notificationReference;
        this.refsCount++;
        this.cleanupOldRefs();
    }

    public removeNotification(ref: string): void {
        if (ref in this.refs) {
            delete this.refs[ref];
            this.refsCount--;
        }
    }

    private cleanupOldRefs(): void {
        const timeNow = Date.now();
        if (timeNow < this.lastCleanupAttemptTime + NotificationsReferencesQueue.cleanupDelayTime || this.refsCount < NotificationsReferencesQueue.maxRefs) {
            return;
        }

        this.lastCleanupAttemptTime = timeNow;
        let refsList = [];
        for (let refId in this.refs) {
            refsList.push(this.refs[refId]);
        }
        const toRemove = refsList.sort((a, b) => b.time - a.time).splice(NotificationsReferencesQueue.maxRefs)
        for (let ref of toRemove) {
            if (ref.id in this.refs) {
                delete this.refs[ref.id];
                this.refsCount--;
            }
        }
    }
}