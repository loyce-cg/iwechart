import * as Q from "q";
import {PromiseUtils} from "simplito-promise";
import {SinkIndexEntry, Flags} from "./SinkIndexEntry";
import {ConversationId} from "./conversation/ConversationId";
import * as privfs from "privfs-client";
import {mail} from "../Types";

export class MessageTagsFactory {
    
    constructor(
        public tagProvider: mail.TagProvider
    ) {
    }
    
    getAllTagsForMessage(message: privfs.types.message.Message, flags: Flags): Q.Promise<string[]> {
        return MessageTagsFactory.getAllTags(this.tagProvider, message, flags);
    }
    
    getAllTagsForSinkIndex(indexEntry: SinkIndexEntry): Q.Promise<string[]> {
        return MessageTagsFactory.getAllTagsFromSource(this.tagProvider, indexEntry.source, indexEntry.data);
    }
    
    static getMessageTypeTag(type: string): string {
        return "type:" + type;
    }
    
    static getMessageTags(message: privfs.types.message.Message): string[] {
        return ["cnv:" + ConversationId.createFromMessage(message), MessageTagsFactory.getMessageTypeTag(message.type || "mail")];
    }
    
    static getMessageTagsFromSource(source: privfs.types.message.SerializedMessageFull): string[] {
        return ["cnv:" + ConversationId.createFromSource(source), MessageTagsFactory.getMessageTypeTag(source.data.type || "mail")];
    }
    
    static getFlagTags(tagProvider: mail.TagProvider, flags: Flags): Q.Promise<string[]> {
        let tags: string[] = [];
        return PromiseUtils.oneByOne(flags, (name, value) => {
            if (!value || name != "read") {
                return;
            }
            return Q().then(() => {
                return tagProvider.getTag(name);
            })
            .then(tag => {
                tags.push("priv:" + tag);
            });
        }).thenResolve(tags);
    }
    
    static getAllTags(tagProvider: mail.TagProvider, message: privfs.types.message.Message, flags: Flags): Q.Promise<string[]> {
        return Q().then(() => {
            return MessageTagsFactory.getFlagTags(tagProvider, flags);
        })
        .then(tags => {
            return tags.concat(MessageTagsFactory.getMessageTags(message));
        });
    }
    
    static getAllTagsFromSource(tagProvider: mail.TagProvider, source: privfs.types.message.SerializedMessageFull, flags: Flags): Q.Promise<string[]> {
        return Q().then(() => {
            return MessageTagsFactory.getFlagTags(tagProvider, flags);
        })
        .then(tags => {
            return tags.concat(MessageTagsFactory.getMessageTagsFromSource(source));
        });
    }
}
