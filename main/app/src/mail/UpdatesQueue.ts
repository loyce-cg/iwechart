import * as Q from "q";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.UpdatesQueue");
import * as privfs from "privfs-client";
import * as Utils from "simplito-utils";
import {PromiseUtils} from "simplito-promise";
import {SinkSource} from "./SinkIndexManager";
import {utils} from "../Types";

export interface MessageModification {
    type: "addTag"|"removeTag"|"setFlag"|"removeFlag";
    name: string;
    value?: any;
}

export type Flags = {[name: string]: any};

export interface SerializedEntry {
    id: number;
    source: privfs.types.message.SerializedMessageFull;
    data: Flags;
    tags: string[];
    stickers: privfs.types.core.Sticker[];
}

export interface Task {
    type: string;
    sinkId: string;
    destSinkId?: string;
    msgId?: number;
    newData?: Flags;
    oldData?: Flags;
    newTags?: string[];
    oldTags?: string[];
    oldStickers?: privfs.types.core.Sticker[];
    oldSource?: privfs.types.message.SerializedMessageFull;
    messages?: SerializedEntry[];
}

export interface TaskWithStatus extends Task {
    status: string;
}

export type Callback = () => Q.IWhenable<void>;

export class UpdatesQueue {
    
    queue: TaskWithStatus[];
    storageKey: string;
    running: boolean;
    
    constructor(
        public storage: utils.IStorage,
        public messageManager: privfs.message.MessageManager,
        public sinkSource: SinkSource
    ) {
        this.queue = [];
        this.storageKey = "updates-queue";
    }
    
    load(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("load", this.storageKey);
            return this.storage.get(this.storageKey);
        })
        .then((data: Task[]) => {
            if (data) {
                data.forEach(task => {
                    this.queue.push({
                        status: "new",
                        type: task.type,
                        sinkId: task.sinkId,
                        destSinkId: task.destSinkId,
                        msgId: task.msgId,
                        newData: task.newData,
                        oldData: task.oldData,
                        newTags: task.newTags,
                        oldTags: task.oldTags,
                        oldStickers: task.oldStickers,
                        oldSource: task.oldSource,
                        messages: task.messages
                    });
                });
            }
        })
        .then(() => {
            Logger.debug("loaded", this.queue);
        });
    }
    
    save(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("save");
            let data: Task[] = [];
            this.queue = this.queue.filter(task => {
                return task.status != "done";
            });
            this.queue.forEach(task => {
                data.push({
                    type: task.type,
                    sinkId: task.sinkId,
                    destSinkId: task.destSinkId,
                    msgId: task.msgId,
                    newData: task.newData,
                    oldData: task.oldData,
                    newTags: task.newTags,
                    oldTags: task.oldTags,
                    oldStickers: task.oldStickers,
                    oldSource: task.oldSource,
                    messages: task.messages
                });
            });
            return this.storage.set(this.storageKey, data);
        });
    }
    
    findExistingTask(sinkId: string, msgId: number): TaskWithStatus {
        for (var i in this.queue) {
            let task = this.queue[i];
            if (task.sinkId == sinkId && task.msgId == msgId) {
                return task;
            }
        }
        return null;
    }
    
    revertTask(task: TaskWithStatus, oldTask?: Task): Q.Promise<void> {
        if (oldTask == null) {
            task.status = "done";
        }
        else {
            task.status = "new";
            task.type = oldTask.type;
            task.sinkId = oldTask.sinkId;
            task.msgId = oldTask.msgId;
            task.newData = oldTask.newData;
            task.oldData = oldTask.oldData;
            task.newTags = oldTask.newTags;
            task.oldTags = oldTask.oldTags;
            task.oldStickers = task.oldStickers;
            task.oldSource = oldTask.oldSource;
            task.destSinkId = oldTask.destSinkId;
            task.messages = oldTask.messages;
        }
        return this.save();
    }
    
    addUpdateTask(sinkId: string, msgId: number, func: Callback): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("addUpdateTask", sinkId, msgId);
            let task = this.findExistingTask(sinkId, msgId);
            let oldTask = Utils.simpleDeepClone(task);
            if (task == null) {
                task = {
                    status: null,
                    type: "update",
                    sinkId: sinkId,
                    msgId: msgId
                };
                this.queue.push(task);
            }
            else if (task.type == "delete" || task.type == "move") {
                Logger.warn("Cannot change task type to 'update'", task, sinkId, msgId);
                return;
            }
            task.status = "addding";
            return this.save()
            .then(func)
            .fail(() => {
                return this.revertTask(task, oldTask);
            })
            .then(() => {
                task.status = "new";
                this.run();
            });
        });
    }
    
    addDeleteTask(sinkId: string, msgId: number, oldSource: privfs.types.message.SerializedMessageFull, oldData: Flags, oldTags: string[], oldStickers: privfs.types.core.Sticker[], func: Callback): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("addDeleteTask", sinkId, msgId, oldSource, oldData, oldTags);
            let task = this.findExistingTask(sinkId, msgId);
            let oldTask = Utils.simpleDeepClone(task);
            if (task == null) {
                task = {
                    status: null,
                    type: null,
                    sinkId: sinkId,
                    msgId: msgId,
                    oldData: oldData,
                    oldTags: oldTags,
                    oldStickers: oldStickers
                };
                this.queue.push(task);
            }
            task.type = "delete";
            task.oldSource = oldSource;
            task.status = "addding";
            return this.save()
            .then(func)
            .fail(() => {
                return this.revertTask(task, oldTask);
            })
            .then(() => {
                task.status = "new";
                this.run();
            });
        });
    }
    
    addMoveTask(sinkId: string, msgId: number, source: privfs.types.message.SerializedMessageFull, data: Flags, tags: string[], stickers: privfs.types.core.Sticker[], destSinkId: string, func: Callback): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("addMoveTask", sinkId, msgId, source, data, tags, destSinkId);
            let task = this.findExistingTask(sinkId, msgId);
            let oldTask = Utils.simpleDeepClone(task);
            if (task == null) {
                task = {
                    status: null,
                    type: null,
                    sinkId: sinkId,
                    msgId: msgId,
                    oldData: data,
                    oldTags: tags,
                    oldStickers: stickers
                };
                this.queue.push(task);
            }
            else if (task.type == "delete") {
                Logger.warn("Cannot change task type to 'move'", task, sinkId, msgId, source, data, tags, destSinkId);
                return;
            }
            task.type = "move";
            task.newData = data;
            task.newTags = tags;
            task.oldSource = source;
            task.destSinkId = destSinkId;
            task.status = "addding";
            return this.save()
            .then(func)
            .fail(() => {
                return this.revertTask(task, oldTask);
            })
            .then(() => {
                task.status = "new";
                this.run();
            });
        });
    }
    
    addDeleteBulkTask(sinkId: string, messages: SerializedEntry[], func: Callback): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("addDeleteBulkTask", sinkId, messages);
            let task = {
                sinkId: sinkId,
                type: "deleteBulk",
                messages: messages,
                status: "addding"
            };
            this.queue.push(task);
            return this.save()
            .then(func)
            .fail(() => {
                return this.revertTask(task);
            })
            .then(() => {
                task.status = "new";
                this.run();
            });
        });
    }
    
    run(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("run", this.queue.length);
            if (this.running || this.queue.length == 0) {
                return;
            }
            this.running = true;
            return PromiseUtils.oneByOne(this.queue, (i, task) => {
                if (task.status == "new") {
                    Logger.debug("Running task", task);
                    let index = this.sinkSource.getIndexBySinkId(task.sinkId);
                    if (index == null) {
                        Logger.warn("Cannot find index for task", task);
                        task.status = "done";
                        return;
                    }
                    task.status = "processing";
                    if (task.type == "update") {
                        let entry = index.getEntry(task.msgId);
                        if (entry == null) {
                            Logger.warn("Cannot find entry for update task", task);
                            task.status = "done";
                            return;
                        }
                        return this.messageManager.messageModify(index.cursor, task.msgId, entry.data, entry.tags, true, true)
                        .then(() => {
                            task.status = "done";
                            Logger.debug("Task success", task);
                            return index.save();
                        })
                        .fail(e => {
                            if (privfs.core.ApiErrorCodes.is(e, "INVALID_MOD_SEQ")) {
                                Logger.debug("Task fail - INVALID_MOD_SEQ", task);
                                task.status = "new";
                            }
                            else if (privfs.core.ApiErrorCodes.is(e, "MESSAGE_DOESNT_EXISTS")) {
                                Logger.debug("Task fail - MESSAGE_DOESNT_EXISTS", task);
                                task.status = "done";
                                return index.deleteOldEntry(task.msgId);
                            }
                            else {
                                Logger.error("Task fail - rollback change", task, e, e.stack);
                                task.status = "done";
                                return index.revertUpdateEntry(task.msgId);
                            }
                        })
                        .fail(e => {
                            Logger.error("Task unexpected error", task, e, e.stack);
                        });
                    }
                    if (task.type == "move") {
                        let destSink = this.sinkSource.getSinkById(task.destSinkId);
                        if (destSink == null) {
                            Logger.warn("Cannot find destination index for task - rollback change", task);
                            task.status = "done";
                            return index.revertMoveEntry(task.msgId, task.oldSource, task.oldData, task.oldTags, task.oldStickers);
                        }
                        let message = privfs.message.Message.deserializeFromSourceWithoutCheckingSignature(this.messageManager.storage, task.oldSource);
                        return this.messageManager.messageMove(message, task.newData, task.newTags, index.cursor, destSink, true)
                        .then(() => {
                            task.status = "done";
                            Logger.debug("Task success", task);
                            return index.save();
                        })
                        .fail(e => {
                            if (privfs.core.ApiErrorCodes.is(e, "INVALID_MOD_SEQ")) {
                                Logger.debug("Task fail - INVALID_MOD_SEQ", task);
                                task.status = "new";
                            }
                            else if (privfs.core.ApiErrorCodes.is(e, "MESSAGE_DOESNT_EXISTS")) {
                                Logger.debug("Task fail - MESSAGE_DOESNT_EXISTS", task);
                                task.status = "done";
                                return index.deleteOldEntry(task.msgId);
                            }
                            else {
                                Logger.error("Task fail - rollback change", task, e, e.stack);
                                task.status = "done";
                                return index.revertMoveEntry(task.msgId, task.oldSource, task.oldData, task.oldTags, task.oldStickers);
                            }
                        })
                        .fail(e => {
                            Logger.error("Task unexpected error", task, e, e.stack);
                        });
                    }
                    if (task.type == "delete") {
                        return this.messageManager.messageDelete(index.cursor, task.msgId, true)
                        .then(() => {
                            task.status = "done";
                            Logger.debug("Task success", task);
                            return index.save();
                        })
                        .fail(e => {
                            if (privfs.core.ApiErrorCodes.is(e, "INVALID_MOD_SEQ")) {
                                Logger.debug("Task fail - INVALID_MOD_SEQ", task);
                                task.status = "new";
                            }
                            else if (privfs.core.ApiErrorCodes.is(e, "MESSAGE_DOESNT_EXISTS")) {
                                Logger.debug("Task fail - MESSAGE_DOESNT_EXISTS", task);
                                task.status = "done";
                                return index.deleteOldEntry(task.msgId);
                            }
                            else {
                                Logger.error("Task fail - rollback change", task, e, e.stack);
                                task.status = "done";
                                return index.revertDeleteEntry(task.msgId, task.oldSource, task.oldData, task.oldTags, task.oldStickers);
                            }
                        })
                        .fail(e => {
                            Logger.error("Task unexpected error", task, e, e.stack);
                        });
                    }
                    if (task.type == "deleteBulk") {
                        let mids = [];
                        for (var i in task.messages) {
                            mids.push(task.messages[i].id);
                        }
                        return this.messageManager.messageDelete(index.cursor, mids, true)
                        .then(() => {
                            task.status = "done";
                            Logger.debug("Task success", task);
                            return index.save();
                        })
                        .fail(e => {
                            if (privfs.core.ApiErrorCodes.is(e, "INVALID_MOD_SEQ")) {
                                Logger.debug("Task fail - INVALID_MOD_SEQ", task);
                                task.status = "new";
                            }
                            else {
                                Logger.error("Task fail - rollback change", task, e, e.stack);
                                task.status = "done";
                                return index.revertDeleteBulk(task.messages);
                            }
                        })
                        .fail(e => {
                            Logger.error("Task unexpected error", task, e, e.stack);
                        });
                    }
                    Logger.warn("Invalid task type", task);
                    task.status = "done";
                }
            })
            .finally(() => {
                this.save();
                this.running = false;
            });
        });
    }
}
