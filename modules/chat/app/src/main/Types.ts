import {mail} from "pmc-mail";

export type MessagesChannel = mail.conversation.Conversation|string;

export enum ChatType {
    CONVERSATION,
    CHANNEL
}