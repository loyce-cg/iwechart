
import * as Q from "q";
import * as privfs from "privfs-client";
import * as JSZip from "jszip";

export interface ZipPack {
    file(name: string, data: string|Buffer): void;
}

export class ZipHelper {
    
    static withZip(func: (zip: ZipPack) => any): Q.Promise<privfs.lazyBuffer.Content> {
        return Q().then(() => {
            let zip = JSZip();
            return Q().then(() => {
                return func(zip);
            })
            .then(() => {
                return zip.generateAsync({ type: "base64", compression: "DEFLATE" });
            })
            .then(buffer => {
                return privfs.lazyBuffer.Content.createFromBase64(buffer, "application/zip", "out.zip");
            })
        });
    }
}