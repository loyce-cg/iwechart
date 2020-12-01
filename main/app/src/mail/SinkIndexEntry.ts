import {SinkIndex} from "./SinkIndex";
import * as privfs from "privfs-client";
import {PromiseQueue} from "simplito-promise";
import * as Utils from "simplito-utils";
import {MessageModification} from "./UpdatesQueue";
import {Lang} from "../utils/Lang";
import {mail, section} from "../Types";

export type Flags = {[name: string]: any};

export interface Serialized {
    s: privfs.types.message.SerializedMessageFull;
    d: Flags;
    t: string[];
    z: privfs.types.core.Sticker[];
    m: MessageModification[];
}

export interface Verified {
    status: number;
    fetch: privfs.pki.Types.pki.KeyStoreEntry
}

export interface Meta {
    data: Flags;
    tags: string[];
};

export interface MetaCommit {
    data: Flags;
    tags: string[];
    mods: MessageModification[];
};

export class SinkIndexEntry {
    
    static VerifyStatus = {
        OK: 0,
        INVALID_KEY: 1,
        KEY_DOESNT_EXISTS: 2,
        INVALID_SIGNATURE: 3,
        INVALID_NET_STATE: 4,
        NO_QUORUM: 5,
        INVALID_SERVER_KEYSTORE: 6
    };
    
    source: privfs.types.message.SerializedMessageFull;
    data: Flags;
    tags: string[];
    index: SinkIndex;
    updateQueue: PromiseQueue;
    proceeding: boolean;
    message: privfs.message.SentMessage;
    contentAsJson: any;
    id: number;
    sink: privfs.message.MessageSinkPriv;
    host: string;
    verified: Verified;
    metaCommit: MetaCommit;
    stickers: privfs.types.core.Sticker[];
    
    constructor(source: privfs.types.message.SerializedMessageFull, data: Flags, tags: string[], mods: MessageModification[], stickers: privfs.types.core.Sticker[], index: SinkIndex) {
        this.source = source;
        this.index = index;
        this.metaCommit = {
            data: data || {},
            tags: tags || [],
            mods: mods || []
        };
        this.stickers = stickers || [];
        this.refreshMeta();
        this.updateQueue = new PromiseQueue();
        this.proceeding = false;
        Utils.defineLazyReadOnlyProperty(this, "host", () => {
            if (this.message) {
                return this.message.sender.host;
            }
            return this.source.data.sender.hashmail.split("#")[1];
        });
    }
    
    getEntryType(): string {
        return "sink-index-entry";
    }
    
    addMods(mods: MessageModification[]) {
        mods.forEach(mod => {
            this.metaCommit.mods.push(mod);
        });
        this.refreshMeta();
    }
    
    refreshMeta() {
        let res = SinkIndexEntry.applyModify(this.metaCommit);
        this.data = res.data;
        this.tags = res.tags;
    }
    
    static applyModify(commit: MetaCommit): Meta {
        let result: Meta = {
            data: commit.data ? Utils.simpleDeepClone(commit.data) : {},
            tags: commit.tags ? Utils.simpleDeepClone(commit.tags) : []
        };
        commit.mods.forEach(x => {
            if (x.type == "addTag") {
                Lang.uniqueAdd(result.tags, x.name);
            }
            else if (x.type == "removeTag") {
                Lang.removeFromList(result.tags, x.name);
            }
            else if (x.type == "setFlag") {
                if (!result.data) {
                    result.data = {};
                }
                result.data[x.name] = x.value;
            }
            else if (x.type == "removeFlag") {
                if (result.data) {
                    delete result.data[x.name];
                }
            }
        });
        return result;
    }
    
    static getMetaDiff(orgData: Flags, orgTags: string[], newData: Flags, newTags: string[]) {
        let mods: MessageModification[] = [];
        for (let key in orgData) {
            if (key in newData) {
                if (!Lang.isDeepEqual(orgData[key], newData[key])) {
                    mods.push({
                        type: "setFlag",
                        name: key,
                        value: newData[key]
                    });
                }
            }
            else {
                mods.push({
                    type: "removeFlag",
                    name: key
                });
            }
        }
        for (let key in newData) {
            if (!(key in orgData)) {
                mods.push({
                    type: "setFlag",
                    name: key,
                    value: newData[key]
                });
            }
        }
        orgTags.forEach(t => {
            if (newTags.indexOf(t) == -1) {
                mods.push({
                    type: "removeTag",
                    name: t
                });
            }
        });
        newTags.forEach(t => {
            if (orgTags.indexOf(t) == -1) {
                mods.push({
                    type: "addTag",
                    name: t
                });
            }
        });
        return mods;
    }
    
    getMessage(): privfs.message.SentMessage {
        if (this.message == null) {
            this.message = privfs.message.Message.deserializeFromSourceWithoutCheckingSignature(this.index.sinkIndexManager.messageManager.storage, this.source);
            this.message.sink = this.sink;
        }
        return this.message;
    }
    
    getContentAsJson(): any {
        if (typeof(this.contentAsJson) == "undefined") {
            try {
                this.contentAsJson = JSON.parse(this.source.data.text);
            }
            catch (e) {
                this.contentAsJson = null;
            }
        }
        return this.contentAsJson;
    }
    
    isRead(): boolean {
        if (this.index.autoMarkMyMessagesAsRead && this.source.data.sender.pub58 == this.index.sinkIndexManager.identity.pub58) {
            return true;
        }
        return (this.index.useReadIndex && this.index.readIndex && this.id <= this.index.readIndex) || (this.data && this.data.read);
    }
    
    isProcessed(): boolean {
        return this.data && this.data.processed;
    }
    
    isTagged(): boolean {
        return this.data && this.data.tagged;
    }
    
    hasVerifiedInformation(): boolean {
        return this.hasSavedVerifiedInformation() || this.verified != null;
    }
    
    hasSavedVerifiedInformation() {
        return this.data && typeof(this.data.verified) == "object" && this.data.verified != null;
    }
    
    needToRefreshVerified(): boolean {
        return this.verified == null && (!this.hasSavedVerifiedInformation() || !SinkIndexEntry.isStatusValidToSave(this.data.verified.status));
    }
    
    static isStatusValidToSave(status: number): boolean {
        return status == SinkIndexEntry.VerifyStatus.OK || status == SinkIndexEntry.VerifyStatus.INVALID_KEY || status == SinkIndexEntry.VerifyStatus.KEY_DOESNT_EXISTS;
    }
    
    getVerifiedStatus(): number {
        return this.hasSavedVerifiedInformation() ? this.data.verified.status : (this.verified ? this.verified.status : null);
    }
    
    serialize(): string {
        return JSON.stringify(this.serializeCore());
    }
    
    serializeCore(): Serialized {
        return {
            s: this.source,
            d: this.metaCommit.data,
            t: this.metaCommit.tags,
            z: this.stickers,
            m: this.metaCommit.mods
        };
    }
    
    serializeCoreWithMods(mods: MessageModification[]): Serialized {
        return {
            s: this.source,
            d: this.metaCommit.data,
            t: this.metaCommit.tags,
            z: this.stickers,
            m: this.metaCommit.mods.concat(mods)
        };
    }
    
    isType(type: string): boolean {
        return this.source.data.type == type;
    }
    
    isMailMessage(): boolean {
        return this.source.data.type == null || this.source.data.type == "";
    }
    
    static parse(serializedEntry: string, index: SinkIndex): SinkIndexEntry {
        let o = <Serialized>JSON.parse(serializedEntry);
        return SinkIndexEntry.create(o, index);
    }
    
    static create(data: Serialized, index: SinkIndex): SinkIndexEntry {
        return new SinkIndexEntry(data.s, data.d, data.t, data.m, data.z, index);
    }
    
    static getCfmId(sid: string, mid: string|number): string {
        return "cfm:" + sid + ":" + mid;
    }
    
    static getCfmIdFromHandle(handle: mail.MessageHandle): string {
        return SinkIndexEntry.getCfmId(handle.sid, handle.sid);
    }
    
    static parseCfmId(cfmId: string): mail.MessageHandle {
        let splitted = cfmId.split(":");
        return {
            sid: splitted[1],
            mid: parseInt(splitted[2])
        }
    }
    
    getCfmId(): string {
        return SinkIndexEntry.getCfmId(this.source.data.sid, this.source.data.msgId);
    }
    
    isContactFormMessage(): boolean {
        let sink = this.index.sinkIndexManager.getContactFormSink();
        return sink != null && this.getOriginalSinkId() == sink.id;
    }
    
    getContactFormMessageSender(): string {
        if (this.isContactFormMessage()) {
            let json = this.getContentAsJson();
            if (json && json.email) {
                return json.email;
            }
        }
        return null;
    }
    
    getOriginalSinkId(): string {
        return this.source.data.sid;
    }
    
    getOriginalSink(): privfs.message.MessageSinkPriv {
        return this.index.sinkIndexManager.getSinkById(this.getOriginalSinkId());
    }
    
    getOriginalSinkType(): string {
        let sink = this.getOriginalSink();
        return sink && sink.extra ? sink.extra.type : null;
    }
    
    getAttachmentSources(cache?: boolean): privfs.block.BlocksInfo[] {
        return this.getMessage().getAttachmentSources(cache);
    }
    
    getModule(): section.NotificationModule {
        let msg = this.getMessage();
        let jsonCnt = this.getContentAsJson();
        if (!msg || !jsonCnt || !jsonCnt.moduleName) {
            return section.NotificationModule.CHAT;
        }
        return jsonCnt.moduleName;
    }
}
Object.defineProperty(SinkIndexEntry.prototype, "id", {
    get: function(this: SinkIndexEntry): number {
        return this.source.serverId;
    },
    enumerable: true
});
Object.defineProperty(SinkIndexEntry.prototype, "sink", {
    get: function(this: SinkIndexEntry): privfs.message.MessageSinkPriv {
        return this.index.sink;
    },
    enumerable: true
});
