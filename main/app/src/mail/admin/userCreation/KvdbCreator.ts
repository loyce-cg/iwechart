import * as privfs from "privfs-client";
import { KvdbSettingEntry } from "../../kvdb/KvdbUtils";
import { MailConst } from "../../MailConst";

export class KvdbCreator {
    
    constructor(private extKey: privfs.crypto.ecc.ExtKey) {
    }
    
    createSettingsKvdb() {
        return this.createKvdb(MailConst.SETTINGS_KVDB_INDEX);
    }
    
    createTagsProviderKvdb() {
        return this.createKvdb(MailConst.TAG_PROVIDER_KVDB_INDEX);
    }
    
    createMailFilterKvdb() {
        return this.createKvdb(MailConst.MAIL_FILTER_KVDB_INDEX);
    }
    
    createPkiCacheKvdb() {
        return this.createKvdb(MailConst.PKI_CACHE_KVDB_INDEX);
    }
    
    createContactsKvdb() {
        return this.createKvdb(MailConst.CONTACTS_KVDB_INDEX);
    }
    
    private async createKvdb(index: number) {
        const extKey = await this.derive(index);
        return new privfs.db.KeyValueDb<KvdbSettingEntry>(null, extKey, {}, true);
    }
    
    private async derive(index: number): Promise<privfs.crypto.ecc.ExtKey> {
        return await privfs.crypto.service.deriveHardened(this.extKey, index);
    }
}