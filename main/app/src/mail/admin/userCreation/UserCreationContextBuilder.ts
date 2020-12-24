import * as privfs from "privfs-client";
import { MailConst } from "../../MailConst";
import { mail } from "../../../Types";
import { AdminDataCreatorService } from "../AdminDataCreatorService";
import { UserSettingsService } from "../../UserSettingsService";
import { AdminData, UserSinks, UserKvdbs, UserCredentials, UserProfile, UserCreationContext, UserCreationParams } from "./Types";
import { SinkCreator } from "./SinkCreator";
import { KvdbCreator } from "./KvdbCreator";

export class UserCreationContextBuilder {
    
    constructor(
        private gateway: privfs.gateway.RpcGateway,
        private pki: privfs.pki.PrivmxPKI,
        private adminDataCreatorService: AdminDataCreatorService,
        private sharedKvdbExtKey: privfs.crypto.ecc.ExtKey
    ) {
    }
    
    async build(params: UserCreationParams): Promise<UserCreationContext> {
        const result = await this.generateIdentity(params);
        const identity = result.identity;
        const adminData = await this.createAdminData({
            username: params.username,
            password: params.password,
            masterSeed: identity.masterRecord.l1.masterSeed,
            recovery: identity.masterRecord.l1.recovery
        });
        const sinks = await this.createSinks(identity.masterExtKey);
        const keystore = await this.createKeystore({
            username: params.username,
            privKey: identity.identityKey,
            inbox: sinks.inbox.sink
        });
        const kvdbs = await this.createKvdbs(identity.masterExtKey);
        const kvdbInserts = await this.createKvdbInserts(kvdbs, params.shareKvdb);
        const context: UserCreationContext = {
            params: params,
            registerResult: result,
            identity: identity,
            adminData: adminData,
            sinks: sinks,
            keystore: keystore,
            kvdbs: kvdbs,
            kvdbInserts: kvdbInserts
        };
        return context;
    }
    
    private async generateIdentity(params: privfs.types.core.RegisterParamsEx2): Promise<privfs.types.core.RegisterCoreResultWithIdentity> {
        const info = await this.gateway.info();
        return await privfs.core.Registration.registerCoreEx(info, MailConst.IDENTITY_INDEX, params);
    }
    
    private async createAdminData(credentials: UserCredentials): Promise<AdminData> {
        const adminData: mail.AdminData = {
            masterSeed: credentials.masterSeed,
            recovery: credentials.recovery,
            generatedPassword: credentials.password
        };
        return {
            data: adminData,
            encrypted: await this.adminDataCreatorService.encryptAdminData(credentials.username, adminData)
        };
    }
    
    private async createSinks(extKey: privfs.crypto.ecc.ExtKey): Promise<UserSinks> {
        const sinkCreator = await this.createSinkCreator(extKey);
        const sinks: UserSinks = {
            inbox: await sinkCreator.createInbox(),
            outbox: await sinkCreator.createOutbox(),
            trash: await sinkCreator.createOutbox(),
            contact: await sinkCreator.createContactForm()
        };
        this.createSinkProxy(sinks.contact, sinks.inbox);
        return sinks;
    }
    
    private async createKeystore(userProfile: UserProfile): Promise<privfs.types.core.KeystoreWithInsertionParams> {
        return await privfs.core.KeystoreUtils.createKeystoreFromProfileWithInsertionSignatureData(this.pki, userProfile.username,
            userProfile.privKey, {sinks: [userProfile.inbox]});
    }
    
    private async createKvdbs(extKey: privfs.crypto.ecc.ExtKey): Promise<UserKvdbs> {
        const kvdbCreator = new KvdbCreator(extKey);
        const kvdbs: UserKvdbs = {
            settings: await kvdbCreator.createSettingsKvdb(),
            tagsProvider: await kvdbCreator.createTagsProviderKvdb(),
            mailFilter: await kvdbCreator.createMailFilterKvdb(),
            pkiCache: await kvdbCreator.createPkiCacheKvdb(),
            contacts: await kvdbCreator.createContactsKvdb()
        };
        return kvdbs;
    }
    
    private async createKvdbInserts(kvdbs: UserKvdbs, shareKvdb: boolean): Promise<privfs.types.db.KvdbSetEntryModel[]> {
        return shareKvdb ? [
            await UserSettingsService.createInsertion(kvdbs.settings, this.sharedKvdbExtKey)
        ] : [];
    }
    
    // ====================
    //       HELPERS
    // ====================
    
    private async createSinkCreator(masterExtKey: privfs.crypto.ecc.ExtKey) {
        const sinkEncryptor = await this.createSinkEncryptor(masterExtKey);
        return new SinkCreator(sinkEncryptor);
    }
    
    private async createSinkEncryptor(masterExtKey: privfs.crypto.ecc.ExtKey) {
        const extKey = await privfs.crypto.service.deriveHardened(masterExtKey, MailConst.SINK_ENCRYPTOR_INDEX);
        return privfs.crypto.service.getObjectEncryptor(extKey.getChainCode());
    }
    
    private createSinkProxy(from: privfs.types.message.SinkWithCreateModel, to: privfs.types.message.SinkWithCreateModel) {
        from.sink.addToProxyTo(to.sink.id);
        to.sink.addToProxyFrom(from.sink.id);
        to.data.options = to.sink.options;
        from.data.options = from.sink.options;
    }
}
