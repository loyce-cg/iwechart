import {Lang} from "../../utils/Lang";
import * as privfs from "privfs-client";
import * as Q from "q";
import {SectionService} from "./SectionService";
import { Tree, Entry } from "../filetree/NewTree";

export class LinkFileCreator {
    
    constructor(public section: SectionService) {
    }
    
    static sanitizeFilename(filename: string) {
        let result = "";
        for (let i = 0; i < filename.length; i++) {
            let code = filename.charCodeAt(i);
            if (code == 40 || code == 41 || code == 45 || code == 46 || (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || code == 95 || (code >= 97 && code <= 122)) {
                result += String.fromCharCode(code);
            }
        }
        return result;
    }
    
    uploadLinkFilesFromText(text: string, errorCallback: (e: any) => void) {
        let invalidStrings: string[] = [
            "<br>", "<br/>", "&nbsp;", "\t", "\r", "\n"
        ];
        
        // let words = text.replace("\n", " ").replace("\t", " ").replace("&nbsp;"," ").replace("<br>", " ").replace("<br/>", " ").replace("\r", " ").split(" ");
        let tempString = text;
        invalidStrings.forEach(inv => {
            tempString = tempString.replace(new RegExp(inv, 'g'), " ");
        });
        let words = tempString.split(" ");
        words.forEach(word => {
            word = Lang.endsWith(word, ".") ? word.substring(0, word.length - 1) : word;
            if (Lang.startsWith(word, "http://") ||
                Lang.startsWith(word, "https://") ||
                Lang.startsWith(word, "ftp://") ||
                Lang.startsWith(word, "www.")) {
                this.uploadLinkFile(word).fail(errorCallback);
            }
        });
    }
    
    getLinkName(url: string) {
        let splitted = url.split("/");
        let lastPart = splitted[splitted.length - 1] ? splitted[splitted.length - 1] : splitted[splitted.length - 2];
        let queryIndex = lastPart.indexOf("?");
        let fileName = queryIndex != -1 ? lastPart.substring(0, queryIndex) : lastPart;
        let fragmentIndex = lastPart.indexOf("#");
        fileName = fragmentIndex != -1 ? lastPart.substring(0, fragmentIndex) : lastPart;
        fileName = LinkFileCreator.sanitizeFilename(fileName)
        if (!fileName && Lang.endsWith(splitted[0], ":") && splitted[1] == "") {
            fileName = LinkFileCreator.sanitizeFilename(splitted[2].split(":")[0]);
        }
        if (!fileName) {
            fileName = "link";
        }
        return fileName;
    }
    
    uploadLinkFile(url: string): Q.Promise<void> {
        return Q().then(() => {
            return this.fileLinkExists(url);
        })
        .then(exists => {
            if (exists) {
                return;
            }            
            let content = privfs.lazyBuffer.Content.createFromText("[InternetShortcut]\nURL=" + url, "application/internet-shortcut", this.getLinkName(url) + ".url");
            return this.uploadSimpleFile(content);        
        })
    }
    
    uploadSimpleFile(content: privfs.lazyBuffer.IContent): Q.Promise<void> {
        if (this.section == null || !this.section.hasFileModule()) {
            return Q();
        }
        return Q().then(() => {
            return this.section.getFileSystem();
        })
        .then(fs => {
            return fs.createEx("/" + content.getName(), content, true).thenResolve(null);
        });
    }

    fileLinkExists(url: string): Q.Promise<boolean> {
        let existList: Q.Promise<boolean>[] = [];
        return Q().then(() => {
            return this.section.getFileTree()
        })
        .then(tree => {
            existList = tree.collection.list.map(entry => entry.isFile() && entry.meta.mimeType == "application/internet-shortcut" && this.hasEntryContentGivenUrl(entry, url));
            return Q.all(existList);
        })
        .then(res => {
            return res.filter(x => x == true).length > 0;
        })
    }


    hasEntryContentGivenUrl(entry: Entry, url: string): Q.Promise<boolean> {
        return Q().then(() => {
            return this.section.getFileOpenableElement(entry.path, false, false)
        })
        .then(element => {
            return element.getContent();
        })
        .then(content => {
            let text = content.buffer.toString("utf8");
            let splitted = text.split("\n");
            if (splitted.length >= 2) {
                return splitted[1].substring(4) == url;
            }
            else {
                return false;
            }
        })
    }
}