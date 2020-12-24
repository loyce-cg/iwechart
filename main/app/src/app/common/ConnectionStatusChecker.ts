import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.app.common.ConnectionStatusChecker");
import {WebApplication} from "../browser/WebApplication";
import {CommonApplication} from "./CommonApplication";
import {Event} from "../../utils/Event";
import * as privfs from "privfs-client";
import {app, event} from "../../Types";
import {ElectronApplication} from "../electron/ElectronApplication";
import * as Q from "q";
import {NetworkStatusService} from "../../mail/NetworkStatusService";
import { UtilApi } from "../../mail/UtilApi";

export class ConnectionStatusChecker {
    
    eventProcessing: boolean;
    onConnectionLostBindedTimeout: any = null;
    onConnectionLostBinded: () => void;
    innerPageWindow: boolean;
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public identity: privfs.identity.Identity,
        public networkStatusService: NetworkStatusService,
        public app: CommonApplication,
        public event: Event<any, any, any>
    ) {
        this.eventProcessing = false;
        this.onConnectionLostBinded = this.onConnectionLost.bind(this);
        this.event.add(this.onConnectionLostBinded);
        
        this.app.log("ConnectionStatusChecker constructor");
    }
    
    getSavedPassword(): Q.Promise<string> {
        this.app.log("ConnectionStatusChecker getSavedPassword");
        return this.app.defaultSettings.get("LoginWindowController").then(value => {
            return value ? JSON.parse(value)["remember-password-value"] : "";
        });
    }
    
    onConnectionLost() {
        this.app.log("ConnectionStatusChecker onConnectionLost");
        clearTimeout(this.onConnectionLostBindedTimeout);
        let hasNetworkConnection: boolean = true;
        let doExit: boolean = false;
        return Q().then(() => {

            if (this.eventProcessing) {
                this.app.log("this.eventProcessing: " + this.eventProcessing);
                doExit = true;
                return;
            }
            if (this.app.isElectronApp()) {
                this.app.log("check for: this.app.hasInternetConnection");
                return (<Q.Promise<boolean>>this.app.hasNetworkConnection())
                .then((isConnected:boolean) => {
                    this.app.log("isConnected: " + isConnected);
                    if (!isConnected) {
                        hasNetworkConnection = false;
                    }
                    return;
                })
            } else {
                return;
            }
        })
        .then(() => {
            this.app.log("connectionStatusChecker - getIdentityProvider");
            return this.app.mailClientApi.privmxRegistry.getIdentityProvider()
        })
        .then(ip => {
            if (hasNetworkConnection && !doExit) {
                this.app.log("ConnectionStatusChecker - hasNetworkConnection and ! doExit");
                let login = ip.getLogin();
                this.eventProcessing = true;
                this.networkStatusService.pauseNetworkActivity();
                let checker = this;
                // let username = checker.identity.user;
                let i18n = checker.app.localeService.i18nBinded;
                let ctrl = {
                    i18n: i18n,
                    prepareErrorMessage: this.app.errorLog.prepareErrorMessage.bind(this.app)
                };
                let listener: any;
                this.getSavedPassword().then(password => {
                    let onClose = (result: app.InteractiveModal) => {
                        if (result.result != "ok") {
                            checker.eventProcessing = false;
                            result.close();
                            return;
                        }
                        if (result.value == "") {
                            result.showInputError(i18n("window.login.submit.error.emptyPassword"));
                            return;
                        }
                        result.hideInputError();
                        result.startProcessing("");
                        Q().then(() => {
                            return checker.srpSecure.srpRelogin(login, result.value);
                        })
                        .then(() => {
                            checker.eventProcessing = false;
                            checker.networkStatusService.restoreNetworkActivity();
                            if (this.app.isElectronApp()) {
                                (<ElectronApplication>this.app).onServerConnectionRestored();
                            }
                            result.close();
                            let utilApi = new UtilApi(this.srpSecure);
                            utilApi.getDeviceToken().then(deviceToken => {
                                checker.srpSecure.gateway.properties["deviceToken"] = deviceToken;
                            })
                            .fail(e => {
                                console.log("Error during getting device token", e);
                            });
                        })
                        .fail(e => {
                            Logger.error("Error during login", e);
                            let msg = "";
                            if (privfs.core.ApiErrorCodes.isEx(e, "DIFFERENT_M1")) {
                                msg = i18n("window.login.submit.error.invalidPassword2");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "USER_DOESNT_EXIST")) {
                                msg = i18n("window.login.submit.error.invalidPassword2");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "INVALID_VERIFER")) {
                                msg = i18n("window.login.submit.error.invalidPassword2");
                            }
                            else if (privfs.core.ApiErrorCodes.isEx(e, "LOGIN_BLOCKED")) {
                                msg = i18n("window.login.submit.error.loginBlocked");
                            }
                            else {
                                msg = ctrl.prepareErrorMessage(e);
                            }
                            result.showInputError(msg);
                        })
                        .fin(() => {
                            this.app.removeEventListener("additionalloginstepaction", listener);
                            result.stopProcessing();
                        });
                    };
                    if (checker.innerPageWindow !== false && (<WebApplication><any>checker.app).initializer) {
                        let $dialog = (<WebApplication><any>checker.app).initializer.showLoginDialog(login, password, onClose);
                        listener = () => {
                            $dialog.addClass("hide");
                        }
                        this.app.addEventListener("additionalloginstepaction", listener);
                    }
                    else {

                        if (this.app.isElectronApp()) {
                            return (<Q.Promise<boolean>>this.app.hasNetworkConnection())
                            .then((isConnected:boolean) => {
                                if (!isConnected) {
                                    return;
                                }
                                let showDialog = () => {
                                    this.app.msgBox.promptEx({
                                        alwaysOnTop: false,
                                        showInactive: true,
                                        message: i18n("window.relogin.info"),
                                        height: 285,
                                        ok: {
                                            faIcon: "",
                                            label: i18n("window.relogin.login")
                                        },
                                        cancel: {visible: false},
                                        input: {
                                            preHtml: '<label style="display: block; margin-top: 10px; font-size: 14px;">' + i18n("window.relogin.username") + '</label><input class="form-control" readonly="readonly" placeholder="" value="' + login + '" type="text"><label style="margin: 10px 0 -10px 0; display: block; font-size: 14px;">' + i18n("window.relogin.password") + '</label>',
                                            type: "password",
                                            value: password
                                        },
                                        processing: "ok",
                                        onClose: onClose
                                    });
                                };
                                (<ElectronApplication>this.app).onServerConnectionError();
                                if (password && this.app.isElectronApp()) {
                                    Logger.error("Autoreconnecting");
                                    Q().then(() => {
                                        return this.srpSecure.srpRelogin(login, password);
                                    })
                                    .then(() => {
                                        Logger.error("Successfully reconnected");
                                        this.eventProcessing = false;
                                        this.networkStatusService.restoreNetworkActivity();
                                        (<ElectronApplication>this.app).onServerConnectionRestored();
                                    })
                                    .fail(e => {
                                        this.eventProcessing = false;
                                        Logger.error("Error during login", e);
                                        Logger.debug("Binding for next connection check..");
                                        this.onConnectionLostBindedTimeout = setTimeout(() => {
                                            this.onConnectionLost();
                                        }, 10000);
                                        (<ElectronApplication>this.app).onServerConnectionError();
                                    });
                                }
                                else {
                                    showDialog();
                                }
                                
                            })
                        }
                        
                    }
                });
            
            }
            else {
                if (!hasNetworkConnection && !doExit) {
                // if (!hasNetworkConnection) {
                    this.app.log("ConnectionStatusChecker onConnectionLostBindedTimeout setTimeout");
                    this.onConnectionLostBindedTimeout = setTimeout(() => {
                        this.onConnectionLost();
                    }, 5000);
                }
                return;
            }
        })
                
    }
    
    destroy() {
        if (this.onConnectionLostBinded) {
            this.event.remove(this.onConnectionLostBinded);
        }
    }
    
    
}

