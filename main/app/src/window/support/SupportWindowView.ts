import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {app} from "../../Types";
import { Model } from "./SupportWindowController";

export interface RegisterUserData {
    email: string;
    login: string;
    password: string;
    passwordScore: number;
    token: string;
}

export type ParsedRequest = CloseRequest | ResizeRequest | OpenUrlRequest | ReadyRequest;
export interface CloseRequest {
    action: "close"
}
export interface ReadyRequest {
    action: "ready"
}

export interface ResizeRequest {
    action: "resize";
    data: {height: number};
}

export interface OpenUrlRequest {
    action: "open-url";
    data: {url: string};
}

@WindowView
export class SupportWindowView extends BaseWindowView<Model> {
    serverIframe: any;
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): Q.IWhenable<void> {
        if (model.supportEnabled) {
            $(window).on("message", this.processIframeMessage.bind(this));
            this.serverIframe = $("#server-iframe");
            this.serverIframe.on("load", () => {
                this.triggerEvent("IframeLoaded");
            })    
        }
        else {
            this.showStaticSupportMessage();
        }
    }

    processIframeMessage(e: JQuery.Event): void {
        let request = this.parseRequest(e);
        if (request.action == "resize") {
            this.onResizeWindow(request.data.height);
        }
        else
        if (request.action == "open-url") {
            this.onOpenUrl(request.data.url);
        }
        else
        if (request.action == "close") {
            this.onCloseServerWindow();
        }
        else
        if (request.action == "ready") {
            this.onWindowIsReady();
        }
        else {
            this.triggerEvent("requestError");
        }
    }

    parseRequest(e: JQuery.Event): ParsedRequest {
        let ev = <any>e.originalEvent;
        let action: string = ev.data.action;

        if (action == "resize") {
            return {
                action: action,
                data: {
                    height: Math.round(ev.data.height)
                }
            }
        }
        else if (action == "open-url") {
            return {
                action: action,
                data: {
                    url: ev.data.url
                }
            }
        }
        else if (action == "close") {
            return {
                action: action
            }
        }
        else if (action == "ready") {
            return {
                action: action
            }
        }

    }

    postMessage(message: string): void {
        (<any>this.serverIframe[0]).contentWindow.postMessage({action: message}, "*");
    }

    onResizeWindow(size: number | string) {
        this.triggerEvent("setWindowHeight", size);
    }

    onCloseServerWindow(): void {
        this.serverIframe.remove();
        this.triggerEvent("close");
    }

    onLoginToAccount(): void {
        this.serverIframe.remove();
        this.triggerEvent("login");
    }

    afterUserCreated(): void {
        this.postMessage("user-created");
    }

    onCannotCreateUser(): void {
        this.postMessage("user-creation-error");
    }

    onOpenUrl(url: string): void {
        this.triggerEvent("openUrl", url);
    }

    onWindowIsReady(): void {
        this.$main.find(".loader").remove();
        this.$main.find(".inner-view").show();
    }

    showStaticSupportMessage(): void {
        this.bindStaticMessageActions();
        this.$main.find(".inner-view").toggleClass("hide", true);
        this.$main.find(".loader").toggleClass("hide", true);
        this.$main.find(".inner-static-view").toggleClass("hide", false);
    }

    bindStaticMessageActions(): void {
        this.$main.on("click", "[trigger-action=openSupportPage]", this.onOpenSupportPageClick.bind(this));
        this.$main.on("click", "[trigger-action=close]", this.onCloseClick.bind(this));
    }

    onOpenSupportPageClick(): void {
        this.triggerEvent("openUrl", "https://privmx.com/support");
    }

    onCloseClick(): void {
        this.triggerEvent("close");
    }
}
