import { ThumbGenerator, GeneratedThumb } from "./ThumbGenerator";
import Q = require("q");
import { ThumbsManager } from ".";
import { Entry } from "../filetree/NewTree";
import * as Jimp from "jimp";
import { CommonApplication } from "../../app/common";

export class PreGeneratedGenerator extends ThumbGenerator {
    
    name: string = "PreGeneratedGenerator";
    
    constructor(public app: CommonApplication, private preGeneratedThumb: GeneratedThumb) {
        super(app);
    }
    
    protected generateCore(srcBuff: Buffer, entry: Entry): Q.Promise<GeneratedThumb> {
        let jimp: typeof Jimp;
        return Q().then(() => {
            const fn = require;
            jimp = fn("jimp");
            return jimp.read(this.preGeneratedThumb.buffer);
        })
        .then(img => {
            return img.resize(jimp.AUTO, ThumbsManager.THUMB_HEIGHT).getBufferAsync(this.preGeneratedThumb.mimeType);
        })
        .then((buff: Buffer) => {
            return <GeneratedThumb>{
                buffer: buff,
                mimeType: this.preGeneratedThumb.mimeType,
            };
        });
    }
    
    canGenerate(mimeType: string): boolean {
        return true;
    }
    
}
