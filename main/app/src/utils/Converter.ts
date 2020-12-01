import {Conversation} from "../mail/conversation/Conversation";
import * as Types from "../Types";
import { Conv2Section } from "../mail/section/Conv2Service";

export class Converter {
    
    static convertConversation(model: Conversation, statsType: string): Types.webUtils.ConversationModel {
        let unread = model.stats.byType[statsType] ? model.stats.byType[statsType].unread: 0;
        let elementsCount = 0;
        let searchCount = 0;
        let allSearched = true;
        if (model.isSingleContact()) {
            let person = model.getFirstPerson();
            return {
                id: model.id,
                unread: unread,
                unmutedUnread: unread,
                elementsCount: elementsCount,
                searchCount: searchCount,
                allSearched: allSearched,
                isSingleContact: true,
                withSpinner: false,
                isPinned: false,
                withPin: false,
                isBellRinging: false,
                person: {
                    hashmail: person.getHashmail(),
                    name: person.getName(),
                    description: person.getDescription(),
                    present: person.isPresent(),
                    starred: person.isStarred()
                },
                persons: null,
            };
        }
        return {
            id: model.id,
            unread: unread,
            unmutedUnread: unread,
            elementsCount: elementsCount,
            searchCount: searchCount,
            allSearched: allSearched,
            isSingleContact: false,
            withSpinner: false,
            isPinned: false,
            withPin: false,
            isBellRinging: false,
            person: null,
            persons: model.persons.map(person => {
                return {
                    hashmail: person.getHashmail(),
                    name: person.getName()
                };
            }),
        };
    }
    
    static convertConv2(model: Conv2Section, unreadCount: number, elementsCount: number, searchCount: number, allSearched: boolean, unmutedUnread: number, withSpinner: boolean, isPinned: boolean, withPin: boolean, activeVoiceChatInfo: Types.webUtils.ActiveVoiceChatInfo, isBellRinging: boolean = false): Types.webUtils.ConversationModel {
        let customName = model.conv2Service.sectionManager.customSectionNames.getCustomSectionName(model);
        if (model.isSingleContact()) {
            let person = model.getFirstPerson();
            let deleted = model.conv2Service.contactService.isUserDeleted(person.usernameCore);
            return {
                id: model.id,
                unread: unreadCount,
                unmutedUnread: unmutedUnread === null ? unreadCount : unmutedUnread,
                elementsCount: elementsCount,
                searchCount: searchCount,
                allSearched: allSearched,
                isSingleContact: true,
                withSpinner: withSpinner,
                isPinned: isPinned,
                withPin: withPin,
                customName: customName,
                person: {
                    hashmail: person.getHashmail(),
                    name: person.getName(),
                    description: person.getDescription(),
                    present: person.isPresent(),
                    starred: person.isStarred(),
                    isBasic: person && person.getContact() && person.getContact().basicUser,
                    deleted: deleted
                },
                persons: null,
                isBellRinging: isBellRinging,
                activeVoiceChatInfo: activeVoiceChatInfo
            };
        }
        return {
            id: model.id,
            unread: unreadCount,
            unmutedUnread: unmutedUnread === null ? unreadCount : unmutedUnread,
            elementsCount: elementsCount,
            searchCount: searchCount,
            allSearched: allSearched,
            isSingleContact: false,
            withSpinner: withSpinner,
            isPinned: isPinned,
            withPin: withPin,
            customName: customName,
            person: null,
            persons: model.persons.map(person => {
                let deleted = person && model.conv2Service.contactService.isUserDeleted(person.getName());

                return {
                    hashmail: person.getHashmail(),
                    name: person.getName(),
                    isBasic: person && person.getContact() && person.getContact().basicUser,
                    deleted: deleted
                };
            }),
            personsPresence: this.getPersonsPresence(model),
            isBellRinging: isBellRinging,
            activeVoiceChatInfo: activeVoiceChatInfo
        };
    }
    
    static getOnlineValue(a: Conv2Section): number {
        if (a.isSingleContact()) {
            let person = a.getFirstPerson();
            return person.isPresent() ? 1 : 0;
        }
        else {
            let nTotal = a.persons.length;
            let nPresent = a.persons.filter(x => x.isPresent()).length;
            return nPresent / nTotal;
        }
    }
    
    static getPersonsPresence(a: Conv2Section): number {
        let val = this.getOnlineValue(a);
        if (val >= 0.75) {
            return 3;
        }
        if (val >= 0.50) {
            return 2;
        }
        if (val >= 0.25) {
            return 1;
        }
        return 0;
    }
}