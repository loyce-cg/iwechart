import * as PmxApi from "privmx-server-api";
import * as privfs from "privfs-client";
import { UserCreationContext, UserSinks, UserKvdbs } from "../Types";
import { ApiSerializer } from "./ApiSerializer";

export class AddUserModelBuilder {
    
    constructor(private apiSerializer: ApiSerializer) {
    }
    
    build(context: UserCreationContext) {
        const params = context.params;
        const model: PmxApi.api.admin.AddUserExModel = {
            username: <PmxApi.api.core.Username>params.username,
            email: <PmxApi.api.core.Email>params.email,
            description: <PmxApi.api.user.UserDescription>params.description,
            notificationEnabled: params.notificationEnabled,
            language: <PmxApi.api.core.Language>params.language,
            privateSectionAllowed: params.privateSectionAllowed,
            type: params.type,
            registerInfo: this.buildRegisterInfo(context),
            tasks: {
                sinks: this.getSinks(context.sinks),
                kvdbs: this.getKvdbs(context.kvdbs),
                kvdbInserts: context.kvdbInserts.map(x => this.convertKvdbInsert(x))
            },
            adminData: this.apiSerializer.getBase64(context.adminData.encrypted),
            generatedPassword: params.generatedPassword
        };
        return model;
    }
    
    private buildRegisterInfo(context: UserCreationContext) {
        const result = context.registerResult;
        const registerInfo: PmxApi.api.admin.UserRegisterInfo = {
            host: <PmxApi.api.core.Host>context.params.host,
            signature: this.apiSerializer.getEccSignature(result.signature),
            privDataL1: this.apiSerializer.getBase64(result.authParams.masterRecord.l1),
            privDataL2: this.apiSerializer.getBase64(result.authParams.masterRecord.l2),
            dataVersion: <PmxApi.api.user.PrivDataVersion>result.authParams.version,
            srp: {
                login: <PmxApi.api.user.UserLogin>result.authParams.srp.login,
                salt: this.apiSerializer.getHex(result.authParams.srp.salt),
                verifier: this.apiSerializer.getHex(result.authParams.srp.verifier),
                params: <PmxApi.api.user.SrpParams>result.authParams.srp.params,
                data: this.apiSerializer.getBase64(result.authParams.srp.encryptedL1),
                weakPassword: context.params.weakPassword
            },
            lbk: {
                pub: this.apiSerializer.getEccPublicKey(result.authParams.lbk.publicKey),
                data: this.apiSerializer.getBase64(result.authParams.lbk.encryptedL1)
            },
            keystore: {
                pub: this.apiSerializer.getPkiKeystore(context.keystore.keystore.getPublicView()),
                kis: this.apiSerializer.getPkiSignature(context.keystore.params.kis)
            }
        };
        return registerInfo;
    }
    
    private getSinks(userSinks: UserSinks) {
        const sinks = this.createSinksListFromUserSinks(userSinks);
        return sinks.map(x => this.convertSink(x.data));
    }
    
    private createSinksListFromUserSinks(userSinks: UserSinks) {
        return [userSinks.inbox, userSinks.outbox, userSinks.trash, userSinks.contact];
    }
    
    private convertSink(sink: privfs.types.message.SinkCreateModel) {
        const res: PmxApi.api.sink.CreateSinkModel= {
            sid: <PmxApi.api.sink.Sid>sink.id,
            acl: <PmxApi.api.sink.SinkAcl>sink.acl,
            data: <PmxApi.api.sink.SinkData>sink.data,
            options: <PmxApi.api.sink.SinkOptions>sink.options
        };
        return res;
    }
    
    private getKvdbs(userKvdbs: UserKvdbs) {
        const kvdbs = this.createKvdbsListFromUserKvdbs(userKvdbs);
        return kvdbs.map(x => this.convertKvdb(x.extKey));
    }
    
    private createKvdbsListFromUserKvdbs(userKvdbs: UserKvdbs) {
        return [userKvdbs.settings, userKvdbs.mailFilter, userKvdbs.pkiCache, userKvdbs.contacts];
    }
    
    private convertKvdb(kvdb: privfs.crypto.ecc.ExtKey) {
        return <PmxApi.api.kvdb.KvdbId>privfs.db.KeyValueDb.getDbId(kvdb);
    }
    
    private convertKvdbInsert(x: privfs.types.db.KvdbSetEntryModel) {
        return {
            dbId: <PmxApi.api.kvdb.KvdbId>x.dbId,
            key: <PmxApi.api.kvdb.EntryKey>x.key,
            value: x.value
        };
    }
}
