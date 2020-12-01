import * as privfs from "privfs-client";
import {SinkIndexManager} from "../SinkIndexManager";
import * as Q from "q";
import {SinkIndex} from "../SinkIndex";

export class SectionAdminSink {
    
    constructor(
        public adminSink: privfs.message.MessageSinkPriv,
        public sinkIndexManager: SinkIndexManager
    ) {
    }
    
    loadAdminSink(): Q.Promise<SinkIndex> {
        return Q().then(() => {
            let index = this.sinkIndexManager.getIndexBySink(this.adminSink);
            if (index != null) {
                index.sink.extra = this.adminSink.extra;
                index.useStorage = true;
                index.sendModificationToServer = false;
                return Q().then(() => {
                    return index.synchronizeUsingSinkInfo();
                })
                .then(() => {
                    return index.loadLastMessages();
                })
                .then(() => {
                    return index;
                });
            }
            return this.sinkIndexManager.addSinkM({
                sink: this.adminSink,
                load: true,
                preLoad: true,
                sinkIndexModifier: index => {
                    index.useStorage = true;
                    index.sendModificationToServer = false;
                }
            })
        });
    }
}