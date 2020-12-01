import { CommonApplication } from "../../app/common";
import {app, utils} from "../../Types";
import * as privfs from "privfs-client";
import * as Q from "q";

export class RegisterUtils {
    constructor (public app: CommonApplication) {}

    checkAndSetTokenInfo(tokenHash: string): boolean {
        let decoded: utils.RegisterTokenInfo;
        try {
            let json = Buffer.from(privfs.bs58.decode(tokenHash.split(":")[1])).toString("utf-8");
            decoded = <utils.RegisterTokenInfo>JSON.parse(json);
        }
        catch(e) {
            return false;
        }
        if (decoded.domain && decoded.token && decoded.domain.length > 0 && decoded.token.length > 0) {
            this.app.setRegisterTokenInfo(decoded);
            return true;
        }
        return false;
    }

    autoLogin(login: string, host: string, password: string): Q.Promise<void> {
        this.app.onLoginStart();
        return Q().then(() => {
            return this.app.mcaFactory.login(login, host, password);
        })
        .then(mca => {
            return mca.privmxRegistry.getIdentity().then(identity => {
                return this.app.onLogin(mca, {
                    type: app.LoginType.PASSWORD,
                    hashmail: identity,
                    password: password
                });
            });
        })
    }    
}