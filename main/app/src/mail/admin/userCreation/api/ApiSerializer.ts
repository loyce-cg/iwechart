import * as PmxApi from "privmx-server-api";
import * as privfs from "privfs-client";

export class ApiSerializer {
    
    getEccPublicKey(pubKey: privfs.crypto.ecc.PublicKey) {
        return <PmxApi.api.core.EccPubKey>pubKey.toBase58DER();
    }
    
    getEccSignature(signature: Buffer) {
        return <PmxApi.api.core.EccSignature>signature.toString("base64");
    }
    
    getPkiKeystore(keystore: privfs.pki.Types.keystore.IKeyStore2) {
        return <PmxApi.api.pki.PkiKeystore>keystore.serialize().toString("base64");
    }
    
    getPkiSignature(keystore: privfs.pki.Types.keystore.ISignature2) {
        return <PmxApi.api.pki.PkiSignature>keystore.serialize().toString("base64");
    }
    
    getHex(buffer: Buffer) {
        return <PmxApi.api.core.Hex>buffer.toString("hex");
    }
    
    getBase64(buffer: Buffer) {
        return <PmxApi.api.core.Base64>buffer.toString("base64");
    }
}
