import * as Q from "q";
import {utils, mail} from "../../Types";

export class UrlResourceLoader {
    
    constructor(public rootUrl: string) {
    }
    
    readResourceFromUrl(url: string, name?: string, mimetype?: string): Q.Promise<utils.Resource> {
        let defer = Q.defer<utils.Resource>();
        try {
            let xhr = new XMLHttpRequest();
            xhr.open("GET", this.rootUrl + url, true);
            xhr.responseType = "arraybuffer";
            xhr.onreadystatechange = () => {
                if (xhr.readyState == XMLHttpRequest.DONE) {
                    if (xhr.status == 0) {
                        defer.reject("server-not-responding");
                    }
                    else if (xhr.status != 200) {
                        defer.reject("invalid-status-code " + xhr.status);
                    }
                    else {
                        defer.resolve({
                            name: name || this.nameFromUrl(url),
                            mimetype: mimetype || this.contentTypeToMime(xhr.getResponseHeader("Content-Type")),
                            content: Buffer.from(<ArrayBuffer>xhr.response)
                        });
                    }
                }
            };
            xhr.send();
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
