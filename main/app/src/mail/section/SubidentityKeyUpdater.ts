import {SubidentityService} from "../subidentity/SubidentityService";
import * as Q from "q";
import {SectionUtils} from "./SectionUtils";
import * as RootLogger from "simplito-logger";
import {section} from "../../Types";
import { PromiseCache } from "../../utils/PromiseCache";
let Logger = RootLogger.get("privfs-mail-client.mail.section.SubidentityKeyUpdater");

type SectionKeysMap = {[sectionId: string]: {timestamp: number, key: section.SectionKey}};

export class SubidentityKeyUpdater {
    
    private checkKeysTid: any;
    private keysToCheck: SectionKeysMap;
    private processedKeys: {[id: string]: true};
    private checkPromise: PromiseCache<void>;
    
    constructor(private subidentityService: SubidentityService) {
        this.keysToCheck = {};
        this.processedKeys = {};
        this.checkPromise = new PromiseCache();
    }
    
    checkKey(key: section.SectionKey, timestamp: number) {
        if (key.keyId == SectionUtils.PUBLIC_KEY_ID) {
            return;
        }
        const processedId = key.sectionId + "-" + key.keyId;
        if (processedId in this.processedKeys) {
            return;
        }
        this.processedKeys[processedId] = true;
        if (this.addKey(key, timestamp)) {
            this.scheduleCheck();
        }
    }
    
    private scheduleCheck() {
        clearTimeout(this.checkKeysTid);
        this.checkKeysTid = setTimeout(() => {
            this.checkKeysCore();
        }, 100);
    }
    
    private checkKeysCore() {
        return this.checkPromise.go(async () => {
            let keysToCheck: SectionKeysMap = null;
            try {
                const subIds = await this.subidentityService.getSubidentities();
                keysToCheck = this.keysToCheck;
                this.keysToCheck = {};
                let updates: Q.Promise<void>[] = [];
                for (let pub in subIds) {
                    if (pub == "undefined") { // Filter invalid data which may be returned from server
                        continue;
                    }
                    let sub = subIds[pub];
                    let keyEntry = keysToCheck[sub.sectionId];
                    if (keyEntry && keyEntry.key.keyId != sub.sectionKeyId && keyEntry.key.keyId != SectionUtils.PUBLIC_KEY_ID) {
                        updates.push(this.subidentityService.updateSubidentityKey(sub, keyEntry.key));
                    }
                }
                await Q.all(updates);
            }
            catch (e) {
                Logger.error("Error during updating subidentities", e);
                if (keysToCheck) {
                    this.mergeKeys(keysToCheck);
                }
            }
            finally {
                if (Object.keys(this.keysToCheck).length > 0) {
                    this.scheduleCheck();
                }
            }
        });
    }
    
    private mergeKeys(keys: SectionKeysMap) {
        for (const sectionId in keys) {
            const keyEntry = keys[sectionId];
            this.addKey(keyEntry.key, keyEntry.timestamp);
        }
    }
    
    private addKey(key: section.SectionKey, timestamp: number) {
        const oldEntry = this.keysToCheck[key.sectionId];
        if (oldEntry && oldEntry.timestamp > timestamp) {
            return false;
        }
        this.keysToCheck[key.sectionId] = {key: key, timestamp: timestamp};
        return true;
    }
}
