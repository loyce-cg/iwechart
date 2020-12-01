import * as Q from "q";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.SinkPolling");
import * as privfs from "privfs-client";
import {PromiseUtils} from "simplito-promise";
import {DeferedTask} from "../task/DeferedTask";
import {ParallelTaskStream} from "../task/ParallelTaskStream";

export interface SinkPollingService {
    getCursorsForPolling(): privfs.message.MessageSinkCursor[];
    consumePollingResult(data: privfs.types.message.SinkPollResult): Q.Promise<void>;
    afterPolling(): Q.Promise<void>;
}

export class SinkPolling {
    
    guardian: {value: boolean};
    resolve: (val: Q.IWhenable<void>) => void;
    delay: number;
    timeoutHandle: number;
    
    constructor(
        public taskStream: ParallelTaskStream,
        public messageManager: privfs.message.MessageManager,
        public sinkPollingManager: SinkPollingService,
        kickOnStart: boolean
    ) {
        this.guardian = {value: true};
        let kickedOnStart = false;
        PromiseUtils.infinity(this.guardian, () => {
            let task: DeferedTask;
            return Q.Promise<void>(resolve => {
                this.resolve = resolve;
                if (this.delay != null) {
                    this.timeoutHandle = setTimeout(this.kick.bind(this), this.delay);
                    this.delay = null;
                }
                else if (kickOnStart && !kickedOnStart) {
                    kickedOnStart = true;
                    this.kick();
                }
            })
            .then(() => {
                if (!this.guardian.value) {
                    return;
                }
                let cursors = this.sinkPollingManager.getCursorsForPolling();
                if (cursors.length == 0) {
                    return <privfs.types.message.SinkPollResult>{sinks: {}, delay: 10000};
                }
                Logger.debug("Polling sinks...", cursors);
                task = this.taskStream.createDeferedTask("sink-polling", cursors);
                return this.messageManager.sinkPoll(cursors, false, true);
            })
            .then(data => {
                if (!this.guardian.value) {
                    return;
                }
                if (task) {
                    task.progress("process");
                }
                Logger.debug("Handling sinks polling result", data);
                this.delay = data.delay;
                return this.sinkPollingManager.consumePollingResult(data)
                .then(() => {
                    Logger.debug("handlePollSinksResult success");
                }).fin(() => {
                    if (!this.guardian.value) {
                        return;
                    }
                    return this.sinkPollingManager.afterPolling()
                    .fail(e => {
                        Logger.debug("UpdatesQueue error", e, e.stack);
                    });
                });
            })
            .then(() => {
                if (task) {
                    task.endWithSuccess();
                }
            })
            .fail(e => {
                Logger.error("Poll was interrupted -", e, e.stack);
                if (task) {
                    task.endWithError();
                }
                this.delay = 5000;
            });
        });
    }
    
    kick(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
        if (this.resolve) {
            this.resolve(null);
            this.resolve = null;
        }
    }
    
    destroy(): void {
        this.guardian.value = false;
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
        }
        this.timeoutHandle = null;
        this.resolve = null;
    }
}
