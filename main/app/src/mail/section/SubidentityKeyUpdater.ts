import {SubidentityService} from "../subidentity/SubidentityService";
import * as Q from "q";
import {SectionUtils} from "./SectionUtils";
import * as RootLogger from "simplito-logger";
import {section} from "../../Types";
let Logger = RootLogger.get("privfs-mail-client.mail.section.SubidentityKeyUpdater");

export class SubidentityKeyUpdater {
    
    checkKeysTid: any;
    checkKeysRunning: boolean;
    keysToCheck: {[sectionId: string]: section.SectionKey};
    
    constructor(public subidentityService: SubidentityService) {
        this.keysToCheck = {};
    }
    
    checkKey(key: section.SectionKey) {
        if (key.keyId == SectionUtils.PUBLIC_KEY_ID) {
            return;
        }
        this.keysToCheck[key.sectionId] = key;
        clearTimeout(this.checkKeysTid);
        this.checkKeysTid = setTimeout(() => {
            this.checkKeysCore();
        }, 100);
    }
    
    checkKeysCore() {
        if (this.checkKeysRunning) {
            return;
        }
        this.checkKeysRunning = true;
        Q().then(() => {
            return this.subidentityService.getSubidentities();
        })
        .then(subIds => {
            let updates: Q.Promise<void>[] = [];
            for (let pub in subIds) {
                let sub = subIds[pub];
                let key = this.keysToCheck[sub.sectionId];
                if (key && key.keyId != sub.sectionKeyId && key.keyId != SectionUtils.PUBLIC_KEY_ID) {
                    updates.push(this.subidentityService.updateSubidentityKey(sub, key));
                }
            }
            this.keysToCheck = {};
            return Q.all(updates);
        })
        .fail(e => {
            Logger.error("Error during updating subidentities", e);
        })
        .fin(() => {
            this.checkKeysRunning = false;
        });
    }
}