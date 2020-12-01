import {Query} from "./Query";
import * as Q from "q";
import * as privfs from "privfs-client";
import {ConversationId} from "./conversation/ConversationId";
import {mail} from "../Types";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {SinkService} from "./SinkService";

export interface QueryOptions {
    date?: {relation: string, value: Date};
    types?: (string|{value: string, not: boolean})[];
    limit?: number;
    order?: string;
    orderBy?: string;
    conv?: string[];
    read?: boolean;
}

export class MailQueryService {
    
    constructor(
        public identity: privfs.identity.Identity,
        public messageManager: privfs.message.MessageManager,
        public tagProvider: mail.TagProvider,
        public sinkService: SinkService
    ) {
    }
    
    queryMessagesIds(sinkId: string, options: QueryOptions): Q.Promise<number[]> {
        let limit = "limit" in options ? options.limit : -1;
        let order = "order" in options ? options.order : "DESC";
        let orderBy = "orderBy" in options ? options.orderBy : "SEQ";
        let query = new Query();
        if ("date" in options) {
            query.and(Query.createDate(options.date));
        }
        if ("types" in options) {
            let subQuery = new Query();
            options.types.forEach(type => {
                if (typeof(type) == "string") {
                    subQuery.or("type:" + type);
                }
                else {
                    subQuery.or(Query.create("type:" + type.value, type.not));
                }
            });
            query.and(subQuery);
        }
        if ("conv" in options) {
            let id = ConversationId.createFromHashmails(options.conv.concat(this.identity.hashmail));
            query.and("cnv:" + id);
        }
        return Q().then(() => {
            if ("read" in options) {
                return Q().then(() => {
                    return this.tagProvider.getTag("read");
                })
                .then(readTag => {
                    query.and(Query.create("priv:" + readTag, !options.read));
                });
            }
        })
        .then(() => {
            return this.messageManager.sinkQuery(sinkId, query.query, limit, {
                type: order,
                by: orderBy
            });
        });
    }
    
    querySinkEntries(sink: privfs.message.MessageSinkPriv, options: QueryOptions): Q.Promise<SinkIndexEntry[]> {
        return Q().then(() => {
            return this.queryMessagesIds(sink.id, options);
        })
        .then(ids => {
            return this.sinkService.getSinkIndexEntries(sink, ids);
        });
    }
    
    queryMessages(sink: privfs.message.MessageSinkPriv, options: QueryOptions, mode: privfs.types.message.MessageGetMode, asMap: boolean): Q.Promise<privfs.types.message.MessageGetResult> {
        return Q().then(() => {
            return this.queryMessagesIds(sink.id, options);
        })
        .then(ids => {
            return this.messageManager.messageGet(sink, ids, mode, asMap);
        });
    }
}