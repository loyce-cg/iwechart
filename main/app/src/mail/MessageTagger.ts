import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {PromiseUtils} from "simplito-promise";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {MessageFlagsUpdater} from "./MessageFlagsUpdater";
let Logger = RootLogger.get("privfs-mail-client.mail.MessageTagger");

export class MessageTagger {
    
    queue: SinkIndexEntry[];
    isRunning: boolean;
    destroyed: boolean;
    
    constructor(
        public messageFlagsUpdater: MessageFlagsUpdater
    ) {
        this.queue = [];
        this.isRunning = false;
    }
    
    destroy(): void {
        this.destroyed = true;
        this.queue = [];
        this.isRunning = false;
    }
    
    tag(indexEntry: SinkIndexEntry): void {
        if (this.destroyed) {
            throw new Error("Cannot use destroyed instance");
        }
        if (indexEntry.isTagged()) {
            return;
        }
        Logger.debug("Tagging", indexEntry.id, indexEntry);
        this.queue.push(indexEntry);
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        PromiseUtils.queue(this.queue, indexEntry => {
            if (indexEntry.isTagged()) {
                return;
            }
            Logger.debug("Tagging core", indexEntry.id, indexEntry);
            return Q().then(() => {
                return this.messageFlagsUpdater.updateMessageFlag(indexEntry, "tagged", true);
            })
            .fail(e => {
                Logger.error("Cannot save tag", e);
            });
        })
        .then(() => {
            this.isRunning = false;
        })
        .fail(e => {
            Logger.error("Unexpected error", e);
        });
    }
}
