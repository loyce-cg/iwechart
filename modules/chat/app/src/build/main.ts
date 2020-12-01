import * as Mail from "pmc-mail";
import {ChatWindowController} from "../window/chat/ChatWindowController";
import {ChatMessage} from "../main/ChatMessage";
import {ChatPlugin, MailPlugin, MailPluginActionEvent} from "../main/ChatPlugin";
import { ChatMessagesController } from "../component/chatmessages/ChatMessagesController";
import { PrivateConversationsController } from "../component/privateconversations/PrivateConversationsController";
import { NoSectionsController } from "../component/nosections/NoSectionsController";

let Logger = Mail.Logger.get("privfs-chat-plugin.Plugin");

export class Plugin {
    register(_mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let chatPlugin = app.addComponent("chat-plugin", new ChatPlugin(app));
        
        // i18n: main
        chatPlugin.registerTexts(app.localeService);
        
        // i18n: components
        ChatMessagesController.registerTexts(app.localeService);
        PrivateConversationsController.registerTexts(app.localeService);
        NoSectionsController.registerTexts(app.localeService);
        
        // i18n: windows
        ChatWindowController.registerTexts(app.localeService);
        
        app.ioc.registerComponent("chatmessages", ChatMessagesController);
        app.ioc.registerComponent("privateconversations", PrivateConversationsController);
        app.ioc.registerComponent("nosections", NoSectionsController);

        app.localeService.sinkPollingTasks.push(app.localeService.i18n("plugin.chat.app.task.sinkPolling.chats"));
        
        app.options.notifications.value.push({
            userPreferencesKey: "chats",
            defaultValue: true,
            tags: () => {
                return [Mail.mail.MessageTagsFactory.getMessageTypeTag(Mail.mail.section.ChatModuleService.CHAT_MESSAGE_TYPE)];
            },
            i18nKey: "plugin.chat.window.settings.section.notifications.chats.label"
        });
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.sectionsummary.SectionSummaryWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({path: "window/component/chatmessages/template/main.css", plugin: "chat"});
                event.instance.addViewScript({path: "build/view.js", plugin: "chat"});
                app.ioc.create(ChatMessagesController, [event.instance, event.instance.personsComponent]).then(ele => {
                    event.instance.registerModule("chat", ele);
                });
            }
        }, "chat", "ethernal");
                
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.settings.whitelist.WhitelistController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.settings.whitelist.WhitelistController") {
                event.instance.addMessageInfoGetter(indexEntry => {
                    return ChatMessage.isChatMessage(indexEntry) ? {
                        special: true,
                        title: app.localeService.i18n("plugin.chat.window.settings.section.whitelist.table.lastMessage.chatMsg")
                    } : null;
                });
            }
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.GrantAccessToSharedDbEvent>("grantaccesstoshareddb", (event) => {
            // jezeli user nie jest zalogowany to znaczy, ze event zostal wygenerowany w trakcie procesu rejestracji team keepera,
            // a w takim momencie proba ladowania sekcji zakonczy sie zawieszonym promisem.. co pozniej bedzie widoczne, jako niekonczaca sie kreciolka
            // na ekranie kafli po pierwszym zalogowaniu uzytkownika
            if (! app.isLogged()) {
                return;
            }
            chatPlugin.loadChannels().fail(e => {
                Logger.error("Error during loading channels", e);
            });
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.MailStatsEvent>("mailstats", event => {
            chatPlugin.refreshChatUnreadCount(event.mailStats);
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.SinkIndexManagerReady>("sinkindexmanagerready", event => {
            event.result = chatPlugin.loadChannels().fail(e => {
                Logger.error("Error during loading channels", e);
            });
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.AfterLoginEvent>("afterlogin", () => {
            chatPlugin.onLogin().fail(e => {
                Logger.error("Error after login", e);
            });
            app.addCountModel(chatPlugin.chatUnreadCountModel);
            let cnt = <Mail.window.container.ContainerWindowController>app.windows.container;
            let entry = cnt.registerAppWindow({
                id: "chat",
                label: app.localeService.i18n("plugin.chat.component.navbar.menu.chat.label"),
                icon: "privmx-icon-chat",
                controllerClass: ChatWindowController,
                count: chatPlugin.chatUnreadCountModel,
                countFullyLoaded: chatPlugin.chatUnreadCountFullyLoadedModel,
                historyPath: "/chat"
            });
            cnt.initApp = entry.id;
            Mail.Q().then(() => {
                return app.mailClientApi.checkLoginCore();
            })
            .fail(e => {
                Logger.error("Error during additional login steps", e);
            });
        }, "chat", "ethernal");
        
        app.addEventListener<{type: "focusChanged", target: any, windowId: string}>("focusChanged", event => {
            chatPlugin.activeWindowFocused = event.windowId;
        }, "chat", "ethernal")
        
        app.addEventListener<Mail.Types.event.PluginLoadedEvent>("pluginsloaded", () => {
            let mailPlugin = app.getComponent<MailPlugin>("mail-plugin");
            if (mailPlugin) {
                chatPlugin.mailPlugin = mailPlugin;
                mailPlugin.eventDispatcher.addEventListener<MailPluginActionEvent>("select", event => {
                    if (event.entryType == "chat") {
                        let cnt = <Mail.window.container.ContainerWindowController>app.windows.container;
                        cnt.redirectToAppWindow("chat", event.entryId);
                    }
                });
                mailPlugin.addViewScript({path: "build/view.js", plugin: "chat"});
                mailPlugin.addViewStyle({path: "window/mail/template/main.css", plugin: "chat"});
            }
            chatPlugin.notes2PluginPresent = app.getComponent("notes2-plugin") != null;
            chatPlugin.tasksPluginPresent = app.getComponent("tasks-plugin") != null;
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.message.MessageWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.message.MessageWindowController") {
                let messageController = event.instance;
                messageController.onCustomAction(event => {
                    if (event.actionType == "open-chat" && messageController.indexEntry != null && chatPlugin.conversationService) {
                        let container = <Mail.window.container.ContainerWindowController>app.windows.container;
                        container.redirectToAppWindow("chat", chatPlugin.conversationService.getConversationId(messageController.indexEntry));
                    }
                });
                messageController.addViewScript({path: "build/view.js", plugin: "chat"});
            }
        }, "chat", "ethernal");

        app.addEventListener<Mail.Types.event.BeforeLogoutPlugin>("beforelogout", () => {
            chatPlugin.reset();
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.AfterLogoutPlugin>("afterlogout", () => {
            // chatPlugin.reset();
        }, "chat", "ethernal");
        
        app.addEventListener<Mail.Types.event.SinkPollingResultEvent>("sinkpollingresult", event => {
            chatPlugin.onPollingResult(event.entries);
        }, "chat", "ethernal");
    }
}