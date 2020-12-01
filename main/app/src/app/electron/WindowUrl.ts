export class WindowUrl {
    
    static PROTOCOL = "https";
    
    static base64url(buffer: Buffer) {
        return buffer.toString("base64").replace(/\//g,'_').replace(/\+/g,'-').replace(/=/g, '');
    }
    
    static buildUrl(host: string, mimeType: string, buffer: Buffer) {
        return WindowUrl.buildUrlCore(WindowUrl.PROTOCOL, host, mimeType, buffer);
    }
    
    static buildUrlCore(protocol: string, host: string, mimeType: string, buffer: Buffer) {
        let url = protocol + "://" + host + "/base64?m=" + mimeType.replace("/", "_") + "&d=" + this.base64url(buffer);
        // console.log("WindowUrl.buildUrl", url.substr(0, 100) + "...");
        return url;
    }
    
    static cut(str: string, q: string, startPos: number) {
        let index = str.indexOf(q, startPos);
        return {
            index: index,
            str: index == -1 ? null : str.substring(startPos, index)
        };
    }
    
    static parseUrl(url: string) {
        let proto = WindowUrl.cut(url, "://", 0);
        let domain = WindowUrl.cut(url, "/", proto.index + 3);
        let path = WindowUrl.cut(url, "?", domain.index);
        let m = WindowUrl.cut(url, "&", path.index + 1);
        let d = url.substr(m.index + 3);
        return {
            protocol: proto.str,
            host: domain.str,
            path: path.str,
            m: m.str.substr(2).replace("_", "/"),
            d: d
        };
    }
}