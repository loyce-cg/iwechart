import * as privfs from "privfs-client";
import * as Q from "q";
import {LowUser, LowUserService} from "./LowUser";
import {SinkIndexManager} from "./SinkIndexManager";
import * as RootLogger from "simplito-logger";
import {mail} from "../Types";
let Logger = RootLogger.get("privfs-mail-client.mail.LowUserService2");

export class LowUserService2 implements mail.ILowUserService {
    
    lowUserAlternativeRegistry: {[hashmail: string]: LowUser};
    
    constructor(
        public lowUserService: LowUserService,
        public sinkIndexManager: SinkIndexManager
    ) {
        this.lowUserAlternativeRegistry = {};
    }
    
    addLowUser(email: string, password: string, hint: string, language: string, source: string): Q.Promise<LowUser> {
        return Q().then(() => {
            if (!this.lowUserService) {
                throw new Error("LowUserService is null");
            }
            return this.lowUserService.createLowUser(password, hint, email, language, source);
        })
        .then(user => {
            this.refreshSinksRegistry();
            return user;
        });
    }
    
    refreshSinksRegistry(): void {
        if (!this.lowUserService) {
            return null;
        }
        let map: {[pub58: string]: privfs.crypto.ecc.PrivateKey} = {};
        let registry = this.lowUserService.registry.kvdb.getEntries();
        for (let key in registry) {
            let user = registry[key];
            if (user.sink) {
                let priv = privfs.crypto.ecc.PrivateKey.fromWIF(user.sink.wif);
                map[priv.getPublicKey().toBase58DER()] = priv;
            }
        }
        this.sinkIndexManager.getAllSinksEx().forEach(sink => {
            map[sink.id] = sink.priv;
        });
        this.sinkIndexManager.indexes.forEach(index => {
            if (!index.sink.options.proxyFrom) {
                return;
            }
            if (!index.sink.registry) {
                index.sink.registry = {map: {}};
            }
            if (typeof(index.sink.options.proxyFrom) == "string") {
                return;
            }
            index.sink.options.proxyFrom.list.forEach(entry => {
                let sid = privfs.core.Acl.getValue(entry);
                let priv = map[sid];
                if (priv) {
                    index.sink.registry.map[sid] = {type: "ecies", priv: priv};
                }
                else {
                    Logger.warn("Cannot create sink registry entry in " + index.sink.id + " for "  + sid);
                }
            });
        });
    }
    
    getLowUser(username: string, host: string): LowUser {
        if (!this.lowUserService) {
            return null;
        }
        let user = this.lowUserService.registry.getUser(username);
        return user != null && user.host == host ? user : null;
    }
    
    getLowUserByUser(sender: privfs.identity.User): LowUser {
        let lowUser = this.getLowUser(sender.user, sender.host);
        if (lowUser) {
            let lId = privfs.identity.Identity.fromSerialized(sender.hashmail, lowUser.identity.wif);
            return lId.pub58 == sender.pub58 ? lowUser : null;
        }
        return null;
    }
    
    getLowUserByEmail(email: string): LowUser {
        if (!this.lowUserService) {
            return null;
        }
        return this.lowUserService.registry.getLowUserByEmail(email);
    }
    
    getLowUserByHashmail(hashmail: string): LowUser {
        if (!this.lowUserService) {
            return null;
        }
        return this.lowUserService.registry.getLowUserByHashmail(hashmail);
    }
    
    getLowUserBySource(source: string): LowUser {
        if (!this.lowUserService) {
            return null;
        }
        return this.lowUserService.registry.getLowUserBySource(source);
    }
    
    isLowUser(sender: privfs.identity.User): boolean {
        let lowUser = this.getLowUser(sender.user, sender.host);
        if (lowUser) {
            let lId = privfs.identity.Identity.fromSerialized(sender.hashmail, lowUser.identity.wif);
            return lId.pub58 == sender.pub58;
        }
        return false;
    }
    
    getLowUserFromAlternativeRegistry(hashmail: string): LowUser {
        return this.lowUserAlternativeRegistry[hashmail];
    }
}