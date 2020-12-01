import electron = require("electron");
import Q = require("q");
import {Persons} from "../../../mail/person/Persons";
import { ElectronApplication } from "../ElectronApplication";
import { event } from "../../../Types";
import path = require("path");
import { EventDispatcher } from "../../../utils/EventDispatcher";
import { Contact } from "../../../mail/contact/Contact";
import { Person } from "../../../mail/person/Person";
import { EmojiViewBarController } from "../../../component/emojiviewbar/EmojiViewBarController";
import { Session } from "../../../mail/session/SessionManager";


export class NotificationsService {
    
    static readonly BASE_NOTIF_ICON: string = "app-tray-icon.png";
    static readonly APP_MAX_NOTIFICATION_MESSAGE_LEN: number = 50;
    static readonly APP_NOTIFICATION_ELIPSIS: string = " ...";
    
    constructor(
        public app: ElectronApplication, public eventDispatcher: EventDispatcher
    ) {
        eventDispatcher.addEventListener<event.ElectronNotificationServiceEvent>("notifyInTooltip", this.onHandleTooltipNotification.bind(this), "main", "ethernal");
        eventDispatcher.addEventListener<event.ElectronNotificationServiceEvent>("notifyInTray", this.onHandleTrayNotification.bind(this), "main", "ethernal");
    }
    
    getPersonFromSender(session: Session, sender: string): Contact {
        let matchingContact: Contact;
        session.conv2Service.contactService.contactCollection.forEach(contact => {
            if (contact.getHashmail() == sender || contact.getUsername() == sender || contact.email == sender) {
                matchingContact = contact;
                return;
            }
        });
        return matchingContact;
    }
    
    onHandleTooltipNotification(event: event.ElectronNotificationServiceEvent) {
        const unescape = require("he");
        const striptags = require("striptags");
        const maxMsgLength = NotificationsService.APP_MAX_NOTIFICATION_MESSAGE_LEN;
        const elipsis = NotificationsService.APP_NOTIFICATION_ELIPSIS;
        
        let avatar: Electron.NativeImage;
        let title: string = "";
        
        Q().then(() => {
            if (event.options.withSticker) {
                let stickersPath = path.join(EmojiViewBarController.getAssetsPath(this.app.assetsManager), event.options.withSticker) + ".png";
                avatar = this.app.getAvatarFromPath(stickersPath, 72);
            }
            
            let session = this.app.sessionManager.getSessionByHostHash(event.context.hostHash);
            
            if (event.options.sender && event.options.withUserName && session && session.conv2Service && session.conv2Service.contactService) {
                let contact = this.getPersonFromSender(session, event.options.sender);
                
                title = contact ? Person.fromContact(null, contact).getName() : event.options.sender;
            }
            
            if (event.options.sender && event.options.withAvatar && session && session.conv2Service && session.conv2Service.contactService) {
                let person = this.getPersonFromSender(session, event.options.sender);
                avatar = this.app.getAvatarFromDataUrl(Person.fromContact(null, person).getAvatar());
            }
            
            if (event.options.withAvatar && !event.options.sender) {
                
                avatar = this.app.getAvatarFromDataUrl(this.getNotificationIcon());
            }
            
            let maxLength = event.options.customMessageLength || maxMsgLength;
            let currEllipsis = event.options.customEllipsis || elipsis;
            let localTitle: string = striptags(unescape.decode(event.options.title));
            title = localTitle.length > 0 ? title + " " + localTitle : title;
            let text: string = striptags(unescape.decode(event.options.text));
            
            // check for links
            let textFiltered = this.cutUrls(text);
            if (textFiltered !== text) {
                text = textFiltered;
            }
            
            this.app.showBaloonNotification(title, [text.length < maxLength ? text : text.substr(0, maxLength - currEllipsis.length) + currEllipsis], avatar ? avatar : undefined, event.context);

            
        })
        
    }
    
    onHandleTrayNotification(event: event.ElectronNotificationServiceEvent) {
        this.app.trayMenu.setNotificationVisible(true);
    }
    
    linkify(text: string) {
        let urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(urlRegex, (url) => {
            return '<a href="' + url + '">[link]</a>';
        });
    }
    
    cutUrls(text: string) {
        let urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(urlRegex, _url => {
            return '[link]';
        });
    }
    
    getPosOfChange(text1: string, text2: string) {
        let pos = -1;
        let minLength = text1.length < text2.length ? text1.length : text2.length;
        for (let i = 0; i < minLength; i++) {
            if (text1[i] != text2[i]) {
                pos = i;
                break;
            }
        }
        return pos;
    }
    
    getNotificationIcon(): string {
        return path.resolve(this.app.getResourcesPath(), "dist/icons", NotificationsService.BASE_NOTIF_ICON);
    }
    
}