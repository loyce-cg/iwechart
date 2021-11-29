"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var Notes2Plugin_1 = require("../main/Notes2Plugin");
var Notes2WindowController_1 = require("../window/notes2/Notes2WindowController");
var NewNoteWindowController_1 = require("../window/newnote/NewNoteWindowController");
var Q = Mail.Q;
var FilesListController_1 = require("../component/fileslist/FilesListController");
var Common_1 = require("../main/Common");
var FileChooserWindowController_1 = require("../window/filechooser/FileChooserWindowController");
var FileConflictResolverWindowController_1 = require("../window/fileconflictresolver/FileConflictResolverWindowController");
var FileErrorWindowController_1 = require("../window/fileerror/FileErrorWindowController");
var HistoryWindowController_1 = require("../window/history/HistoryWindowController");
var RecentFilesWindowController_1 = require("../window/recentfiles/RecentFilesWindowController");
var FilesImporterWindowController_1 = require("../window/filesimporter/FilesImporterWindowController");
var Logger = Mail.Logger.get("privfs-notes2-plugin.Plugin");
var Plugin = (function () {
    function Plugin() {
    }
    Plugin.prototype.register = function (_mail, app) {
        var notes2Plugin = app.addComponent("notes2-plugin", new Notes2Plugin_1.Notes2Plugin(app));
        notes2Plugin.registerTexts(app.localeService);
        FilesListController_1.FilesListController.registerTexts(app.localeService);
        FileChooserWindowController_1.FileChooserWindowController.registerTexts(app.localeService);
        FileConflictResolverWindowController_1.FileConflictResolverWindowController.registerTexts(app.localeService);
        FileErrorWindowController_1.FileErrorWindowController.registerTexts(app.localeService);
        HistoryWindowController_1.HistoryWindowController.registerTexts(app.localeService);
        NewNoteWindowController_1.NewNoteWindowController.registerTexts(app.localeService);
        Notes2WindowController_1.Notes2WindowController.registerTexts(app.localeService);
        RecentFilesWindowController_1.RecentFilesWindowController.registerTexts(app.localeService);
        FilesImporterWindowController_1.FilesImporterWindowController.registerTexts(app.localeService);
        app.ioc.registerComponent("notes2filelist", FilesListController_1.FilesListController);
        app.addEventListener("instanceregistered", function (event) {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({ path: "window/component/fileslist/template/main.css", plugin: "notes2" });
                event.instance.addViewScript({ path: "build/view.js", plugin: "notes2" });
                app.ioc.create(FilesListController_1.FilesListController, [event.instance, event.instance.personsComponent]).then(function (ele) {
                    ele.context = Common_1.ViewContext.SummaryWindow;
                    event.instance.registerModule("notes2", ele);
                });
            }
        }, "notes2", "ethernal");
        app.addEventListener("fileRenamed", function (event) {
            if (event.isLocal) {
                notes2Plugin.recentService.onLocalFileRenamed(event.oldPath, event.newPath);
            }
            else {
                var hostHash = event.hostHash || app.sessionManager.getLocalSession().hostHash;
                if (hostHash == app.sessionManager.getLocalSession().hostHash) {
                    notes2Plugin.recentService.onFileRenamed(event.did, event.oldPath, event.newPath);
                }
            }
        });
        app.addEventListener("afterlogin", function (_event) {
            notes2Plugin.reset();
            app.addCountModel(notes2Plugin.filesUnreadCountModel);
            var cnt = app.windows.container;
            var entry = cnt.registerAppWindow({
                id: "notes2",
                label: app.localeService.i18n("plugin.notes2.app.navbar.menu.label"),
                icon: "privmx-icon-notes2",
                controllerClass: Notes2WindowController_1.Notes2WindowController,
                historyPath: "/notes2",
                count: notes2Plugin.filesUnreadCountModel,
                countFullyLoaded: notes2Plugin.filesUnreadCountFullyLoadedModel,
            });
            cnt.initApp = entry.id;
            Q().then(function () {
                return app.mailClientApi.loadUserPreferences();
            });
        }, "notes2", "ethernal");
        app.addEventListener("open-history-view", function (event) {
            notes2Plugin.openHistory(event);
        }, "notes2", "ethernal");
        if (app.isElectronApp()) {
            app.addEventListener("customaction", function (event) {
                if (event.actionType == "open-last-file") {
                    notes2Plugin.recentService.openLastFileFromRecent(app.sessionManager.getLocalSession());
                }
            }, "notes2", "ethernal");
            var recentFilesMenu = {
                id: "recentFiles",
                menuId: "loggedIn",
                order: 25,
                onLanguageChange: function () { return app.localeService.i18n("plugin.notes2.app.tray.recentfiles"); },
                shortcutId: "global.recentFiles",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.recentfiles"),
                    type: "normal",
                    click: function () {
                        notes2Plugin.openRecent().then(function (result) {
                            return notes2Plugin.recentService.getRecentFileToOpen(result.id, result.did).then(function (element) {
                                if (element) {
                                    var action = result.action || Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL;
                                    app.shellRegistry.shellOpen({
                                        action: action,
                                        element: element,
                                        session: app.sessionManager.getLocalSession(),
                                    });
                                }
                                else {
                                    notes2Plugin.recentService.removeRecentOpenedFile(result.id, result.did).then(function () {
                                        if (notes2Plugin.recentFilesWindowController) {
                                            notes2Plugin.recentFilesWindowController.loadRecentFilesList();
                                        }
                                    });
                                    app.msgBox.alert(app.localeService.i18n("plugin.notes2.fileDoesNotExist"));
                                }
                            });
                        });
                    }
                }
            };
            app.trayMenu.registerMenuItem(recentFilesMenu);
            var newTextNoteTrayMenuItem = {
                id: "newTextNote",
                menuId: "loggedIn",
                order: 21,
                onLanguageChange: function () { return app.localeService.i18n("plugin.notes2.app.tray.newTextNote"); },
                shortcutId: "global.newTextNote",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.newTextNote"),
                    type: "normal",
                    click: function () {
                        notes2Plugin.openNewTextNoteWindow(app.sessionManager.getLocalSession());
                    }
                }
            };
            app.trayMenu.registerMenuItem(newTextNoteTrayMenuItem);
            var newMindmapTrayMenuItem = {
                id: "newMindmap",
                menuId: "loggedIn",
                order: 21,
                onLanguageChange: function () { return app.localeService.i18n("plugin.notes2.app.tray.newMindmap"); },
                shortcutId: "global.newMindmap",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.newMindmap"),
                    type: "normal",
                    click: function () {
                        notes2Plugin.openNewMindmapWindow(app.sessionManager.getLocalSession());
                    }
                }
            };
            app.trayMenu.registerMenuItem(newMindmapTrayMenuItem);
            var screenshotMenuItem = {
                id: "takeScreenshot",
                menuId: "loggedIn",
                order: 30,
                onLanguageChange: function () { return app.localeService.i18n("plugin.notes2.app.tray.takeScreenshot"); },
                shortcutId: "global.takeScreenshot",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.takeScreenshot"),
                    type: "normal",
                    click: function () {
                        app.screenCapture();
                    }
                }
            };
            app.trayMenu.registerMenuItem(screenshotMenuItem);
        }
        app.addEventListener("sinkindexmanagerready", function () {
            notes2Plugin.load().fail(function (e) {
                Logger.error("Error during loading channels", e);
            });
        }, "notes2", "ethernal");
        app.addEventListener("afterlogout", function (_event) {
            notes2Plugin.reset();
        }, "notes2", "ethernal");
        app.addEventListener("file-opened", function (event) {
            var session = app.sessionManager.getSessionByHostHash(event.hostHash);
            if (event.hostHash = app.sessionManager.getLocalSession().hostHash) {
                notes2Plugin.recentService.addRecentOpenedFile(event).then(function () {
                    if (notes2Plugin.recentFilesWindowController) {
                        return notes2Plugin.recentFilesWindowController.loadRecentFilesList();
                    }
                });
            }
            if (event.element instanceof Mail.mail.section.OpenableSectionFile) {
                notes2Plugin.markFileAsWatchedById(session, event.element.getElementId(), event.element.section.getId());
            }
        }, "notes2", "ethernal");
        app.addEventListener("sinkpollingresult", function (event) {
            notes2Plugin.onPollingResult(event.entries);
        }, "notes2", "ethernal");
    };
    return Plugin;
}());
exports.Plugin = Plugin;
Plugin.prototype.className = "com.privmx.plugin.notes2.build.Plugin";

//# sourceMappingURL=main.js.map
