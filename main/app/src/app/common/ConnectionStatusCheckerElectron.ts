import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.app.common.ConnectionStatusChecker");
import * as privfs from "privfs-client";
import {app, event, utils} from "../../Types";
import * as Q from "q";
import {NetworkStatusService} from "../../mail/NetworkStatusService";
import { ElectronApplication } from "../electron/ElectronApplication";
import { UtilApi } from "../../mail/UtilApi";
import {PowerMonitor} from "electron";
import * as http from "http";
import * as https from "https";

export class ConnectionStatusCheckerElectron {
    static connectionCheckerId: number = 0;
    srpSecure: privfs.core.PrivFsSrpSecure;
    networkStatusService: NetworkStatusService
    identityProvider: utils.IdentityProvider;
    reconnectTimer: any = null;
    utilApi: UtilApi;
    
    intervals: {repeats: number, interval: number}[];
    connectionCheckIntervalLevel: number = 0;
    powerMonitor: PowerMonitor;
    reconnecting: boolean = false;
    relogging: boolean = false;
    lastConnectedTime: number;

    onResumeFunc:() => void;

    constructor(public app: ElectronApplication, public userCredentials: app.UserCredentials) {
        this.onResumeFunc = () => {
            this.resetConnectionCheckIntervals();
            this.app.log("fire reconnectChecker(force) after power resume");
            this.startReconnectChecker(true);
        };
    }

    registerPasswordChangeListener(): void {
        this.app.addEventListener<event.AfterPasswordChangedEvent>("afterPasswordChanged", event => {
            this.userCredentials = event.userCredentials;
        }, "ConnectionStatusChecker");
    }

    registerPowerEvents(): void {
        if (! this.powerMonitor) {
            this.powerMonitor = this.app.getPowerMonitor();
            this.powerMonitor.on("resume", this.onResumeFunc);
        }
    }

    unregisterPowerEvents(): void {
        if (this.powerMonitor) {
            this.powerMonitor.removeListener("resume", this.onResumeFunc);
        }
    }

    initAfterLogin(): void {
        this.resetConnectionCheckIntervals();
        this.registerPowerEvents();
        this.registerPasswordChangeListener();
    }

    resetConnectionCheckIntervals(): void {
        return;
        // this.intervals = [{repeats: 3, interval: 1000}, {repeats: 3, interval: 5000}, {repeats: -1, interval: 10000}];
    }
    
    // getConnectionCheckInterval(): number {
    //     let interval: number = 0;
    //     for (let i = 0; i < this.intervals.length; i++) {
    //         if (this.intervals[i].repeats != 0) {
    //             interval = this.intervals[i].interval;
    //             if (this.intervals[i].repeats > 0) {
    //                 this.intervals[i].repeats--;
    //             }
    //             break;
    //         }
    //     }
    //     return interval;
    // }

    getConnectionCheckInterval(): number {
        return 3000;
    }
    
    afterLogin() {
        this.app.log("ConnectionStatusCheckerElectron - afterLogin");
        this.initAfterLogin();
        return Q().then(() => {
            return Q.all([
                this.app.mailClientApi.privmxRegistry.getNetworkStatusService(),
                this.app.mailClientApi.privmxRegistry.getSrpSecure(),
                this.app.mailClientApi.privmxRegistry.getIdentityProvider()
            ])
            .then(res => {
                this.networkStatusService = res[0];
                this.srpSecure = res[1];
                this.identityProvider = res[2];
                this.utilApi = new UtilApi(this.srpSecure);
            })
        })
    }
    
    onLogout(): void {
        this.unregisterPowerEvents();
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
        this.reconnecting = false;
        this.relogging = false;
    }

    getSavedPassword(): Q.Promise<string> {
        this.app.log("ConnectionStatusChecker getSavedPassword");
        return this.app.defaultSettings.get("LoginWindowController").then(value => {
            return value ? JSON.parse(value)["remember-password-value"] : "";
        });
    }
    
    startReconnectChecker(force?: boolean): void {
        if (this.reconnectTimer && !this.doNeedHttpRestart() && !force) {
            this.app.log("[SRC] reconnectTimer is set.. aborting.");
            return;
        }

        if (this.doNeedHttpRestart() || force) {
            this.showCoverMsg("checkingConnectionStatus");
            this.app.log("Restarting connection fully (with new http/https agent)...")
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
            this.reconnecting = false;
            this.relogging = false;
            this.restartHttpConnection();
        }


        let func = (connId: number) => {
                    // fully restart connection if not responding for some time..
            if (this.reconnecting) {
                this.app.log("[SRC "+ connId +"] reconnecting already in progress.. aborting.");
                return;
            }
            this.app.log("[SRC "+ connId +"] startReconnectChecker - set reconnecting = true");
            this.reconnecting = true;
            Q().then(() => {
                this.showCoverMsg("checkingConnectionStatus");
                return this.hasServerConnection()
            })
            .then(pingOk => {
                this.app.log("[SRC  "+ connId +"] ping result:", pingOk.toString());
                if (pingOk) {
                    return true;
                }
                else if (this.relogging) {
                    this.app.log("[SRC "+ connId +"] Relogging already in progress.. aborting")
                    return false;
                }
                else {
                    return this.tryReconnect();
                }
            })
            .then(result => {
                this.app.log("[SRC  "+ connId +"] ping/reconnect result:", result);
                this.reconnecting = false;

                if (result) {
                    this.app.onServerConnectionRestored();
                    this.stopReconnectChecker(connId);
                }
                else {
                    this.showCoverMsg("reloginFailed");
                }
            })
            .fail(() => {
                this.app.log("[SRC  "+ connId +"] fail - set reconnecting to false");
                this.reconnecting = false;
                this.showCoverMsg("reloginFailed");
            })
        }
        this.reconnectTimer = setInterval( () => func(++ConnectionStatusCheckerElectron.connectionCheckerId), this.getConnectionCheckInterval());
    }
    
    stopReconnectChecker(connId?: number): void {
        this.app.log("[SRC  "+ connId +"] stop connection checker");
        this.resetConnectionCheckIntervals();
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
      
    tryReconnect(): Q.Promise<boolean> {
        let isConnected: boolean = false;
        return Q().then(() => {
            if (this.relogging) {
                this.app.log("relogging in progress. abort")
                return Q.resolve(false);
            }
            // this.app.log("[tryReconnect] checking host availability - ", this.identityProvider.getIdentity().host);
            return this.app.isHostAvailable(this.identityProvider.getIdentity().host)

        })

        .then(connected => {
            // isConnected = connected;
            if (! connected) {
                this.app.log("No internet. Pause network activity and exit");
                if (this.networkStatusService && ! this.networkStatusService.networkActivityIsPaused()) {
                    this.networkStatusService.pauseNetworkActivity();
                }
                return;
            }
            if (! this.srpSecure) {
                this.app.log("no srpSecure");
                return;
            }
            this.app.log("Host " + this.identityProvider.getIdentity().host + " is available. Trying to re-login ...");
            this.showCoverMsg("relogging");
            this.relogging = true;
            return this.srpSecure.srpRelogin(this.identityProvider.getLogin(), this.userCredentials.password)
            .then(() => {
                this.app.log("re-logged, restoring network activity");
                this.networkStatusService.restoreNetworkActivity();
                this.app.onServerConnectionRestored();
                this.resetCoverMsg();
                isConnected = true;
                this.relogging = false;
                this.app.eventDispatcher.dispatchEvent<event.RefreshUsersPresence>({type: "refresh-users-presence"});

                this.utilApi.getDeviceToken().then(deviceToken => {
                    this.srpSecure.gateway.properties["deviceToken"] = deviceToken;
                })
                .fail(e => {
                    console.log("Error during getting device token", e);
                });
            })
        })
        .then(() => {
            return isConnected;
        })
        .fail(() => {
            this.showCoverMsg("reloginFailed")
            this.relogging = false;
            return isConnected;
        })
    }

    hasServerConnection(): Q.Promise<boolean> {
        return Q().then(() => {
            return this.app.isHostAvailable(this.identityProvider.getIdentity().host)
        })
        .then(dnsResult => {
            // if (! dnsResult) {
            //     return Q.reject<boolean>(false);
            // }
            // else {
            //     return this.utilApi.plainPing().catch((e: Error) => {
            //         return Q.resolve<boolean>(e.message.indexOf("Connection Broken") == -1);
            //     })
            //     .then(plainPingResult => {
            //         return plainPingResult ? this.utilApi.pingWithRetry() : Q.reject<string>("");
            //     })
            //     .then(data => {
            //         if(data == "pong") {
            //             return true;
            //         }
            //         else {
            //             return false;
            //         }
            //     })
        
            // }
            if (! dnsResult) {
                return Q.reject<boolean>(false);
            }
            else {
                return this.utilApi.pingWithRetry()
                .then(pingOk => {
                    if (pingOk == "pong") {
                        return this.srpSecure.request("sinkGetAllMy", {})
                        .then(allMy => {
                            if (allMy) {
                                this.resetLastConnectedTime();
                                return true;
                            }
                            return false;
                        })
                    }
                    return false;
                })
            }
        })
        .fail(e => {
            return false;
        })
    }

    // public
    getServerConnectedStatus(): Q.Promise<boolean> {
        return Q().then(() => {
            if (this.relogging || this.reconnecting) {
                return true;
            }
            else {
                return this.hasServerConnection();
            }
        })
        .fail(() => {
            return false;
        })
    }

    showCoverMsg(msgId?: string): void {
        this.app.dispatchEvent<event.AllWindowsMessage>({
            type: "all-windows-message",
            message: "connection-msg",
            extra: msgId ? msgId : null
        });
    }

    resetCoverMsg(): void {
        this.showCoverMsg();
    }

    doNeedHttpRestart(): boolean {
        const connectionLifeTime: number = 15000;
        return this.lastConnectedTime && this.lastConnectedTime < Date.now() - connectionLifeTime;
    }

    restartHttpConnection(): void {
        let xhr2 = require("xhr2");
        xhr2.nodejsSet({
            httpAgent: new http.Agent({keepAlive: true}),
            httpsAgent: new https.Agent({keepAlive: true}),
        });
    }

    resetLastConnectedTime(): void {
        this.lastConnectedTime = Date.now();
    }

}