import * as privfs from "privfs-client";

export class UUID {
    
    static generateUUID(): string {
        let uuid = privfs.crypto.service.randomBits(128).toString("hex").match(/.{4}/g);
        return [uuid.slice(0, 2).join(''), uuid.slice(2, 5).join('-'), uuid.slice(5).join('')].join('-');
    }
}