import {section, mail, utils} from "../../Types";
import {ChatModuleService} from "./ModuleService"
import * as shelltypes from "../../app/common/shell/ShellTypes";
import * as Q from "q";
import * as privfs from "privfs-client";
import {MessageService} from "../MessageService";
import {HashmailResolver} from "../HashmailResolver";
import {ConversationService} from "../conversation/ConversationService";

export class SectionConversationService {
    
    constructor(
        public messageService: MessageService,
        public hashmailResolver: HashmailResolver,
        public conversationService: ConversationService,
        public fileSizeChecker: utils.FileSizeChecker
    ) {
    }
    
    sendMessageToConversation(options: section.SendMessageOptionsEx): Q.Promise<mail.MessagePostResult> {
        return this.sendMessageToConversationEx(options.destination, receivers => ChatModuleService.createMessage(this.messageService, receivers, options));
    }
    
    sendAttachmentToConversation(options: section.UploadFileConversationOptions): Q.Promise<section.SendAttachmentToConversationResult> {
        return Q().then(() => {
            this.fileSizeChecker.checkFileSize(options.data.getSize());
            return this.sendMessageToConversationEx(options.destination, receivers => ChatModuleService.createMessageWithAttachment(this.messageService, receivers, options.data));
        })
        .then(result => {
            return {
                result: result,
                openableElement: shelltypes.OpenableAttachment.create(result.outMessage.attachments[0], true, true)
            };
        });
    }
    
    sendMessageToConversationEx(destination: string, messageCreator: (receivers: privfs.message.MessageReceiver[]) => privfs.message.Message): Q.Promise<mail.MessagePostResult> {
        return Q().then(() => {
            let conversationId = destination;
            let conversation = this.conversationService.getConversation(conversationId);
            if (conversation == null) {
                throw new Error("invalid-destination");
            }
            return Q().then(() => {
                return this.hashmailResolver.getValidReceivers(conversation.getHashmails());
            })
            .then(receivers => {
                return this.messageService.sendMessage(messageCreator(receivers));
            })
            .then(result => {
                if (result.nooneGetMsg || result.outMessage == null) {
                    return Q.reject({message: "send-msg-error", result: result});
                }
                return result;
            });
        });
    }
}