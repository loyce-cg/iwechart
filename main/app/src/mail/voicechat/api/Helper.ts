import * as ByteBuffer from "bytebuffer";
import { Cipher } from "./Types";

export class Helper {
    
    static async aesGcmEncrypt(buffer: ByteBuffer, akey: ArrayBuffer) {
        const iv = <Uint8Array>crypto.getRandomValues(new Uint8Array(12));
        const alg = {name: "AES-GCM", iv: iv};
        const key = await crypto.subtle.importKey("raw", akey, alg.name, false, ["encrypt"]);
        const ptUint8 = new Uint8Array(buffer.toArrayBuffer());
        const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8);
        return {iv: ByteBuffer.wrap(iv), ct: ByteBuffer.wrap(ctBuffer)};
    }
    
    static async aesGcmDecrypt(cipher: Cipher, akey: ArrayBuffer) {
        try {
            const iv = new Uint8Array(cipher.iv.toArrayBuffer());
            const alg = {name: "AES-GCM", iv: iv};
            const key = await crypto.subtle.importKey("raw", akey, alg.name, false, ["decrypt"]);
            const ctUint8 = new Uint8Array(cipher.ct.toArrayBuffer())
            const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8);
            return ByteBuffer.wrap(plainBuffer);
        }
        catch (e) {
            Helper._log("error during decrypt of data", cipher, "with key", akey, "result: ", e);
        }
    }
    
    static _log(...params: any[]) {
        console.log("PrivMX-STREAMS:", ...params);
    }
}