import { BufferUtils } from "./BufferUtils";
import * as PrivmxCrypto from "privmx-crypto";
import Ecc = PrivmxCrypto.ecc;

export class CryptoSerializer {
    
    static encode(value: any, copyBuffers: boolean): any {
        if (typeof(value) !== "object" || value == null) {
            return value;
        }
        if (Array.isArray(value))  {
            return value.map(v => {
                return this.encode(v, copyBuffers);
            });
        }
        if (value instanceof Buffer || value instanceof ArrayBuffer || value instanceof Uint8Array) {
            return {
                _type: "buffer",
                _value: value instanceof ArrayBuffer ? value : BufferUtils.bufferToArray(value, copyBuffers)
            };
        }
        let type = "";
        if (value instanceof Ecc.PublicKey) {
            type = "eccpub";
        }
        else if (value instanceof Ecc.PrivateKey) {
            type = "eccpriv";
        }
        else if (value instanceof Ecc.ExtKey) {
            type = "eccext";
        }
        if (type !== "") {
            return {
                _type: type,
                _value: BufferUtils.bufferToArray(value.serialize(), false)
            };
        }
        let res: {[name: string]: any} = {};
        for (let key in value) {
            res[key] = this.encode(value[key], copyBuffers);
        }
        return res;
    }
    
    static decode<T = any>(value: any, copyBuffers: boolean): T {
        if (typeof(value) !== "object" || value == null) {
            return value;
        }
        if (Array.isArray(value)) {
            return <T><any>value.map(v => {
                return this.decode(v, copyBuffers);
            });
        }
        if (value._type && value._value && Object.keys(value).length === 2) {
            switch (value._type) {
                case "buffer":
                    return <T><any>BufferUtils.arrayToBuffer(value._value, copyBuffers);
                case "eccpub":
                    return <T><any>Ecc.PublicKey.deserialize(BufferUtils.arrayToBuffer(value._value, false));
                case "eccpriv":
                    return <T><any>Ecc.PrivateKey.deserialize(BufferUtils.arrayToBuffer(value._value, false));
                case "eccext":
                    return <T><any>Ecc.ExtKey.deserialize(BufferUtils.arrayToBuffer(value._value, false));
            }
            throw new Error("Invalid type " + value._type);
        }
        let res: {[name: string]: any} = {};
        for (var key in value) {
            res[key] = this.decode(value[key], copyBuffers);
        }
        return <T><any>res;
    }
}
