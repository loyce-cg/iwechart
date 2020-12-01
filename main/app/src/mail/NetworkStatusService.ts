import * as RootLogger from "simplito-logger";
import * as privfs from "privfs-client";
let Logger = RootLogger.get("privfs-mail-client.mail.NetworkStatusService");

export interface NetworkService {
    pause(): void;
    restore(): void;
}

export class NetworkStatusService {
    
    gateway: privfs.gateway.RpcGateway;
    services: NetworkService[];
    networkActivity: string;
    
    constructor() {
        this.services = [];
    }
    
    registerService(service: NetworkService) {
        this.services.push(service);
    }
    
    clearDeps() {
        this.services.forEach(x => x.pause());
        this.services = [];
        this.gateway = null;
    }
    
    networkActivityIsPaused(): boolean {
        return this.networkActivity === "paused";
    }
    
    pauseNetworkActivity(): void {
        Logger.debug("pauseNetworkActivity");
        this.networkActivity = "paused";
        this.services.forEach(x => x.pause());
    }
    
    restoreNetworkActivity(): void {
        Logger.debug("restoreNetworkActivity");
        this.networkActivity = null;
        if (this.gateway && this.gateway.isConnected()) {
            this.services.forEach(x => x.restore());
        }
    }
    
    stopCommunication(): void {
        Logger.debug("stopCommunication");
        this.services.forEach(x => x.pause());
    }
}