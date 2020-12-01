import mimeTypes = require("mime-types");

export class MimeType {
    
    static registry: {[extension: string]: string} = {};
    
    static add(extension: string, mimeType: string): void {
        MimeType.registry[extension] = mimeType;
    }
    
    static resolve(fileName: string): string {
        let index = fileName.lastIndexOf(".");
        let extl = index == -1 ? "" : fileName.substring(index).toLowerCase();
        if (extl in MimeType.registry) {
            return MimeType.registry[extl];
        }
        return mimeTypes.lookup(fileName) || "application/octet-stream";
    }
    
    static resolve2(fileName: string, mimeType: string): string {
        let index = fileName.lastIndexOf(".");
        let extl = index == -1 ? "" : fileName.substring(index).toLowerCase();
        if (extl in MimeType.registry) {
            return MimeType.registry[extl];
        }
        if (mimeType && mimeType != "application/octet-stream") {
            return mimeType;
        }
        return mimeTypes.lookup(fileName) || "application/octet-stream";
    }
}