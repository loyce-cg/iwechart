import { ElectronApplication } from "../ElectronApplication";
import * as os from "os";
import Q = require("q");
import path = require("path");
import nodeIpc = require("node-ipc");
export interface UsedProfile {
    name: string;
    connection?: any;
}

export interface TimedPromise {
    defer: Q.Deferred<any>;
    timer: any;
}

export class ProfilesManagerIPC {
    static readonly PROCESS_ID: string = "PrivMxIPC";
    servicePath: string;
    connected: boolean = false;
    serving: boolean = false;
    usedProfiles: {[name: string]: UsedProfile};
    connectedClients: any[];
    requestDeferred: Q.Deferred<any>;
    instanceProfile: string;
    serverLastSeen: number = 0;
    pingTimer: any;
    timeoutTimer: any;
    requestsPool: {[id: string]: TimedPromise};
    
    constructor(public app: ElectronApplication) {
        
        nodeIpc.config.rawBuffer = false;
        nodeIpc.config.silent = true;
        nodeIpc.config.maxRetries = 0;
        nodeIpc.config.id = os.hostname() + "-" + new Date().getTime().toString();
        // nodeIpc.config.id = ProfilesManagerIPC.PROCESS_ID;

        this.usedProfiles = {};
        this.connectedClients = [];
        this.requestsPool = {};
        this.servicePath = path.join(path.resolve(os.homedir(), ".privmx"), ".ipcservice");
        this.connectInstanceOrServe();
    }
    
    connectInstanceOrServe(): void {
        Q().then(() => {
            return this.connectTo()
            .then(() => {
                return;
            })
        })
        .catch(() => {
            return this.serve()
            .then(() => {
                this.serving = true;
                this.pingClients();
                return;
            });
        })
        .fail(err => {
            // console.log("cannot connect or create ipc server");
        })
    }
    
    /////////////////////// server side /////////////////////////////////
    serve(): Q.Promise<void> {
        return Q.Promise((resolve,reject) => {
            if (this.instanceProfile) {
                this.registerClientProfile(this.instanceProfile);
            }
            nodeIpc.serve(this.servicePath, () => {
                nodeIpc.server.on("connect", this.onServerConnect.bind(this));
                nodeIpc.server.on("error", this.onServerError.bind(this));
                nodeIpc.server.on("socket.disconnected", (socket, id) => {
                    this.onServerDisconnect(socket, id);
                });
                
                nodeIpc.server.on("registerProfile", (req, socket) => {
                    this.registerClientProfile(req.data.profile, socket);
                    nodeIpc.server.emit(socket, "response", {data: "ok", reqId: req.reqId});
                });

                nodeIpc.server.on("isProfileUsed", (data, socket) => {
                    nodeIpc.server.emit(socket, "response", {data: this.isClientProfileUsed(data.data.profile), reqId: data.reqId});
                });

                nodeIpc.server.on("unregisterProfile", (req, socket) => {
                    this.unregisterClientProfile(req.data.profile);
                    nodeIpc.server.emit(socket, "response", {data: "ok", reqId: req.reqId});
                });

                nodeIpc.server.on("bringHostToTop", (req, socket) => {
                    this.app.bringMainWindowToTop();
                    nodeIpc.server.emit(socket, "response", {data: "ok", reqId: req.reqId});
                });

                nodeIpc.server.on("hello", (data, socket) => {
                    nodeIpc.server.emit(socket, {data: "ping", reqId: data.reqId});
                });

            });
            nodeIpc.server.start();
            resolve();
        });
    }

    onServerConnect(socket: any): void {
        // if(this.app.allowMultipleInstances()) {
        //     this.connectedClients.push(socket);
        // }
        // else {
        //     this.app.bringMainWindowToTop();
        // }
        this.connectedClients.push(socket);
    }

    onServerError(error: any): void {
        console.log("Server error", error);
    }
    
    onServerDisconnect(socket: any, socketId: any): void {
        // console.log("client disconnected", socketId);
        let removeIdx: number;
        this.connectedClients.forEach((s, idx) => {
            if (s == socket) {
                // console.log("found disconnected one..", idx);
                removeIdx = idx;
                return;
            }
        });
        if (removeIdx != null) {
            this.connectedClients.splice(removeIdx, 1);
            
            for (let id in this.usedProfiles) {
                let profile = this.usedProfiles[id];
                if (profile.connection == socket) {
                    delete this.usedProfiles[id];
                }
            }
        }
    }
    
    ////////////// client side /////////////////////////////////////////
    connectTo(): Q.Promise<void> {
        return Q.Promise((resolve, reject) => {
            nodeIpc.connectTo(ProfilesManagerIPC.PROCESS_ID, this.servicePath, () => {
                nodeIpc.of.PrivMxIPC.on("connect", (socket: any) => {
                    if (! this.connected) {
                        this.connected = true;
                        this.serverLastSeen = new Date().getTime();
                        if (this.app.allowMultipleInstances()) {
                            this.checkServer();
                            resolve();
                        }
                        else {
                            return this.createRequest("bringHostToTop", {})
                            .then(() => {
                                this.app.exitApp();
                                return;
                            })
                        }
                    }
                });
                
                nodeIpc.of.PrivMxIPC.on("error", (err: any) => {
                    if (!this.connected) {
                        reject();
                    }
                    else {
                        this.onClientError(err);
                    }
                });

                nodeIpc.of.PrivMxIPC.on("close", this.onClientClose.bind(this));
                nodeIpc.of.PrivMxIPC.on("ping", (data: any) => {
                    this.serverLastSeen = new Date().getTime();
                })
                nodeIpc.of.PrivMxIPC.on("response", (data: any) => {
                    // if (this.requestDeferred) {
                    //     this.requestDeferred.resolve(data);
                    // }

                    let requestId = data.reqId;
                    let emitter = this.getRequestEmitter(requestId);
                    if (emitter) {
                        emitter.resolve(data.data);
                    }
                })
            });
        })
    }
    
    onClientError(err: any): void {
        console.log("Client error", err);
        this.connected = false;
    }
    
    onClientClose(): void {
        this.connected = false;
        this.connectInstanceOrServe();
    }
    
    registerProfile(profile: string): Q.Promise<void> {
        this.instanceProfile = profile;
        if (this.connected && !this.serving) {
            // this.requestDeferred = Q.defer<void>();
            // nodeIpc.of.PrivMxIPC.emit("registerProfile", {profile: profile});
            // // this.setPromiseTimeout();
            // return this.requestDeferred.promise;
            return this.createRequest("registerProfile", {profile: profile});
        }
        else if (this.serving) {
            this.usedProfiles[profile] = {name: profile};
            return Q.resolve();
        }
    }
    
    registerClientProfile(profile: string, connection?: any): void {
        this.usedProfiles[profile] = {name: profile, connection: connection};
    }
        
    isProfileUsed(profile: string): Q.Promise<boolean> {
        if (this.connected && !this.serving) {
            // this.requestDeferred = Q.defer<any>();
            // nodeIpc.of.PrivMxIPC.emit("isProfileUsed", {profile: profile});
            // this.setPromiseTimeout();
            // return this.requestDeferred.promise;
            return this.createRequest("isProfileUsed", {profile: profile})
        }
        else if (this.serving) {
            return Q.resolve(this.isClientProfileUsed(profile));
        }
    }
    
    isClientProfileUsed(profile: string): boolean {
        return (profile in this.usedProfiles) == true;
    }
    
    unregisterProfile(profile: string): Q.Promise<void> {
        this.instanceProfile = null;
        if (this.connected && !this.serving) {
            // this.requestDeferred = Q.defer<void>();
            // nodeIpc.of.PrivMxIPC.emit("unregisterProfile", {profile: profile});
            // return this.requestDeferred.promise;

            return this.createRequest("unregisterProfile", {profile: profile});
        }
        else if (this.serving) {
            this.unregisterClientProfile(profile);
            return Q.resolve();
        }
    }
    
    unregisterClientProfile(profile: string): void {
        if (profile in this.usedProfiles) {
            delete this.usedProfiles[profile];
        }
    }
    
    checkServer(): void {
        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
        }
        this.pingTimer = setTimeout(() => {
            if (this.serverLastSeen + 3000 <= new Date().getTime() || !this.connected) {
                this.onClientClose();
            }
            else {
                this.checkServer();
            }
        }, 1000);
    }
    
    clearConnectionEvents(): void {
        nodeIpc.of.PrivMxIPC.off("connect");
        nodeIpc.of.PrivMxIPC.off("error");
        nodeIpc.of.PrivMxIPC.off("ping");
        nodeIpc.of.PrivMxIPC.off("response");
    }
    
    sayHello(): void {
        nodeIpc.of.PrivMxIPC.emit("hello");
    }
    
    pingClients(): void {

        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
        }

        this.pingTimer = setTimeout(() => {
            if (this.connectedClients.length > 0) {
                (<any>nodeIpc.server).broadcast("ping");
            }
            this.pingClients();
        }, 1000);
    }
    
    setPromiseTimeout(defer: Q.Deferred<any>) {
        return setTimeout(() => {
            if (defer.promise.isPending()) {
                defer.reject();
            }
        }, 1000);
    }
    
    createRequest(requestName: string, data: any): Q.Promise<any> {
        let reqId = requestName + new Date().getTime();

        let defer = Q.defer<any>();
        this.requestsPool[reqId] = {
            defer: defer,
            timer: this.setPromiseTimeout(defer)
        }
        nodeIpc.of.PrivMxIPC.emit(requestName, {data: data, reqId: reqId});
        return this.requestsPool[reqId].defer.promise;
    }
    
    getRequestEmitter(requestId: string): Q.Deferred<any> {
        let ref: TimedPromise;
        if (requestId in this.requestsPool) {
            ref = this.requestsPool[requestId];
            clearTimeout(ref.timer);
            delete this.requestsPool[requestId];
        }
        return ref.defer;
    }
}
