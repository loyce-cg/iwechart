import {mail} from "pmc-mail";

export class ChatMessage {
    
    static isChatMessage(sinkIndexEntry: mail.SinkIndexEntry): boolean {
        return sinkIndexEntry.source.data.type == mail.section.ChatModuleService.CHAT_MESSAGE_TYPE;
    }
}