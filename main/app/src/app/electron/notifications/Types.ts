import { SinkIndexEntry } from "../../../mail/SinkIndexEntry";

export interface RecvNotification {
    notif: SinkIndexEntry;
    displayed: boolean;
    receiveTime: number;
}
export interface NotificationGroup {
    user: string;
    notifs: SinkIndexEntry[];
}

export interface NotificationData {
    entry: SinkIndexEntry
}

export interface RenderedNotificationData extends NotificationData {
    renderedTitle: string;
    renderedMessage: string;
    filtered: boolean;
    customTitleLength?: number;
    customMessageLength?: number;
    customEllipsis?: string;
}

export interface NotificationInterface {
    sinkType: string;
    notificationType: string;
    render: (data: NotificationData) => RenderedNotificationData;
}
