import { ThumbGenerator, GeneratedThumb } from "./ThumbGenerator";
import Q = require("q");
import { ThumbsManager } from ".";
import { Entry } from "../filetree/NewTree";
import * as Jimp from "jimp";

export class ImgGenerator extends ThumbGenerator {
    
    name: string = "ImgGenerator";
    
    protected generateCore(srcBuff: Buffer, entry: Entry): Q.Promise<GeneratedThumb> {
        let mimeType = entry.meta.mimeType ? entry.meta.mimeType : "image/jpeg";
        let jimp: typeof Jimp;
        return Q().then(() => {
            const fn = require;
            jimp = fn("jimp");
            return jimp.read(srcBuff);
        })
        .then(img => {
            return img.resize(jimp.AUTO, ThumbsManager.THUMB_HEIGHT).getBufferAsync(mimeType);
        })
        .then((buff: Buffer) => {
            return <GeneratedThumb>{
                buffer: buff,
                mimeType: entry.meta && mimeType,
            };
        });
    }
    
    canGenerate(mimeType: string): boolean {
        return (<any>mimeType).startsWith("image/") && ! mimeType.startsWith("image/svg");
    }
    
}
