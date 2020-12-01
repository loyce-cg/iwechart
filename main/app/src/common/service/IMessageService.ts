import * as privfs from "privfs-client";

export interface IMessageService {
    getMessage(sid: string, id: number): Q.Promise<privfs.types.message.SerializedMessageFull>;
}
