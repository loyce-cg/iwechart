import {section, utils, event} from "../../Types";
import {SinkIndexEntry} from "../SinkIndexEntry";
import {Lang} from "../../utils/Lang";
import {EventDispatcher} from "../../utils/EventDispatcher";
import {SectionUtils} from "./SectionUtils";
import * as Q from "q";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";
import {PromiseUtils} from "simplito-promise";
import {MessageService} from "../MessageService";
import {HashmailResolver} from "../HashmailResolver";
import { SectionService } from "./SectionService";
import {MessageFlagsUpdater} from "../MessageFlagsUpdater";
let Logger = RootLogger.get("privfs-mail-client.mail.section.SectionAccessManager");


export class SectionAccessManager {
    
    static SECTION_REVOKE_ACCESS = "section-revoke-access";
    static SECTION_STATE_CHANGED = "section-state-changed";
    eventDispatcher: EventDispatcher;
    
    constructor(
        public messageFlagsUpdater: MessageFlagsUpdater,
        public messageService: MessageService,
        public hashmailResolver: HashmailResolver,
        public identity: privfs.identity.Identity
    ) {
        this.eventDispatcher = new EventDispatcher();
    }

    
    handleSectionMsg(entry: SinkIndexEntry): Q.Promise<void> {
        return Q().then(() => {
            if (entry.source.data.type !== SectionAccessManager.SECTION_REVOKE_ACCESS && entry.source.data.type !== SectionAccessManager.SECTION_STATE_CHANGED) {
                return;
            }
            if (entry.isProcessed() || entry.proceeding) {
                return;
            }
            let event = <section.SectionMessage>entry.getContentAsJson();
            if (event === null) {
                return;
            }
            entry.proceeding = true;
            return Q().then(() => {
                switch (event.type) {
                    case SectionAccessManager.SECTION_REVOKE_ACCESS: {
                        this.eventDispatcher.dispatchEvent({type: "refresh-sections"});
                        break;
                    }
                    case SectionAccessManager.SECTION_STATE_CHANGED: {
                        this.eventDispatcher.dispatchEvent<event.SectionStateChangedEvent>({type: "section-state-changed", sectionId: (<any>event).sectionId});
                        break;
                    }
                }
            })
            .then(() => {
                return this.messageFlagsUpdater.updateMessageFlag(entry, "processed", true);
            });
        })
        .fail(e => {
            Logger.error("Error during processing section message", e);
        });
    }
    
    
    createSectionRevokeMessage(receiver: privfs.message.MessageReceiver, section: SectionService): privfs.message.Message {
        let messageData: section.SectionAccessChangeMessage = {
            type: SectionAccessManager.SECTION_REVOKE_ACCESS,
            sectionId: section.getId()
        }
        let message = this.messageService.createMessage(receiver, "", JSON.stringify(messageData));
        message.type = SectionAccessManager.SECTION_REVOKE_ACCESS;
        return message;
    }

    createSectionStateChangedMessage(receiver: privfs.message.MessageReceiver, section: SectionService): privfs.message.Message {
        let messageData: section.SectionAccessChangeMessage = {
            type: SectionAccessManager.SECTION_STATE_CHANGED,
            sectionId: section.getId()
        }
        let message = this.messageService.createMessage(receiver, "", JSON.stringify(messageData));
        message.type = SectionAccessManager.SECTION_STATE_CHANGED;
        return message;
    }

}