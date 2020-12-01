import {WebWindow} from "./WebWindow";
import {WindowHeader} from "./WindowHeader";
import {WindowWidget} from "./WindowWidget";
import {FullscreenClass} from "../../../web-utils/Fullscreen";
import {ElectronModule} from "../electron/ElectronModule";
import * as $ from "jquery";
import {app, ipc} from "../../../Types";
import * as RootLogger from "simplito-logger";
import { WebApplication } from "../../../build/core";
let Logger = RootLogger.get("privfs-mail-client.app.browser.window.WindowManager");
require("jquery-ui/resizable");
require("jquery-ui/draggable");

export class WindowManager {
    
    instances: WebWindow[];
    fullscreen: FullscreenClass;
    zIndexCounter: number;
    rootUrl: string;
    electronModule: ElectronModule;
    
    constructor(rootUrl: string, fullscreen: FullscreenClass, buttonsPosition: string, electronModule: ElectronModule, public app: WebApplication) {
        this.zIndexCounter = 1000;
        this.instances = [];
        this.fullscreen = fullscreen;
        this.rootUrl = rootUrl;
        this.electronModule = electronModule;
        $(window).on("resize", this.onGlobalResize.bind(this));
        this.fullscreen.getFullscreenModel().changeEvent.add(this.onFullscreenChange.bind(this));
        this.setWindowsTitleBarButtonsPosition(buttonsPosition);
    }
    
    open(load: app.WindowLoadOptions, options: app.WindowOptions, controllerId: number, ipcChannelName: string): WebWindow {
        let defaultOptions = {
            decoration: true,
            widget: true,
            resizable: true,
            draggable: true
        };
        options = $.extend(true, {}, defaultOptions, options || {});
        if (options.minimizable === undefined) {
            options.minimizable = options.resizable;
        }
        if (options.maximizable === undefined) {
            options.maximizable = options.resizable;
        }
        let wrapper = document.createElement("div");
        if (options.hidden) {
            wrapper.style.visibility = "hidden";
        }
        let iframeContainer = document.createElement("div");
        let iframe = document.createElement("iframe");
        let container = document.getElementById("windows-container");
        let winMgr = new WebWindow(this, load, iframe, container, iframeContainer, controllerId, ipcChannelName);
        if (options.showLoadingScreen) {
            winMgr.showLoadingScreen();
        }
        winMgr.options = options;
        wrapper.style.zIndex = "-1";
        wrapper.classList.add("window-wrapper");
        wrapper.appendChild(iframeContainer);
        wrapper.addEventListener("mousedown", () => {
            winMgr.focus();
        });
        iframeContainer.classList.add("iframe-container");
        iframeContainer.appendChild(iframe);
        winMgr.domElement = wrapper;
        if (options.decoration || options.widget) {
            container.appendChild(wrapper);
        }
        if (options.cssClass) {
            wrapper.classList.add.apply(wrapper.classList, options.cssClass.split(" "));
        }
        if (options.fullscreen) {
            wrapper.classList.add("fullscreen");
        }
        else {
            if (options.decoration) {
                winMgr.header = new WindowHeader();
                if (options.closable !== false) {
                    winMgr.header.buttons.close.addEventListener("click", event => {
                        event.stopPropagation();
                        winMgr.close();
                    });
                } else {
                    winMgr.header.hideCloseButton();
                }
                if (options.minimizable) {
                    winMgr.header.buttons.minimize.addEventListener("click", event => {
                        event.stopPropagation();
                        winMgr.minimizeToggle();
                    });
                }
                else {
                    winMgr.header.hideMinimizeButton();
                }
                if (options.maximizable) {
                    winMgr.header.buttons.maximize.addEventListener("click", event => {
                        event.stopPropagation();
                        winMgr.maximizeToggle();
                    });
                    winMgr.header.domElement.addEventListener("dblclick", event => {
                        event.stopPropagation();
                        winMgr.maximizeToggle();
                    });
                }
                else {
                    winMgr.header.hideMaximizeButton();
                }
                wrapper.appendChild(winMgr.header.domElement);
                if (options.draggable) {
                    $(wrapper).draggable({
                        containment: "parent",
                        iframeFix: true,
                        handle: winMgr.header.domElement,
                        opacity: 0.9,
                        cursor: "move"
                    });
                }
                if (options.resizable) {
                    let opts = {
                        start: () => {
                            $('<div class="ui-resizable-iframeFix" style="background: #fff;"></div>').css({
                                width: '100%',
                                height: '100%',
                                position: "absolute",
                                opacity: "0.001",
                                zIndex: 100000,
                                top: 0,
                                left: 0
                            }).appendTo("body");
                        },
                        stop: () => {
                            $('.ui-resizable-iframeFix').remove();
                        },
                        minWidth: <number>undefined,
                        minHeight: <number>undefined,
                        maxWidth: <number>undefined,
                        maxHeight: <number>undefined
                    };
                    if (options.minWidth) {
                        opts.minWidth = options.minWidth;
                    }
                    if (options.minHeight) {
                        opts.minHeight = options.minHeight;
                    }
                    if (options.maxWidth) {
                        opts.maxWidth = options.maxWidth;
                    }
                    if (options.maxHeight) {
                        opts.maxHeight = options.maxHeight;
                    }
                    $(wrapper).resizable(opts);
                }
                if (options.widget) {
                    winMgr.widget = new WindowWidget();
                    $("#opened-windows-bar > .inner > .fake").before(winMgr.widget.domElement);
                    winMgr.widget.closer.addEventListener("click", event => {
                        event.stopPropagation();
                        winMgr.close();
                    });
                    winMgr.widget.domElement.addEventListener("click", () => {
                        if (winMgr.minimized) {
                            winMgr.restoreMinimized();
                            winMgr.focus();
                        }
                        else {
                            if (winMgr.isFocused()) {
                                winMgr.minimize();
                            }
                            else {
                                winMgr.focus();
                            }
                        }
                    });
                }
                if (options.icon) {
                    winMgr.setIcon(options.icon);
                }
            }
            else {
                wrapper.classList.add("no-decoration");
            }
            if (options.width != null) {
                winMgr.setWidth(options.width);
            }
            if (options.height != null) {
                winMgr.setHeight(options.height);
            }
            if (options.title != null) {
                winMgr.setTitle(options.title);
            }
            if (options.position == null || options.position == "center" || options.position == "center-always") {
                winMgr.setPosition("center", "center");
            }
            if (options.maximized) {
                winMgr.maximize();
            }
            if (options.modal) {
                wrapper.classList.add("modal");
            }
        }
        this.instances.push(winMgr);
        iframe.onload = () => winMgr.loaded();
        if (load.type == "html") {
            iframe.setAttribute("data-name", load.name);
            let url = URL.createObjectURL(new Blob([load.html], {type : "text/html"}));
            iframe.setAttribute("src", url);
        }
        else if (load.type == "url") {
            iframe.src = this.rootUrl + load.url;
        }
        else if (load.type == "base") {
            iframe.src = load.baseUrl;
        }
        this.updateOpenedWindowsCounter();
        return winMgr;
    }
    
    onGlobalResize(): void {
        this.instances.forEach(winMgr => {
            if (!winMgr.domElement.classList.contains("fullscreen")) {
                if (!winMgr.maximized) {
                    let $elem = $(winMgr.domElement);
                    if (winMgr.options.position == "center-always" || $elem.outerWidth() + $elem.offset().left > $("body").width()) {
                        winMgr.setPosition("center", "center");
                    }
                }
            }
        });
    }
    
    focusOnTheMostTopWindow(): void {
        let topWindow: WebWindow = null;
        this.instances.forEach(winMgr => {
            if (!winMgr.minimized) {
                if (!topWindow || (winMgr.domElement.style.zIndex >= topWindow.domElement.style.zIndex)) {
                    topWindow = winMgr;
                }
            }
        });
        if (topWindow) {
            topWindow.focus();
        }
    }
    
    updateOpenedWindowsCounter(): void {
        let count = 0;
        this.instances.forEach(winMgr => {
            if (winMgr.widget) {
                count++;
            }
        });
        $("#opened-windows-bar .windows-counter .count").text(count);
    }
    
    setWindowsTitleBarButtonsPosition(position: string): void {
        let container = document.getElementById("windows-container");
        if (position == "left") {
            container.classList.add("header-buttons-to-left");
        }
        else {
            container.classList.remove("header-buttons-to-left");
        }
    }
    
    onFullscreenChange(_event: any, isFullscreen: boolean): void {
        if (isFullscreen) {
            return;
        }
        this.instances.forEach(winMgr => {
            if (winMgr.distractionFreeMode) {
                winMgr.exitDistractionFreeMode();
            }
        });
    }
    
    hideWindowsBar(): void {
        $("#main").addClass("without-windows-bar");
    }
    
    showWindowsBar(): void {
        $("#main").removeClass("without-windows-bar");
    }
    
    onDocked(event: ipc.IpcMainEvent, arg: any): void {
        for (let i = 0; i < this.instances.length; i++) {
            if (event.sender.id == this.instances[i].require.id) {
                this.instances[i].onDockedEvent(event, arg);
                return;
            }
        }
        Logger.warn("Not handled event from docked", event, arg);
    }
}
