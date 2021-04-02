import * as Mail from "pmc-mail";
import * as privfs from "privfs-client";
import {Notes2Plugin} from "../main/Notes2Plugin";
import {Notes2WindowController} from "../window/notes2/Notes2WindowController";
import {NewNoteWindowController} from "../window/newnote/NewNoteWindowController";
import Q = Mail.Q;
import { FilesListController } from "../component/fileslist/FilesListController";
import { ViewContext } from "../main/Common";
import { FileChooserWindowController } from "../window/filechooser/FileChooserWindowController";
import { FileConflictResolverWindowController } from "../window/fileconflictresolver/FileConflictResolverWindowController";
import { FileErrorWindowController } from "../window/fileerror/FileErrorWindowController";
import { HistoryWindowController } from "../window/history/HistoryWindowController";
import { RecentFilesWindowController } from "../window/recentfiles/RecentFilesWindowController";
import { FilesImporterWindowController } from "../window/filesimporter/FilesImporterWindowController";

let Logger = Mail.Logger.get("privfs-notes2-plugin.Plugin");

export class Plugin {
    
    register(_mail: typeof Mail, app: Mail.app.common.CommonApplication) {
        let notes2Plugin = app.addComponent("notes2-plugin", new Notes2Plugin(app));
        // i18n: main
        notes2Plugin.registerTexts(app.localeService);
        
        // i18n: components
        FilesListController.registerTexts(app.localeService);
        
        // i18n: windows
        FileChooserWindowController.registerTexts(app.localeService);
        FileConflictResolverWindowController.registerTexts(app.localeService);
        FileErrorWindowController.registerTexts(app.localeService);
        HistoryWindowController.registerTexts(app.localeService);
        NewNoteWindowController.registerTexts(app.localeService);
        Notes2WindowController.registerTexts(app.localeService);
        RecentFilesWindowController.registerTexts(app.localeService);
        FilesImporterWindowController.registerTexts(app.localeService);
        
        app.ioc.registerComponent("notes2filelist", FilesListController);
        
        app.addEventListener<Mail.Types.event.InstanceRegisteredEvent<Mail.window.sectionsummary.SectionSummaryWindowController>>("instanceregistered", event => {
            if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowController") {
                event.instance.addViewStyle({path: "window/component/fileslist/template/main.css", plugin: "notes2"});
                event.instance.addViewScript({path: "build/view.js", plugin: "notes2"});
                app.ioc.create(FilesListController, [event.instance, event.instance.personsComponent]).then(ele => {
                    ele.context = ViewContext.SummaryWindow;
                    event.instance.registerModule("notes2", ele);
                });
            }
        }, "notes2", "ethernal");
        
        app.addEventListener<Mail.Types.event.FileRenamedEvent>("fileRenamed", event => {
            if (event.isLocal) {
                notes2Plugin.recentService.onLocalFileRenamed(event.oldPath, event.newPath);
            }
            else {
                let hostHash = event.hostHash || app.sessionManager.getLocalSession().hostHash;
                if (hostHash == app.sessionManager.getLocalSession().hostHash) {
                    notes2Plugin.recentService.onFileRenamed(event.did, event.oldPath, event.newPath);
                }
            }
        });
            
        app.addEventListener<Mail.Types.event.AfterLoginEvent>("afterlogin", _event => {
            notes2Plugin.reset();
            app.addCountModel(notes2Plugin.filesUnreadCountModel);
            let cnt = <Mail.window.container.ContainerWindowController>app.windows.container;
            let entry = cnt.registerAppWindow({
                id: "notes2",
                label: app.localeService.i18n("plugin.notes2.app.navbar.menu.label"),
                icon: "privmx-icon-notes2",
                controllerClass: Notes2WindowController,
                historyPath: "/notes2",
                count: notes2Plugin.filesUnreadCountModel,
                countFullyLoaded: notes2Plugin.filesUnreadCountFullyLoadedModel,
            });
            cnt.initApp = entry.id;
            
            Q().then(() => {
                return app.mailClientApi.loadUserPreferences()
            });
        }, "notes2", "ethernal");
        
        app.addEventListener<Mail.Types.event.OpenHistoryViewEvent>("open-history-view", event => {
            notes2Plugin.openHistory(event);
        }, "notes2", "ethernal");
        
        if (app.isElectronApp()) {
            app.addEventListener("customaction", (event: Mail.Types.event.CustomActionEvent) => {
                if (event.actionType == "open-last-file") {
                    
                    notes2Plugin.recentService.openLastFileFromRecent(app.sessionManager.getLocalSession());
                }
            }, "notes2", "ethernal");
            let recentFilesMenu: Mail.app.electronTray.TrayMenuItem = {
                id: "recentFiles",
                menuId: "loggedIn",
                order: 25,
                onLanguageChange: () => app.localeService.i18n("plugin.notes2.app.tray.recentfiles"),
                shortcutId: "global.recentFiles",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.recentfiles"),
                    type: "normal",
                    click: () => {
                        notes2Plugin.openRecent().then(result => {
                            return notes2Plugin.recentService.getRecentFileToOpen(result.id, result.did).then(element => {
                                if (element) {
                                    let action = result.action || Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL;
                                    app.shellRegistry.shellOpen({
                                        action: action,
                                        element: element,
                                        session: app.sessionManager.getLocalSession(),
                                    });
                                }
                                else {
                                    notes2Plugin.recentService.removeRecentOpenedFile(result.id, result.did).then(() => {
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
            (<any>app).trayMenu.registerMenuItem(recentFilesMenu);
            
            // let trayMenuItem: Mail.app.electronTray.TrayMenuItem = {
            //     id: "newNote",
            //     menuId: "loggedIn",
            //     order: 20,
            //     onLanguageChange: () => app.localeService.i18n("plugin.notes2.app.tray.newNote"),
            //     shortcutId: "global.newFile",
            //     options: {
            //         label: app.localeService.i18n("plugin.notes2.app.tray.newNote"),
            //         type: "normal",
            //         click: () => {
            //             app.ioc.create(NewNoteWindowController, [app]).then(win => {
            //                 win.openWindowOptions.modal = false;
            //                 app.openSingletonWindow("new-note-window-from-tray-menu", win);
            //                 win.getResult().then(result => {
            //                     notes2Plugin.sectionManager.uploadFile({
            //                         data: result.content,
            //                         destination: result.destination,
            //                         path: "/"
            //                     })
            //                     .then(result => {
            //                         app.shellRegistry.shellOpen({
            //                             action: Mail.app.common.shelltypes.ShellOpenAction.EXTERNAL,
            //                             element: result.openableElement
            //                         });
            //                     })
            //                     .fail(e => {
            //                         Logger.error("Error during creating note", e);
            //                     });
            //                 });
            //             });
            //         }
            //     }
            // };
            // (<any>app).trayMenu.registerMenuItem(trayMenuItem);
            
            let newTextNoteTrayMenuItem: Mail.app.electronTray.TrayMenuItem = {
                id: "newTextNote",
                menuId: "loggedIn",
                order: 21,
                onLanguageChange: () => app.localeService.i18n("plugin.notes2.app.tray.newTextNote"),
                shortcutId: "global.newTextNote",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.newTextNote"),
                    type: "normal",
                    click: () => {
                        notes2Plugin.openNewTextNoteWindow(app.sessionManager.getLocalSession());
                    }
                }
            };
            (<any>app).trayMenu.registerMenuItem(newTextNoteTrayMenuItem);
            
            let newMindmapTrayMenuItem: Mail.app.electronTray.TrayMenuItem = {
                id: "newMindmap",
                menuId: "loggedIn",
                order: 21,
                onLanguageChange: () => app.localeService.i18n("plugin.notes2.app.tray.newMindmap"),
                shortcutId: "global.newMindmap",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.newMindmap"),
                    type: "normal",
                    click: () => {
                        notes2Plugin.openNewMindmapWindow(app.sessionManager.getLocalSession());
                    }
                }
            };
            (<any>app).trayMenu.registerMenuItem(newMindmapTrayMenuItem);
            
            let screenshotMenuItem: Mail.app.electronTray.TrayMenuItem = {
                id: "takeScreenshot",
                menuId: "loggedIn",
                order: 30,
                onLanguageChange: () => app.localeService.i18n("plugin.notes2.app.tray.takeScreenshot"),
                shortcutId: "global.takeScreenshot",
                options: {
                    label: app.localeService.i18n("plugin.notes2.app.tray.takeScreenshot"),
                    type: "normal",
                    click: () => {
                        app.screenCapture()
                    }
                }
            };
            (<any>app).trayMenu.registerMenuItem(screenshotMenuItem);
        }
        
        app.addEventListener<Mail.Types.event.SinkIndexManagerReady>("sinkindexmanagerready", () => {
            notes2Plugin.load().fail(e => {
                Logger.error("Error during loading channels", e);
            });
        }, "notes2", "ethernal");
        
        app.addEventListener<Mail.Types.event.AfterLogoutPlugin>("afterlogout", _event => {
            notes2Plugin.reset();
        }, "notes2", "ethernal");
        
        app.addEventListener<Mail.Types.event.FileOpenedEvent>("file-opened", event => {
            let session = app.sessionManager.getSessionByHostHash(event.hostHash);
            if (event.hostHash = app.sessionManager.getLocalSession().hostHash) {
                notes2Plugin.recentService.addRecentOpenedFile(event).then(() => {
                    if (notes2Plugin.recentFilesWindowController) {
                        return notes2Plugin.recentFilesWindowController.loadRecentFilesList();
                    }
                });
            }
            if (event.element instanceof Mail.mail.section.OpenableSectionFile) {
                notes2Plugin.markFileAsWatchedById(session, event.element.getElementId(), event.element.section.getId());
            }
        }, "notes2", "ethernal");
        
        app.addEventListener<Mail.Types.event.SinkPollingResultEvent>("sinkpollingresult", event => {
            notes2Plugin.onPollingResult(event.entries);
        }, "notes2", "ethernal");
        
    }
}
