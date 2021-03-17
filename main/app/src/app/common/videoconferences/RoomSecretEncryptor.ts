import * as privfs from "privfs-client";
import * as Q from "q";
import { SectionService } from "../../../mail/section/SectionService";
import { RoomMetadata } from "./VideoConferencesService";

export interface RoomSecretData {
    domain: string;
    roomName: string;
    roomPassword: string;
    encryptionKey: string;
    encryptionIV: string;
    metadata: RoomMetadata;
}

export class RoomSecretEncryptor {
    
    static encryptWithSectionKey(data: RoomSecretData, section: SectionService): Q.Promise<string> {
        return Q().then(() => {
            return section.getVideoEncryptionKey();
        })
        .then(key => {
            return RoomSecretEncryptor.encrypt(data, key);
        });
    }
    
    static decryptWithSectionKey(roomSecret: string, section: SectionService): Q.Promise<RoomSecretData> {
        return Q().then(() => {
            return section.getVideoEncryptionKey();
        })
        .then(key => {
            return RoomSecretEncryptor.decrypt(roomSecret, key);
        });
    }
    
    static encrypt(data: RoomSecretData, key: Buffer): Q.Promise<string> {
        return Q().then(() => {
            const raw = Buffer.from(JSON.stringify(data), "utf8");
            return privfs.crypto.service.privmxEncrypt(privfs.crypto.service.privmxOptAesWithSignature(), raw, key);
        })
        .then(cipher => {
            return cipher.toString("base64");
        });
    }
    
    static decrypt(roomSecret: string, key: Buffer): Q.Promise<RoomSecretData> {
        return Q().then(() => {
            const raw = Buffer.from(roomSecret, "base64");
            return privfs.crypto.service.privmxDecrypt(privfs.crypto.service.privmxOptSignedCipher(), raw, key);
        })
        .then(data => {
            return JSON.parse(data.toString("utf8"));
        });
    }
}