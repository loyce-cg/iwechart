import {ChatWindowView} from "../window/chat/ChatWindowView";
import {func as chatListElementTemplate} from "../window/mail/template/chat-list-element.html";
import * as Web from "pmc-web";
import * as Mail from "pmc-mail";
import { ChatMessagesView } from "../component/chatmessages/ChatMessagesView";
import { VideoConferenceWindowView } from "../window/videoConference/VideoConferenceWindowView";
let c = ChatMessagesView;

Web.Starter.objectFactory.register(ChatWindowView);
Web.Starter.objectFactory.register(VideoConferenceWindowView);

interface MailPluginView {
    registerTemplate(template: any): void;
}
Web.Starter.addEventListener<Web.Types.event.StarterLoadEvent>("load", () => {
    let mailPlugin = (<MailPluginView>Web.Starter.getComponent("mail-plugin"));
    if (mailPlugin) {
        mailPlugin.registerTemplate(chatListElementTemplate);
    }
    
}, "chat", "ethernal");

Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.message.MessageWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.message.MessageWindowView") {
        event.instance.registerCustomButton({
            icon: "ico-comment",
            labelKey: "plugin.chat.window.message.header.button.chat.label",
            action: "open-chat",
            visible: (sinkIndexEntry: Mail.mail.SinkIndexEntry, sinkType: string) => {
                return sinkType != "form" && sinkIndexEntry.getMessage().sender.user != "anonymous";
            }
        });
    }
}, "chat", "ethernal");

Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.sectionsummary.SectionSummaryWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowView") {
        let chat = new ChatMessagesView(event.instance, event.instance.personsComponent);
        chat.$container = Web.JQuery('<div class="chat-messages-component"></div>');
        event.instance.registerModule("chat", chat);
    }
}, "chat", "ethernal");