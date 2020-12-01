import tar = require("tar-stream");
import * as Q from "q";
import * as privfs from "privfs-client";

export interface TarPack {
    entry(options: {name: string}, data: string|Buffer): void;
}

export class TarHelper {
    
    static withTar(func: (tar: TarPack) => any): Q.Promise<privfs.lazyBuffer.Content> {
        return Q().then(() => {
            let pack = tar.pack();
            let chunks: Buffer[] = [];
            pack.on("data", chunk => {
                chunks.push(chunk);
            });
            return Q().then(() => {
                return func(pack);
            })
            .then(() => {
                let defer = Q.defer();
                pack.on("end", defer.resolve);
                pack.finalize();
                return defer.promise;
            })
            .then(() => {
                return privfs.lazyBuffer.Content.createFromBuffers(chunks, "application/x-tar", "out.tar");
            })
        });
    }
}