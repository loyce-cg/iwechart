import path = require("path");
import * as RootLogger from "simplito-logger";
import { ElectronApplication } from "../ElectronApplication";
import {Map} from "../../../utils/Map";
import * as privfs from "privfs-client";
import { ElectronWindow } from "../window/ElectronWindow";
import { platform } from "os";
let Logger = RootLogger.get("privfs-mail-client.app.electron.traymenu.TrayMenu");

export interface TrayMenuItem {
    id: string,
    options: Electron.MenuItemConstructorOptions;
    onUpdate?: (options: Electron.MenuItemConstructorOptions) => Electron.MenuItemConstructorOptions;
    onLanguageChange?: () => string;
    order?: number;
    menuId?: string | string[];
    shortcutId?: string;
}

export class TrayMenu {

    static readonly APP_TRAY_ICON: string = "app-tray-icon.png";
    static readonly APP_TRAY_ICON_SYNC: string = "app-tray-icon-sync.png";
    static readonly APP_TRAY_ICON_NO_INTERNET: string = "app-tray-icon-no-internet.png";
    static readonly APP_TRAY_ICON_SERVER_ERROR: string = "app-tray-icon-server-error.png";
    static readonly APP_TRAY_ICON_NOTIF: string = "app-tray-icon-notif.png";
    static readonly APP_TRAY_ICON_NOTIF_SYNC: string = "app-tray-icon-notif-sync.png";

    trayIcon: Electron.Tray;
    trayIconPath: string;
    trayIconSyncPath: string;
    notifTrayIconPath: string;
    notifTrayIconSyncPath: string;
    trayIconPathNoInternet: string;
    trayIconPathServerError: string;
    globalOnShowWindow: Function;
    menusMap: Map<TrayMenuItem[]>;
    activeMenuId: string;
    initialized: boolean = false;
    notificationVisible: boolean;
    noInternet: boolean;
    serverError: boolean;
    registeredMenusItems: Map<TrayMenuItem>;
    prevUnreadCount: number;
    currUnreadCount: number;
    syncing: boolean = false;
    lastIcon: string;
    descriptorSavesMap: {[id: string]: privfs.types.core.SPMEvent};
    stopSyncingTimeoutId: NodeJS.Timer;
    lastMainAppFocusLostTime: number;

    lastContextMenu: Electron.Menu;

    constructor(public app: ElectronApplication) {
        this.trayIconPath = path.resolve(this.app.getResourcesPath(), "dist/icons", TrayMenu.APP_TRAY_ICON);
        this.trayIconSyncPath = path.resolve(this.app.getResourcesPath(), "dist/icons", TrayMenu.APP_TRAY_ICON_SYNC);
        this.notifTrayIconPath = path.resolve(this.app.getResourcesPath(), "dist/icons", TrayMenu.APP_TRAY_ICON_NOTIF);
        this.notifTrayIconSyncPath = path.resolve(this.app.getResourcesPath(), "dist/icons", TrayMenu.APP_TRAY_ICON_NOTIF_SYNC);
        this.trayIconPathNoInternet = path.resolve(this.app.getResourcesPath(), "dist/icons", TrayMenu.APP_TRAY_ICON_NO_INTERNET);
        this.trayIconPathServerError = path.resolve(this.app.getResourcesPath(), "dist/icons", TrayMenu.APP_TRAY_ICON_SERVER_ERROR);

        this.trayIcon = app.createTrayIcon(this.getTrayNotificationIcon());
        this.menusMap = new Map();
        this.registeredMenusItems = new Map();
        this.prevUnreadCount = 0;
        this.currUnreadCount = 0;
        this.descriptorSavesMap = {};
        this.bindGlobalClicks();
    }

    bindGlobalClicks(): void {
        this.trayIcon.removeAllListeners();
        if (process.platform == "linux") {
            // this.refreshTrayMenu();
        }
        else {
            this.trayIcon.on("click", (event: Electron.KeyboardEvent, bounds: Electron.Rectangle, pos: Electron.Point) => {
                try {
                    if (process.platform == "win32") {

                        this.globalOnShowWindow();
                    }
                    else
                    if (process.platform == "darwin") {
                        this.lastContextMenu = this.getMenu();
                        if (this.lastContextMenu) {
                            this.trayIcon.popUpContextMenu(this.lastContextMenu);
                        }
                    }
                }
                catch (e) {}
            });
            this.trayIcon.on("right-click", (event) => {
                if (process.platform == "win32") {
                    if (this.lastMainAppFocusLostTime + 10 > new Date().getTime()) {
                        // windows hack naprawiajacy problem tracenia focusu przez glowne okno w momencie, jak klikamy na ikone w tray-u
                        // Rzecz w tym, ze focus jest tracony, zanim wywolamy menu i z tego powodu menu renderuje sie tak, jakby okno bylo czyms zasloniete
                        // Obejscie to sprawdzanie czasu ostatniej zmiany focusa i jezeli focus utracony zostal przez klik w menu (bardzo krotki odstep czasu)
                        // wtedy przywracamy focus oknu przy wyswietlaniu tray menu
                        Logger.debug("windows hack applied for tray menu");
                        this.app.onShowHideClick();
                    }    
                }     
                try {
                    this.lastContextMenu = this.getMenu();
                    if (this.lastContextMenu) {
                        this.trayIcon.popUpContextMenu(this.lastContextMenu);
                    }
                } catch(e) {}
            });
            this.trayIcon.on("double-click", (event) => {
                try {
                    this.globalOnShowWindow();
                }
                catch (e) {}
            });

        }
    }
    
    onLanguageChange(): void {
        this.menusMap.forEach( (menu, _key) => {
            menu.forEach( menuItem => {
                if (menuItem.onLanguageChange) {
                    menuItem.options.label = menuItem.onLanguageChange();
                }

            })
        });
    }

    onStorageEvent(event: privfs.types.core.SPMEvent): void {
        if (event.type != "descriptor-create" && event.type != "descriptor-update") {
            return;
        }
        if (event.action == "start") {
            this.descriptorSavesMap[event.id] = event;
        }
        else {
            delete this.descriptorSavesMap[event.id];
        }
        if (Object.keys(this.descriptorSavesMap).length == 0) {
            this.onAppSyncFinished();
        }
        else {
            this.onAppSyncing();
        }
    }

    onAppSyncing(): void {
        this.syncing = true;
        clearTimeout(this.stopSyncingTimeoutId);
        this.updateTrayNotification();
    }

    onAppSyncFinished(): void {
        this.stopSyncingTimeoutId = setTimeout(() => {
            this.syncing = false;
            this.updateTrayNotification();
        }, 200);
    }

    updateUnreadCount(unread: number) {
        this.prevUnreadCount = this.currUnreadCount;
        this.currUnreadCount = unread;
        this.setNotificationVisible(unread > 0);
    }

    setActive(id: string): void {
        this.updateMenu(id);
        this.activeMenuId = id;
        this.refreshTrayMenu();
    }

    /*
      ustawia stan permanentny do momentu recznego zresetowania
    */
    showNotificationDot() {
        this.setNotificationVisible(true);
    }

    setNotificationVisible(value: boolean = true) {
        this.notificationVisible = value;
        this.updateTrayNotification();
    }

    setNoInternet(value: boolean = true) {
        this.noInternet = value;
        this.updateTrayNotification();
    }

    setServerError(value: boolean = true) {
        this.serverError = value;
        this.updateTrayNotification();
    }

    refreshTrayMenu(): void {
        if (process.platform == "linux") {
            let options: Electron.MenuItemConstructorOptions[] = [];
            let menuItems = this.menusMap.get(this.activeMenuId);

            menuItems.forEach( menuItem => options.push(this.getElectronMenuOptions(menuItem)));
            let contextMenu = this.app.buildMenuFromTemplate(options);
            this.trayIcon.setContextMenu(contextMenu);
        }
    }

    getMenu(): Electron.Menu {
        let options: Electron.MenuItemConstructorOptions[] = [];
        let menuItems = this.menusMap.get(this.activeMenuId);

        menuItems.forEach( menuItem => options.push(this.getElectronMenuOptions(menuItem)));
        let contextMenu = this.app.buildMenuFromTemplate(options);
        return contextMenu;
    }
    
    getElectronMenuOptions(menuItem: TrayMenuItem): Electron.MenuItemConstructorOptions {
        let options: Electron.MenuItemConstructorOptions = {};
        for (let k in menuItem.options) {
            (<any>options)[k] = (<any>menuItem.options)[k];
        }
        if (menuItem.shortcutId) {
            let shortcut = this.app.keyboardShortcuts.find(menuItem.shortcutId);
            if (shortcut) {
                let accelerator = this.app.keyboardShortcuts.getAccelerator(shortcut);
                let labelExtra = this.app.keyboardShortcuts.getLabelExtra(shortcut);
                if (accelerator && this.app.keyboardShortcuts.useNativeAcceleratorOption()) {
                    options.accelerator = accelerator;
                    (<any>options).registerAccelerator = false;
                }
                if (labelExtra) {
                    options.label += labelExtra;
                }
            }
        }
        return options;
    }


    getAllItemsMatchMenu(menuId: string) {
        let matchedItems: TrayMenuItem[] = [];
        this.registeredMenusItems.forEach( menuItem => {
            if (menuItem.menuId === undefined || menuItem.menuId == menuId) {
                matchedItems.push(menuItem);
            }
            else
            if ((menuItem.menuId instanceof Array) && menuItem.menuId.indexOf(menuId) !== -1) {
                matchedItems.push(menuItem);
            }
        });
        return matchedItems;
    }

    registerMenu(id:string) {
        if (this.menusMap.has(id)) {
            return;
        }
        this.menusMap.put(id, []);
    }

    updateMenu(id: string) {
        if (! this.menusMap.has(id)) {
            return;
        }

        this.menusMap.map[id] = this.getAllItemsMatchMenu(id).sort((a,b) => {
            if (a.order == undefined ) {
                return b.order;
            } else
            if (b.order == undefined ) {
              return a.order;
            } else {
              return a.order - b.order;
            }
        })

        this.menusMap.forEach( (menu, _key) => {
            menu.forEach( menuItem => {
                if (menuItem.onUpdate) {
                    menuItem.options = menuItem.onUpdate(menuItem.options);
                }

            })
        });
    }

    getRegisteredItemAction(id: string): Function {
        let item = this.registeredMenusItems.get(id);
        return item && item.options ? item.options.click : null;
    }

    registerMenuItem(item: TrayMenuItem) {
        if (this.registeredMenusItems.has(item.id)) {
            return;
        }
        this.registeredMenusItems.put(item.id, item);
    }
    unregisterMenuItemsLike(idContains: string) {
        let list = this.registeredMenusItems.getValues();
        let filtered = list.filter( item => {
            return item.id.indexOf(idContains) == -1;
        });
        this.registeredMenusItems.clear();
        filtered.forEach( item => this.registeredMenusItems.put(item.id, item));
    }


    protected putMeInTray() {
        Logger.debug("initializing tray icon");
        Logger.debug("Getting icon from: ", this.trayIconPath);
        this.setNotificationVisible(false);
        this.trayIcon.setToolTip("PrivMX Desktop Client");
        this.refreshTrayMenu();
    }

    updateTrayNotification() {
        let updatedIcon = this.getTrayNotificationIcon();
        if (this.lastIcon !== updatedIcon) {
            this.lastIcon = updatedIcon;
            this.trayIcon.setImage(this.getTrayNotificationIcon());
        }
    }

    getTrayNotificationIcon(): string {
        if (this.noInternet) {
            return path.resolve(this.trayIconPathNoInternet);
        }
        else
        if (this.serverError) {
            return path.resolve(this.trayIconPathServerError);
        }
        else
        if (this.notificationVisible && !this.syncing) {
            return path.resolve(this.notifTrayIconPath);
        }
        else
        if (this.notificationVisible && this.syncing) {
            return path.resolve(this.notifTrayIconSyncPath);
        }
        else
        if (!this.notificationVisible && !this.syncing) {
            return path.resolve(this.trayIconPath);
        }
        else
        if (!this.notificationVisible && this.syncing) {
            return path.resolve(this.trayIconSyncPath);
        }
    }

    updateMainAppLastFocusLostTime() {
        this.lastMainAppFocusLostTime = new Date().getTime();
    }
}
