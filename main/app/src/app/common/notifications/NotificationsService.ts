import * as RootLogger from "simplito-logger";
import {CommonApplication} from "../CommonApplication";
import {EventDispatcher} from "../../../utils/EventDispatcher";
import {event} from "../../../Types";
let Logger = RootLogger.get("privfs-mail-client.app.common.NotificationService");


export interface PendingNotification {
    time: number,
    options: event.NotificationOptions
}

export class NotificationsService {
    pendingNotifications: PendingNotification[];
    lastNotificationTime: number;
    notificationTimer: NodeJS.Timer;
    
    constructor (
        public app: CommonApplication,
        public eventDispatcher: EventDispatcher
    ) {
        this.pendingNotifications = [];
        this.lastNotificationTime = 0;
        eventDispatcher.addEventListener<event.NotificationServiceEvent>("notifyUser", this.onHandleNotification.bind(this));
    }
    
    onHandleNotification(event: event.NotificationServiceEvent) {
        let options: event.NotificationOptions = {
            sound: (event.options ? event.options.sound : true),
            tooltip: (event.options ? event.options.tooltip : true),
            tray: (event.options ? event.options.tray : true),
            tooltipOptions: event.options.tooltipOptions,
            sender: event.options.sender,
            context: event.options.context
        }

        this.pendingNotifications.push(<PendingNotification>{time: new Date().getTime(), options: options});
        this.processNotifications();
    }
    
    processNotifications() {
        if (this.notificationTimer) {
            clearTimeout(this.notificationTimer);
        }
        this.notificationTimer = setTimeout(() => {
            if (this.pendingNotifications) {
                let notificationToRun: event.NotificationOptions = {};
                this.pendingNotifications.forEach( x => {
                    if (x.time < this.lastNotificationTime) {
                        return;
                    }
                    notificationToRun.sound = x.options.sound;
                    notificationToRun.tooltip = x.options.tooltip;
                    notificationToRun.tooltipOptions = x.options.tooltipOptions;
                    notificationToRun.tray = x.options.tray;
                    notificationToRun.context = x.options.context;
                });
                this.lastNotificationTime = new Date().getTime();
                this.notifyUser(notificationToRun);
                this.pendingNotifications = [];
            }
        }, 500);
    }
    
    notifyUser(options: event.NotificationOptions) {
        if (options.sound) {
            this.app.playAudio("notification");
        }
        if (options.tray) {
            this.eventDispatcher.dispatchEvent<event.ElectronNotificationServiceEvent>({type: "notifyInTray"});
        }
        if (options.tooltip && !this.app.userPreferences.isGloballyMuted()) {
            this.eventDispatcher.dispatchEvent<event.ElectronNotificationServiceEvent>({type: "notifyInTooltip", options: options.tooltipOptions, context: options.context});
        }
    }
}
