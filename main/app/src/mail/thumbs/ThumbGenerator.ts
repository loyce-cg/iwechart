import { SectionService } from "../section";
import Q = require("q");
import * as privfs from "privfs-client";
import { ThumbsManager } from ".";
import { Entry } from "../filetree/NewTree";
import { section } from "..";

export interface GeneratedThumb {
    buffer: Buffer;
    mimeType: string;
}

export abstract class ThumbGenerator {
    
    constructor() {
    }
    
    generate(section: SectionService, filePath: string, manager: ThumbsManager): Q.Promise<string> {
        return Q().then(() => {
            return section.getFileTree();
        })
        .then(tree => {
            if (!tree) {
                throw "no-filetree";
            }
            let entry = tree.collection.find(x => x.path == filePath);
            if (!entry) {
                throw "no-entry";
            }
            if (!entry.ref || !entry.ref.did) {
                throw "broken-entry";
            }
            
            let thumbPath = manager.getThumbPath(entry.ref.did, filePath);
            return section.getFileOpenableElement(filePath, true).then(osf => {
                return osf.getBuffer();
            })
            .then(srcBuff => {
                return Q.all([
                    this.generateCore(srcBuff, entry),
                    section.getFileOpenableElement(thumbPath, true).fail(() => null).then((osf: section.OpenableSectionFile) => osf),
                ]);
            })
            .then(([thumb, existingThumbOsf]) => {
                let idx = thumbPath.lastIndexOf("/");
                let thumbDirPath = thumbPath.substr(0, idx + 1);
                let thumbFileName = thumbPath.substr(idx + 1);
                let content = privfs.lazyBuffer.Content.createFromBuffer(thumb.buffer, thumb.mimeType, thumbFileName);
                if (existingThumbOsf) {
                    return existingThumbOsf.save(content).thenResolve(null);
                }
                else {
                    return section.uploadFile({
                        data: content,
                        path: thumbDirPath,
                        noMessage: true,
                        conflictBehavior: {
                            overwriteFile: true,
                        },
                    });
                }
            })
            .then(() => {
                return section.getChatModule().sendSaveFileMessage(section.getId(), thumbPath);
            })
            .fail(e => {
                console.log("Error generating thumbnail:", e);
            })
            .then(() => {
                return thumbPath;
            });
        })
    }
    
    protected abstract generateCore(srcBuff: Buffer, entry: Entry): Q.Promise<GeneratedThumb>;
    
    abstract canGenerate(mimeType: string): boolean;
    
}
