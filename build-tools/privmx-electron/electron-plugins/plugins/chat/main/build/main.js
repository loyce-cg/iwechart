"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var ChatWindowController_1 = require("../window/chat/ChatWindowController");
var ChatMessage_1 = require("../main/ChatMessage");
var ChatPlugin_1 = require("../main/ChatPlugin");
var ChatMessagesController_1 = require("../component/chatmessages/ChatMessagesController");
var PrivateConversationsController_1 = require("../component/privateconversations/PrivateConversationsController");
var VideoConferenceController_1 = require("../component/videoconference/VideoConferenceController");
var VideoConferenceWindowController_1 = require("../window/videoConference/VideoConferenceWindowController");
var NoSectionsController_1 = require("../component/nosections/NoSectionsController");
var DesktopPickerController_1 = require("../component/desktoppicker/DesktopPickerController");
var ConnectionStatsTooltipController_1 = require("../component/connectionstatstooltip/ConnectionStatsTooltipController");
var Logger = Mail.Logger.get("privfs-chat-plugin.Plugin");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (_mail, app) {
        var chatPlugin = app.addComponent("chat-plugin", new ChatPlugin_1.ChatPlugin(app));
        chatPlugin.registerTexts(app.localeService);
        ChatMessagesController_1.ChatMessagesController.registerTexts(app.localeService);
        PrivateConversationsController_1.PrivateConversationsController.registerTexts(app.localeService);
        VideoConferenceController_1.VideoConferenceController.registerTexts(app.localeService);
        NoSectionsController_1.NoSectionsController.registerTexts(app.localeService);
        DesktopPickerController_1.DesktopPickerController.registerTexts(app.localeService);
        ConnectionStatsTooltipController_1.ConnectionStatsTooltipController.registerTexts(app.localeService);
        ChatWindowController_1.ChatWindowController.registerTexts(app.localeService);
        VideoConferenceWindowController_1.VideoConferenceWindowController.registerTexts(app.localeService);
        app.ioc.registerComponent("chatmessages", ChatMessagesController_1.ChatMessagesController);
        app.ioc.registerComponent("privateconversations", PrivateConversationsController_1.PrivateConversationsController);
        app.ioc.registerComponent("videoconference", VideoConferenceController_1.VideoConferenceController);
        app.ioc.registerComponent("nosections", NoSectionsController_1.NoSectionsController);
        app.ioc.registerComponent("desktoppicker", DesktopPickerController_1.DesktopPickerController);
        app.ioc.registerComponent("connectionstatstooltip", ConnectionStatsTooltipController_1.ConnectionStatsTooltipController);
        app.localeService.sinkPollingTasks.push(app.localeService.i18n("plugin.chat.app.task.sinkPolling.chats"));
        app.options.notifications.value.push({
            userPreferencesKey: "chats",
            defaultValue: true,
            tags: function () {
                return [Mail.mail.MessageTagsFactory.getMessageTypeTag(Mail.mail.section.ChatModuleService.CHAT_MESSAGE_TYPE)];
            },
            i18nKey: "plugin.chat.window.settings.section.notifications.chats.label"
        });
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({ path: "window/component/chatmessages/template/main.css", plugin: "chat" });
                event.instance.addViewScript({ path: "build/view.js", plugin: "chat" });
                app.ioc.create(ChatMessagesController_1.ChatMessagesController, [event.instance, event.instance.personsComponent]).then(function (ele) {
                    event.instance.registerModule("chat", ele);
                });
            }
        }, "chat", "ethernal");
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.settings.whitelist.WhitelistController") {
                event.instance.addMessageInfoGetter(function (indexEntry) {
                    return ChatMessage_1.ChatMessage.isChatMessage(indexEntry) ? {
                        special: true,
                        title: app.localeService.i18n("plugin.chat.window.settings.section.whitelist.table.lastMessage.chatMsg")
                    } : null;
                });
            }
        }, "chat", "ethernal");
        app.addEventListener("grantaccesstoshareddb", function (event) {
            if (!app.isLogged()) {
                return;
            }
            chatPlugin.loadChannels().fail(function (e) {
                Logger.error("Error during loading channels", e);
            });
        }, "chat", "ethernal");
        app.addEventListener("mailstats", function (event) {
            chatPlugin.refreshChatUnreadCount(event.mailStats);
        }, "chat", "ethernal");
        app.addEventListener("sinkindexmanagerready", function (event) {
            event.result = chatPlugin.loadChannels().fail(function (e) {
                Logger.error("Error during loading channels", e);
            });
        }, "chat", "ethernal");
        app.addEventListener("afterlogin", function () {
            chatPlugin.onLogin().fail(function (e) {
                Logger.error("Error after login", e);
            });
            app.addCountModel(chatPlugin.chatUnreadCountModel);
            var cnt = app.windows.container;
            var entry = cnt.registerAppWindow({
                id: "chat",
                label: app.localeService.i18n("plugin.chat.component.navbar.menu.chat.label"),
                icon: "privmx-icon-chat",
                controllerClass: ChatWindowController_1.ChatWindowController,
                count: chatPlugin.chatUnreadCountModel,
                countFullyLoaded: chatPlugin.chatUnreadCountFullyLoadedModel,
                historyPath: "/chat"
            });
            cnt.initApp = entry.id;
            Mail.Q().then(function () {
                return app.mailClientApi.checkLoginCore();
            })
                .then(function () {
                app.eventDispatcher.dispatchEvent({ type: "plugin-module-ready", name: Mail.Types.section.NotificationModule.CHAT });
            })
                .fail(function (e) {
                Logger.error("Error during additional login steps", e);
            });
        }, "chat", "ethernal");
        app.addEventListener("focusChanged", function (event) {
            chatPlugin.activeWindowFocused = event.windowId;
        }, "chat", "ethernal");
        app.addEventListener("pluginsloaded", function () {
            var mailPlugin = app.getComponent("mail-plugin");
            if (mailPlugin) {
                chatPlugin.mailPlugin = mailPlugin;
                mailPlugin.eventDispatcher.addEventListener("select", function (event) {
                    if (event.entryType == "chat") {
                        var cnt = app.windows.container;
                        cnt.redirectToAppWindow("chat", Mail.app.common.Context.create({
                            contextType: "section",
                            contextId: event.entryId,
                            moduleName: Mail.Types.section.NotificationModule.CHAT,
                            hostHash: app.sessionManager.getLocalSession().hostHash,
                        }));
                    }
                });
                mailPlugin.addViewScript({ path: "build/view.js", plugin: "chat" });
                mailPlugin.addViewStyle({ path: "window/mail/template/main.css", plugin: "chat" });
            }
            chatPlugin.notes2PluginPresent = app.getComponent("notes2-plugin") != null;
            chatPlugin.tasksPluginPresent = app.getComponent("tasks-plugin") != null;
        }, "chat", "ethernal");
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.message.MessageWindowController") {
                var messageController_1 = event.instance;
                messageController_1.onCustomAction(function (event) {
                    if (event.actionType == "open-chat" && messageController_1.indexEntry != null && chatPlugin.conversationService) {
                        var container = app.windows.container;
                        container.redirectToAppWindow("chat", Mail.app.common.Context.create({
                            contextType: "conversation",
                            contextId: chatPlugin.conversationService.getConversationId(messageController_1.indexEntry),
                            moduleName: Mail.Types.section.NotificationModule.CHAT,
                            hostHash: app.sessionManager.getLocalSession().hostHash,
                        }));
                    }
                });
                messageController_1.addViewScript({ path: "build/view.js", plugin: "chat" });
            }
        }, "chat", "ethernal");
        app.addEventListener("beforelogout", function () {
            chatPlugin.reset();
        }, "chat", "ethernal");
        app.addEventListener("afterlogout", function () {
        }, "chat", "ethernal");
        app.addEventListener("sinkpollingresult", function (event) {
            chatPlugin.onPollingResult(event.entries);
        }, "chat", "ethernal");
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.chat.build.Plugin";

//# sourceMappingURL=main.js.map
