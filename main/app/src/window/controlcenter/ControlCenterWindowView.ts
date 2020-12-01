import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {app} from "../../Types";
import { Model } from "./ControlCenterWindowController";

export interface RegisterUserData {
    email: string;
    login: string;
    password: string;
    passwordScore: number;
    token: string;
}

export type ParsedRequest = RegisterUserRequest | CloseRequest | LoginRequest | ResizeRequest | OpenUrlRequest;
export interface CloseRequest {
    action: "close";
    activationToken?: string;
}
export interface LoginRequest {
    action: "login"
}
export interface RegisterUserRequest {
    action: "register-user";
    data: RegisterUserData;
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
export class ControlCenterWindowView extends BaseWindowView<Model> {
    serverIframe: any;
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): Q.IWhenable<void> {
        $(window).on("message", this.processIframeMessage.bind(this));
        this.serverIframe = $("#server-iframe");
        this.serverIframe.on("load", () => {
            this.triggerEvent("IframeLoaded");
        })
    }

    processIframeMessage(e: JQuery.Event): void {
        let request = this.parseRequest(e);
        if (request.action == "register-user") {
            this.onRegisterUser(request.data);
        }
        else
        if (request.action == "resize") {
            this.onResizeWindow(request.data.height);
        }
        else
        if (request.action == "open-url") {
            this.onOpenUrl(request.data.url);
        }
        else
        if (request.action == "close") {
            if (request.activationToken) {
                this.onStartUserRegistrationFromCC(request.activationToken);
            }
            this.onCloseServerWindow();
        }
        else
        if (request.action == "login") {
            this.onLoginToAccount();
        }
        else {
            this.triggerEvent("requestError");
        }
    }

    parseRequest(e: JQuery.Event): ParsedRequest {
        let ev = <any>e.originalEvent;
        let action: string = ev.data.action;
        if (action == "register-user") {
            return {
                action: action,
                data: {
                    email: ev.data.email,

                    login: ev.data.login,
                    password: ev.data.password,
                    passwordScore: ev.data.passwordScore,
                    token: ev.data.token
                }
            }
        }
        else if (action == "resize") {
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
                action: action,
                activationToken: ev.data.activationToken || undefined
            }
        }
        else if (action == "login") {
            return {
                action: action
            }
        }

    }

    postMessage(message: string): void {
        (<any>this.serverIframe[0]).contentWindow.postMessage({action: message}, "*");
    }
    
    onRegisterUser(data: RegisterUserData): void {
        this.triggerEvent("registerUser", data.email, data.login, data.password, data.passwordScore, data.token);
    }

    onStartUserRegistrationFromCC(token: string): void {
        this.triggerEvent("startUserRegstrationByActivationToken", token);
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
}
