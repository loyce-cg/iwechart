import * as privfs from "privfs-client";

export class SinkCreator {
    
    constructor(private sinkEncryptor: privfs.crypto.utils.ObjectEncryptor) {
    }
    
    createInbox(): Promise<privfs.types.message.SinkWithCreateModel> {
        return this.create({name: "Inbox", acl: "public", type: "inbox", options: {}});
    }
    
    createOutbox(): Promise<privfs.types.message.SinkWithCreateModel> {
        return this.create({name: "Outbox", acl: "private", type: "outbox", options: {}});
    }
    
    createTrash(): Promise<privfs.types.message.SinkWithCreateModel> {
        return this.create({name: "Trash", acl: "private", type: "trash", options: {}});
    }
    
    createContactForm(): Promise<privfs.types.message.SinkWithCreateModel> {
        return this.create({name: "Contact", acl: "anonymous", type: "contact", options: {verify: "email"}});
    }
    
    private async create(info: {name: string, acl: string, type: string, options: privfs.types.message.SinkOptions}): Promise<privfs.types.message.SinkWithCreateModel> {
        return await privfs.message.MessageManager.prepareSinkCreateRequest(info.name, "", info.acl, {type: info.type}, this.sinkEncryptor, info.options);
    }
}