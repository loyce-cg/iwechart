import * as privfs from "privfs-client";
import * as PmxApi from "privmx-server-api";
import {mail} from "../../../Types";
import { KvdbSettingEntry } from "../../kvdb/KvdbUtils";

export interface UserCreationParams {
    username: string;
    host: string;
    login?: string;
    password: string;
    email: string;
    language: string;
    description: string;
    notificationEnabled: boolean;
    privateSectionAllowed: boolean;
    type: PmxApi.api.admin.AddUser;
    generatedPassword: boolean;
    shareKvdb: boolean;
    weakPassword: boolean;
}

export interface AdminData {
    data: mail.AdminData;
    encrypted: Buffer;
}

export interface UserSinks {
    inbox: privfs.types.message.SinkWithCreateModel;
    outbox: privfs.types.message.SinkWithCreateModel;
    trash: privfs.types.message.SinkWithCreateModel;
    contact: privfs.types.message.SinkWithCreateModel;
}

export interface UserKvdbs {
    settings: privfs.db.KeyValueDb<KvdbSettingEntry>;
    tagsProvider: privfs.db.KeyValueDb<KvdbSettingEntry>;
    mailFilter: privfs.db.KeyValueDb<KvdbSettingEntry>;
    pkiCache: privfs.db.KeyValueDb<KvdbSettingEntry>;
    contacts: privfs.db.KeyValueDb<KvdbSettingEntry>;
}

export interface UserCreationContext {
    params: UserCreationParams;
    registerResult: privfs.types.core.RegisterCoreResult;
    identity: privfs.types.core.GeneratedIdentity;
    adminData: AdminData;
    sinks: UserSinks;
    keystore: privfs.types.core.KeystoreWithInsertionParams;
    kvdbs: UserKvdbs;
    kvdbInserts: privfs.types.db.KvdbSetEntryModel[];
}

export interface UserCredentials {
    username: string;
    password: string;
    masterSeed: string;
    recovery: string;
}

export interface UserProfile {
    username: string;
    privKey: privfs.crypto.ecc.PrivateKey;
    inbox: privfs.message.MessageSink;
}
