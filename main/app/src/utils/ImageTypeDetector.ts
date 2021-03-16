import {app} from "../Types";
export type NumericEnumerable = {[index: number]: number}

export interface DetectionResult {
    ext: string;
    mime: string;
}

export class ImageTypeDetector {
    
    static MAGIC_HEADER_MAX_LENGTH = 8;
    
    static check(header: number[], data: NumericEnumerable) {
        for (let i = 0; i < header.length; i++) {
            if (header[i] !== data[i]) {
                return false;
            }
        }
        return true;
    }
    
    static detect(data: NumericEnumerable): DetectionResult {
        if (ImageTypeDetector.check([0xFF, 0xD8, 0xFF], data)) {
            return {
                ext: "jpg",
                mime: "image/jpeg"
            };
        }
        if (ImageTypeDetector.check([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], data)) {
            return {
                ext: "png",
                mime: "image/png"
            };
        }
        if (ImageTypeDetector.check([0x47, 0x49, 0x46], data)) {
            return {
                ext: "gif",
                mime: "image/gif"
            };
        }
        if (ImageTypeDetector.check([0x49, 0x49, 0x2A, 0x0], data) || ImageTypeDetector.check([0x4D, 0x4D, 0x0, 0x2A], data)) {
            return {
                ext: "tif",
                mime: "image/tiff"
            };
        }
        if (ImageTypeDetector.check([0x42, 0x4D], data)) {
            return {
                ext: "bmp",
                mime: "image/bmp"
            };
        }
        return null;
    }
    
    static extractBufferFromDatatUrl(dataUrl: string): Buffer {
        let comaIndex = dataUrl.indexOf(",");
        return new Buffer(dataUrl.substring(comaIndex + 1), "base64");
    }
    
    static createDataUrlFromBuffer(buffer: Buffer): string {
        let mime = ImageTypeDetector.detect(buffer);
        return "data:" + (mime == null ? "image/jpeg" : mime.mime) + ";base64," + buffer.toString("base64");
    }
    
    static getFirstBytesFromBase64(base64: string, length: number): Buffer {
        let base64Length = (Math.floor(length / 3) + (length % 3 == 0 ? 0 : 1)) * 4;
        return new Buffer(base64.substr(0, base64Length), "base64");
    }
    
    static createDataUrlFromBase64(base64: string): string {
        let header = ImageTypeDetector.getFirstBytesFromBase64(base64, ImageTypeDetector.MAGIC_HEADER_MAX_LENGTH);
        let mime = ImageTypeDetector.detect(header);
        return "data:" + (mime == null ? "image/jpeg" : mime.mime) + ";base64," + base64;
    }

    static createBlobDataFromBase64(base64: string): app.BlobData {
        let header = ImageTypeDetector.getFirstBytesFromBase64(base64, ImageTypeDetector.MAGIC_HEADER_MAX_LENGTH);
        let mime = ImageTypeDetector.detect(header);
        return {
            mimetype: mime == null ? "image/jpeg" : mime.mime,
            buffer: Buffer.from(base64, "base64")
        }
    }

}
