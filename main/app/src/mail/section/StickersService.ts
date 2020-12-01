import {section} from "../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";

export class StickersService {
    
    stickerToHashMap: {[sticker: string]: string};
    hashToStickerMap: {[hash: string]: string};
    initPromise: Q.Promise<void>;
    
    constructor(
        public key: Buffer,
        public stickersProvider: section.StickersProvider
    ) {
        this.stickerToHashMap = {};
        this.hashToStickerMap = {};
    }
    
    init(): Q.Promise<void> {
        if (this.initPromise == null) {
            this.initPromise = Q.all(this.stickersProvider.getStickers().map(sticker => {
                return this.getStickerHash(sticker).then(hash => {
                    this.stickerToHashMap[sticker] = hash;
                    this.hashToStickerMap[hash] = sticker;
                });
            })).thenResolve(null);
        }
        return this.initPromise;
    }
    
    getStickerHash(sticker: string): Q.Promise<string> {
        if (!this.key) {
            return Q.reject("Missing stickers key");
        }
        return privfs.crypto.service.hmacSha256(this.key, new Buffer(sticker, "utf8")).then(hash => {
            return hash.toString("hex").substr(0, 32);
        });
    }
    
    encodeSticker(sticker: string): Q.Promise<string> {
        return Q().then(() => {
            if (sticker in this.stickerToHashMap) {
                return this.stickerToHashMap[sticker];
            }
            return this.getStickerHash(sticker);
        });
    }
    
    encodeStickers(stickers: string[]): Q.Promise<string[]> {
        return Q.all(stickers.map(sticker => {
            return this.encodeSticker(sticker);
        }));
    }
    
    decodeSticker(sticker: string): string {
        return this.hashToStickerMap[sticker];
    }
    
    decodeStickers(stickers: string[]): string[] {
        return stickers.map(sticker => {
            return this.decodeSticker(sticker);
        });
    }
}