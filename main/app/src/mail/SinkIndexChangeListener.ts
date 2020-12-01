import {SinkIndexEntry} from "./SinkIndexEntry";
import { MessageSenderVerifier } from "./MessageSenderVerifier";
import { MessageTagger } from "./MessageTagger";
import { SinkIndex } from "./SinkIndex";
import { Event } from "../utils/Event";
import { SectionKeyManager } from "./section/SectionKeyManager";
import { AdminMessageHandler } from "./admin/AdminMessageHandler";
import { PkiEventHandler } from "./PkiEventHandler";
import * as RootLogger from "simplito-logger";
import { EventDispatcher } from "../utils/EventDispatcher";
import {event} from "../Types";
import { SectionAccessManager } from "./section/SectionAccessManager";
import { ServerProxyService } from "./proxy";
let Logger = RootLogger.get("privfs-mail-client.mail.SinkIndexChangeListener");

export class SinkIndexChangeListener {
    
    sinkIndexChangeEvent: Event<string, SinkIndex, SinkIndexEntry>;
    
    constructor(
        public messageSenderVerifier: MessageSenderVerifier,
        public messageTagger: MessageTagger,
        public sectionKeyManager: SectionKeyManager,
        public sectionAccessManager: SectionAccessManager,
        public serverProxyService: ServerProxyService,
        public adminMessageHandler: AdminMessageHandler,
        public pkiEventHandler: PkiEventHandler,
        public eventDispatcher: EventDispatcher
    ) {
        this.sinkIndexChangeEvent = new Event();
    }
    
    destroy() {
        this.sinkIndexChangeEvent.clear();
    }
    
    onSinkIndexManagerChange(events: [string, [string, SinkIndex, SinkIndexEntry][], any][]): void {
        this.sinkIndexChangeEvent.hold();
        Event.applyEvents(events, (eventType, indexEvents) => {
            if (indexEvents == null) {
                return;
            }
            Event.applyEvents(indexEvents, (indexEventType, index, entry) => {
                this.sinkIndexChangeEvent.trigger(indexEventType, index, entry);
                if (indexEventType == "save" || indexEventType == "new-stats") {
                    return;
                }
                Logger.debug("onSinkIndexChange", indexEventType, index, entry);
                if (eventType == "index-change") {
                    if (indexEventType != null && indexEventType.indexOf("revert") != -1) {
                        this.eventDispatcher.dispatchEvent<event.RevertSinkIndexEntry>({
                            type: "revertsinkindexentry",
                            indexEventType: indexEventType,
                            indexEntry: entry
                        });
                    }
                    if (indexEventType == "new") {
                        if (index.entries.contains(entry)) {
                            this.eventDispatcher.dispatchEvent<event.NewSinkIndexEntry>({
                                type: "newsinkindexentry",
                                indexEntry: entry
                            });
                        }
                    }
                    if (indexEventType == "load") {
                        index.entries.forEach(entry => {
                            if (entry.source.data.type == ServerProxyService.PROXY_ACCESS_KEY_MESSAGE_TYPE) {
                                return;
                            }
                            this.messageSenderVerifier.verify(entry);
                            this.messageTagger.tag(entry);
                        });
                    }
                    else if (indexEventType != "delete" && entry != null) {
                        if (entry.source.data.type == ServerProxyService.PROXY_ACCESS_KEY_MESSAGE_TYPE) {
                            this.serverProxyService.handleProxyServiceMsg(entry);
                        }
                        else {
                            this.messageSenderVerifier.verify(entry);
                            this.messageTagger.tag(entry);
                            if (entry.source.data.type === "pki-event") {
                                this.pkiEventHandler.handlePkiEvent(entry);
                            }
                            if (entry.source.data.type === "admin-msg") {
                                this.adminMessageHandler.handleAdminMsg(entry);
                            }
                            if (entry.source.data.type === SectionKeyManager.SECTION_MSG_TYPE) {
                                this.sectionKeyManager.handleSectionMsg(entry);
                            }
                            if (entry.source.data.type === SectionAccessManager.SECTION_REVOKE_ACCESS || entry.source.data.type === SectionAccessManager.SECTION_STATE_CHANGED) {
                                this.sectionAccessManager.handleSectionMsg(entry);
                            }
                        }

                    }
                }
            });
        });
        this.sinkIndexChangeEvent.release();
    }
}