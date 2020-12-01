import Q = require("q");
import { ElectronWindow } from "./ElectronWindow";
import { WindowManager } from "./WindowManager";
import { Formatter } from "../../../utils";
import { func as pageTemplate } from "../../../window/base/template/page.html";

export class ElectronWindowsPool {
    
    desiredPoolSize: number = 1;
    pool: Q.Promise<ElectronWindow>[] = [];
    
    constructor(public manager: WindowManager) {
        this.refill();
    }
    
    refill() {
        let nMissing = this.desiredPoolSize - this.pool.length;
        for (let i = 0; i < nMissing; i++) {
            this.pool.push(this.createWindow());
        }
    }
    
    take(): Q.Promise<ElectronWindow> {
        if (this.pool.length == 0) {
            this.refill();
        }
        let window = this.pool.shift();
        this.refill();
        return window;
    }
    
    createWindow(): Q.Promise<ElectronWindow> {
        // console.log('fast window loading - create window')
        let window: ElectronWindow;
        let deferred = Q.defer<void>();
        return Q().then(() => {
            let html = pageTemplate.func(<any>{ 
                type: "render",
                lang: null, // this.app.localeService.currentLang,
                title: "",
                bodyClass: "",
                viewName: null, // this.className.replace("WindowController", "WindowView"),
                scripts: [
                    this.manager.assetsManager.getAssetEx({ path: "build/privmx-view.js" }),
                    this.manager.assetsManager.getAssetEx({ path: "build/view.js", plugin: "chat" }),
                    this.manager.assetsManager.getAssetEx({ path: "build/view.js", plugin: "notes2" }),
                    this.manager.assetsManager.getAssetEx({ path: "build/view.js", plugin: "tasks" }),
                    this.manager.assetsManager.getAssetEx({ path: "build/view.js", plugin: "calendar" }),
                    this.manager.assetsManager.getAssetEx({ path: "build/view.js", plugin: "twofa" }),
                    this.manager.assetsManager.getAssetEx({ path: "build/view.js", plugin: "editor" }),
                ],
                styles: [
                ],
                assetsManager: this.manager.assetsManager,
                fonts: [
                    {family: "FontAwesome"},
                    {family: "ico"},
                    {family: "privmx-icons"},
                    {family: "source_sans_pro", weight: "900"},
                    {family: "source_sans_pro", weight: "bold"},
                    {family: "source_sans_pro", weight: "normal"},
                    {family: "source_sans_pro", weight: "600"},
                    {family: "source_code_pro", weight: "normal"},
                    {family: "source_code_pro", weight: "600"}
                ] }, null, new Formatter());
            window = new ElectronWindow(this.manager, {
                type: "html",
                html: html,
                name: null
            }, { hidden: true }, null, null, null, {
                copy: () => {},
                cut: () => {},
                paste: () => {},
            });
            window.window.webContents.on("did-finish-load", () => {
                deferred.resolve();
            });
            window.window.webContents.on("did-fail-load", () => {
                deferred.reject();
            });
            return deferred.promise;
        })
        .then(() => {
            return window;
        });
    }
    
}
