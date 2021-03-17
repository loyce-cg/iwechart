import { CommonApplication } from "../common/CommonApplication";
import { LocaleService } from "../../mail/LocaleService";

export class ContextMenuHelper {
    localeService: LocaleService;
    constructor(app: CommonApplication) {
        this.localeService = app.localeService;
    }

    getMenuTemplate(type: string = "context", closeAccelerator?: string): Electron.MenuItemConstructorOptions[] {
        if (type == "context") {
            return [
                {
                    label: this.localeService.i18n("app.contextmenu.undo"),
                    accelerator: 'CmdOrCtrl+Z',
                    role: 'undo'
                },
                {
                    label: this.localeService.i18n("app.contextmenu.redo"),
                    accelerator: 'CmdOrCtrl+Y',
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    label: this.localeService.i18n("app.contextmenu.cut"),
                    accelerator: 'CmdOrCtrl+X',
                    // role: 'cut',
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.emit("privmx-cut");
                    },
                },
                {
                    label: this.localeService.i18n("app.contextmenu.copy"),
                    accelerator: 'CmdOrCtrl+C',
                    // role: 'copy',
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.emit("privmx-copy");
                    },
                },
                {
                    label: this.localeService.i18n("app.contextmenu.paste"),
                    accelerator: 'CmdOrCtrl+V',
                    // role: 'paste',
                    click: (menuItem, browserWindow, event) => {
                        browserWindow.emit("privmx-paste");
                    },
                },
                {
                    type: 'separator'
                },
                {
                    label: this.localeService.i18n("app.contextmenu.select_all"),
                    accelerator: 'CmdOrCtrl+A',
                    role: 'selectAll'
                },
            ]
        }

        if (type == "empty") {
            return []
        }

        if (type == "extraClose") {
            return [
                {
                    label: this.localeService.i18n("core.button.close.label"),
                    accelerator: closeAccelerator,
                    role: 'close'
                }
            ]

        }

        if (type == "mac-osx-main-menu") {
            return [
                {
                    label: "PrivMX",
                    submenu: [
                        {
                            label: this.localeService.i18n("core.button.close.label"),
                            role: "close"
                        },
                        {
                            label: this.localeService.i18n("app.try.menu.exit"),
                            role: "quit"
                        }
                    ]
                },
                {
                    label: this.localeService.i18n("core.button.edit.label"),
                    submenu: [
                        {
                            label: this.localeService.i18n("app.contextmenu.undo"),
                            role: 'undo'
                        },
                        {
                            label: this.localeService.i18n("app.contextmenu.redo"),
                            role: 'redo'
                        },
                        {
                            type: 'separator'
                        },
                        {
                            label: this.localeService.i18n("app.contextmenu.copy"),
                            // role: 'copy',
                            accelerator: 'CmdOrCtrl+C',
                            click: (menuItem, browserWindow, event) => {
                                browserWindow.emit("privmx-copy");
                            },
                        },
                        {
                            label: this.localeService.i18n("app.contextmenu.cut"),
                            // role: 'cut',
                            accelerator: 'CmdOrCtrl+X',
                            click: (menuItem, browserWindow, event) => {
                                browserWindow.emit("privmx-cut");
                            },
                        },
                        {
                            label: this.localeService.i18n("app.contextmenu.paste"),
                            // role: 'paste',
                            accelerator: 'CmdOrCtrl+V',
                            click: (menuItem, browserWindow, event) => {
                                browserWindow.emit("privmx-paste");
                            },
                        },
                        {
                            type: 'separator'
                        },
                        {
                            label: this.localeService.i18n("app.contextmenu.select_all"),
                            role: 'selectAll'
                        }

                    ]
                },
                
            ]

        }


    }
    
}