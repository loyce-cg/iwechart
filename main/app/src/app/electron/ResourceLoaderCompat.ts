import * as Q from "q";
import {utils, mail} from "../../Types";
import {AssetsManager} from "../common/AssetsManager";
import * as nodeFs from "fs";

export class UrlResourceLoader {
    
    constructor(public assetsManager: AssetsManager) {
    }
    
    readResourceFromUrl(url: string, name?: string, mimetype?: string): Q.Promise<utils.Resource> {
        let defer = Q.defer<utils.Resource>();
        
        try {
            const fName = this.assetsManager.getAsset(url, true);
            nodeFs.readFile(fName, null, (err: any, data: Buffer) => {
                if (data) {
                    defer.resolve({
                        name: name,
                        mimetype: mimetype,
                        content: data
                    });
                }
                else {
                    defer.reject(err);
                }
            })
        }
        catch (e) {
            defer.reject(e);
        }
        return defer.promise;
    }
    
    nameFromUrl(url: string): string {
        let urlParts = url.split("/");
        return urlParts[urlParts.length - 1];
    }
    
    contentTypeToMime(contentType: string): string {
        let parts = contentType.split(";");
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i].trim();
            if (/^[a-z]+\/[a-z]+$/.test(part)) {
                return part;
            }
        }
        return "";
    }
}

export class MailResourceLoader implements mail.MailResourceLoader {
    
    constructor(public urlResourceLoader: UrlResourceLoader) {
    }
    
    getResource(name: string): Q.Promise<utils.Resource> {
        if (name == "welcomeMailPic") {
            return this.urlResourceLoader.readResourceFromUrl("themes/default/images/welcome-mail-pic.png", "privmx-logo.png", "image/png");
        }
        return Q.reject("not-found");
    }
    
    getResourceSafe(name: string, onFailResource?: utils.Resource): Q.Promise<utils.Resource> {
        return this.getResource(name).fail(e => onFailResource);
    }
}
