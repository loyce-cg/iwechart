import * as Q from "q";
import * as privfs from "privfs-client";
import {SinkIndexEntry} from "./SinkIndexEntry";
import {PromiseUtils} from "simplito-promise";
import {Utils} from "../utils/Utils";
import tar = require("tar-stream");

export class ExportMessagesService {
    
    exportMessages(list: SinkIndexEntry[], name: string): Q.Promise<privfs.lazyBuffer.Content> {
        let pack = tar.pack(), chunks: Buffer[] = [];
        return Q().then(() => {
            let defer = Q.defer();
            PromiseUtils.oneByOne(list, (i, entry) => {
                defer.notify({
                    current: i,
                    count: list.length
                });
                let sink = entry.index.sink;
                let sinkName = sink.id + (sink.extra && sink.extra.type ? "_" + Utils.safePathName(sink.extra.type) : "");
                pack.entry({name: sinkName + "/" + entry.id + ".msg"}, JSON.stringify(entry.source));
                if (!entry.source.data || !entry.source.data.attachments || entry.source.data.attachments.length == 0) {
                    return;
                }
                let message = entry.getMessage();
                return PromiseUtils.oneByOne(message.attachments, (j, attachment) => {
                    return Q().then(() => {
                        return attachment.getContent(false);
                    })
                    .then(content => {
                        pack.entry({name: sinkName + "/" + entry.id + "_" + j + "_" + Utils.safePathName(content.getName())}, content.getBuffer());
                    });
                });
            })
            .then(() => {
                pack.finalize();
            })
            .fail(defer.reject);
            pack.on("data", chunk => {
                chunks.push(chunk);
            });
            pack.on("end", defer.resolve);
            return defer.promise;
        })
        .then(() => {
            return privfs.lazyBuffer.Content.createFromBuffers(chunks, "application/x-tar", name);
        });
    }
}