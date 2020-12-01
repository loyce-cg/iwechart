import * as privfs from "privfs-client";
import * as Q from "q";
import * as PmxApi from "privmx-server-api";


export interface AddExternalUserModel {        
    creator: PmxApi.api.core.Username;        
    username: PmxApi.api.core.Username;       
    email: PmxApi.api.core.Email;        
    description: PmxApi.api.user.UserDescription;        
    notificationsEnabled: boolean;        
    language: PmxApi.api.core.Language;        
    privateSectionAllowed: boolean;    
}

export class UtilApi {
    
    constructor(
        public srpSecure: privfs.core.PrivFsSrpSecure
    ) {
    }
    
    generateInviteToken(): Q.Promise<string> {
        return this.srpSecure.invite();
    }
    
    getForbiddenUsernames(): Q.Promise<string[]> {
        return this.srpSecure.request<string[]>("getForbiddenUsernames", {});
    }
    
    getUsernames(): Q.Promise<string[]> {
        return this.srpSecure.request<string[]>("getUsernames", {});
    }

    addBasicUser(params: AddExternalUserModel): Q.Promise<{token: PmxApi.api.user.UserToken}> {
        return this.srpSecure.request("addBasicUser", params);
    }
    
    getDeviceToken(): Q.Promise<string> {
        return this.srpSecure.request<string>("getDeviceToken", {});
    }
    
    ping(): Q.Promise<string> {
        return Q.timeout(this.srpSecure.request<string>("ping", {}), 10000);
    }

    pingRejectDelay(reason: any) {
        return Q.Promise((_resolve, reject) => {
            setTimeout(reject.bind(null, reason), 1000); 
        });
    }

    pingWithRetry(): Q.Promise<string> {
        let p: Q.Promise<string> = Q.reject();
        for(let i = 0; i < 3; i++) {
            p = p.catch(this.ping.bind(this)).catch(this.pingRejectDelay.bind(this));
        }
        p = p.then(() => "pong").catch(() => "error");
        return p;
    }
    
    getUsernamesEx(addDeletedUsers?: boolean): Q.Promise<PmxApi.api.user.UsernameEx[]> {
        return this.srpSecure.request("getUsernamesEx", {addDeletedUsers: addDeletedUsers})    
    }

    getPaymentStatus(): Q.Promise<PmxApi.api.dataCenter.PaymentStatusSimple> {
        return this.srpSecure.request("getPaymentStatus", {});
    }

    getFullPaymentStatus(): Q.Promise<PmxApi.api.dataCenter.PaymentStatusRes> {
        return Q().then(() => {
            return this.srpSecure.request("getFullPaymentStatus", {})
        })
        .catch(e => {
            return <PmxApi.api.dataCenter.PaymentStatusRes> {
                serverParams: {
                    users: -1,
                    storage: "999999G",
                    sections: -1
                },
                free: true,
                startDate: new Date().getTime().toString(),
                endDate: ((new Date().getTime()) + 3 * 24 * 60 * 60 * 1000).toString(),
                expired: false,
                subscriptionEnding: true,
                hasExtendOrder: false,
                order: null
            };
        })
    }

    getDataCenterLocationInfo(): Q.Promise<any> {
        return Q().then(() => {
            return this.srpSecure.request("getDataCenterLocationInfo", {})
        })
        .catch(e => {
            return {
                dcName: "none/DEV",
                location: {
                    displayName: "none/DEV"
                }
            }
        })
    }

    setUserBlocked(username: PmxApi.api.core.Username, blocked: boolean): Q.Promise<PmxApi.api.core.OK> {
        return this.srpSecure.request("setUserBlocked", {username: username, blocked: blocked});
    }

    disableUserTwofa(username: PmxApi.api.core.Username): Q.Promise<PmxApi.api.core.OK> {
        return this.srpSecure.request("disableUserTwofa", {username: username});
    }

    plainPing(): Q.Promise<void> {
        return Q().then(() => {
            let defer = Q.defer();
            let rpc = this.srpSecure.gateway.rpc;
            let connection = new privfs.rpc.PrivmxConnection(rpc.config, rpc);

                        
            let pingMsg = {
                method: "ping",
                params: {},
                id: new Date().getTime().toString() + Math.random().toString()
            };

            let call = {
                id: pingMsg.id,
                deferred: defer,
                createDate: new Date().getTime(),
                method: pingMsg.method
            };
            
            return connection.connect(1000).then(() => {
                connection.calls[pingMsg.id] = call;
                return (<any>connection).encodeMessage(pingMsg, privfs.rpc.Types.ContentType.APPLICATION_DATA).then((result: Buffer) => {
                    connection.channel.postMessage(result, true);
                    return defer.promise.then((frame: {error?: any, result?: any}) => {
                        if (frame.error) {
                            return Q.reject(frame.error);
                        }
                        return frame["result"];
                    })
                    .then(res => {
                        // console.log("plain ping", res);
                        return res;
                    })
                })
                .catch((e:any) => {
                    // console.log("plain ping error", e)
                    console.log("catched err", JSON.stringify(e));
                });
            })
    
        })

    }

}