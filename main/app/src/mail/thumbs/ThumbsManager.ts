import { ImgGenerator } from "./ImgGenerator";
import { SectionService } from "../section";
import { ThumbGenerator } from "./ThumbGenerator";
import { CommonApplication } from "../../app/common";
import Q = require("q");
import { Entry } from "../filetree/NewTree";
import { lazyBuffer } from "privfs-client";
import { section } from "..";

export class ThumbsManager {
    
    static THUMBS_DIR_NAME: string = ".thumbs";
    static THUMBS_PATH: string = `/${ThumbsManager.THUMBS_DIR_NAME}`;
    static THUMB_WIDTH: number = 320;
    static THUMB_HEIGHT: number = 320;
    protected static instance: ThumbsManager;
    
    protected generators: ThumbGenerator[] = [];
    
    constructor(public app: CommonApplication) {
        ThumbsManager.instance = this;
        this.generators.push(new ImgGenerator());
    }
    
    getThumbPath(did: string, filePath: string): string {
        let idx = filePath.lastIndexOf(".");
        let ext = idx ? filePath.substr(idx) : ".jpg";
        return `${ThumbsManager.THUMBS_PATH}/${did}${ext}`;
    }
    
    copnvertFilePathToThumbPath(filePath: string, did: string): string {
        let idx = filePath.lastIndexOf(".");
        let ext = filePath.substr(idx);
        return `${ThumbsManager.THUMBS_PATH}/${did}${ext}`;
    }
    
    getThumbEntry(section: SectionService, did: string): Q.Promise<Entry> {
        return Q().then(() => {
            return section.getFileTree();
        })
        .then(tree => {
            let fileEntry = tree.collection.find(x => x.ref && x.ref.did == did);
            if (fileEntry) {
                let filePath = fileEntry.path;
                let thumbPath = this.copnvertFilePathToThumbPath(filePath, did);
                let thumbEntry = tree.collection.find(x => x.path == thumbPath);
                return thumbEntry;
            }
        });
    }
    
    getThumbDid(section: SectionService, did: string): Q.Promise<string> {
        return this.getThumbEntry(section, did)
        .then(entry => {
            if (entry) {
                return entry.ref.did;
            }
            return null;
        });
    }
    
    getThumbOsf(section: SectionService, did: string): Q.Promise<section.OpenableSectionFile> {
        return Q().then(() => {
            return this.getThumbEntry(section, did);
        })
        .then(entry => {
            if (entry) {
                return section.getFileOpenableElement(entry.path, true);
            }
        });
    }
    
    getThumbContent(section: SectionService, did: string): Q.Promise<lazyBuffer.Content> {
        return Q().then(() => {
            return this.getThumbOsf(section, did);
        })
        .then(osf => {
            if (osf) {
                return osf.getContent();
            }
        });
    }
    
    getThumbBuffer(section: SectionService, did: string): Q.Promise<Buffer> {
        return Q().then(() => {
            return this.getThumbOsf(section, did);
        })
        .then(osf => {
            if (osf) {
                return osf.getBuffer();
            }
        });
    }
    
    getOrigImageContent(section: SectionService, did: string): Q.Promise<lazyBuffer.Content> {
        return Q().then(() => {
            return section.getFileTree();
        })
        .then(tree => {
            if (!tree) {
                return null;
            }
            let entry = tree.collection.find(x => x.ref && x.ref.did == did);
            if (entry) {
                return section.getFileOpenableElement(entry.path, true);
            }
        })
        .then(osf => {
            if (!osf) {
                return null;
            }
            return osf.getContent();
        });
    }
    
    createThumb(section: SectionService, filePath: string): Q.Promise<string> {
        if (!this.app.isElectronApp()) {
            return Q(null);
        }
        return this.ensureThumbsDirExists(section)
        .then(() => {
            return this.getGeneratorFromPath(section, filePath);
        })
        .then(generator => {
            if (generator) {
                return generator.generate(section, filePath, this);
            }
            return null;
        });
    }
    
    ensureThumbsDirExists(section: SectionService): Q.Promise<boolean> {
        return section.getFileTree()
        .then(tree => {
            let entry = tree.collection.find(x => x.path == ThumbsManager.THUMBS_PATH);
            if (!entry) {
                return tree.fileSystem.mkdir(ThumbsManager.THUMBS_PATH)
                .fin(() => {
                    return tree.refreshDeep(true);
                })
                .fin(() => {
                    let entry = tree.collection.find(x => x.path == ThumbsManager.THUMBS_PATH);
                    return !!entry;
                });
            }
            return true;
        })
    }
    
    getGeneratorFromPath(section: SectionService, filePath: string): Q.Promise<ThumbGenerator> {
        return section.getFileTree()
        .then(tree => {
            let entry = tree.collection.find(x => x.path == filePath);
            if (entry && entry.meta && entry.meta.mimeType) {
                return this.getGeneratorFromMimeType(entry.meta.mimeType);
            }
            return null;
        });
    }
    
    getGeneratorFromMimeType(mimeType: string): ThumbGenerator {
        for (let generator of this.generators) {
            if (generator.canGenerate(mimeType)) {
                return generator;
            }
        }
        return null;
    }
    
    static isThumb(filePath: string, strict: boolean = false): boolean {
        return (!strict && filePath == this.THUMBS_PATH) || filePath.indexOf(this.THUMBS_PATH + "/") == 0;
    }
    
    static getInstance(): ThumbsManager {
        return this.instance;
    }
    
}
