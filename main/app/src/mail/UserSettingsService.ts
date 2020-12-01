import {KvdbSettingEntry, KvdbUtils} from "./kvdb/KvdbUtils";
import {EventDispatcher} from "../utils/EventDispatcher";
import {event, utils} from "../Types";
import * as privfs from "privfs-client";
import * as Q from "q";

export class UserSettingsService {
    
    static SHARED_KVDB_KEY = "sharedKvdb";
    
    constructor(
        public userSettingsKvdb: utils.IKeyValueDb<KvdbSettingEntry>,
        public eventDispatcher: EventDispatcher
    ) {
    }
    
    saveSharedKvdbKeyInUserSpace(extKey: privfs.crypto.ecc.ExtKey): Q.Promise<void> {
        return Q().then(() => {
            return this.userSettingsKvdb.set(UserSettingsService.SHARED_KVDB_KEY, KvdbUtils.createKvdbSettingEntry(extKey.getPrivatePartAsBase58()));
        })
        .then(() => {
            this.eventDispatcher.dispatchEvent<event.GrantAccessToSharedDbEvent>({
                type: "grantaccesstoshareddb"
            });
        });
    }
    
    getSharedKvdbExtKey() {
        return Q().then(() => {
            return this.userSettingsKvdb.get(UserSettingsService.SHARED_KVDB_KEY);
        })
        .then(settingEntry => {
            return settingEntry ? privfs.crypto.ecc.ExtKey.fromBase58(settingEntry.secured.value) : null;
        });
    }
}