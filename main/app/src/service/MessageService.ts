import {IMessageService} from "../common/service/IMessageService";
import * as privfs from "privfs-client";
import * as Q from "q";
import {CommonApplication} from "../app/common/CommonApplication";
import {ApiMethod, ApiService} from "../utils/Decorators";

@ApiService
export class MessageService implements IMessageService {
    
    constructor(public app: CommonApplication) {
    }
    
    @ApiMethod
    getMessage(sid: string, id: number): Q.Promise<privfs.types.message.SerializedMessageFull> {
        return Q().then(() => {
            if (this.app.mailClientApi == null) {
                return null;
            }
            return this.app.mailClientApi.privmxRegistry.getSinkIndexManager().then(sinkIndexManager => {
                let sinkIndex = sinkIndexManager.getIndexBySinkId(sid);
                if (sinkIndex == null) {
                    return null;
                }
                let entry = sinkIndex.getEntry(id);
                return entry ? entry.source : null;
            });
        });
    }
}