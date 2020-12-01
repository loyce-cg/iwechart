export interface SplittedFileName {
    original: string;
    name: string;
    ext: string;
    extl: string;
}

export interface ParsedPath {
    name: SplittedFileName;
    path: string;
    parts: string[];
    isHiddenExt: boolean;
    formatted: string;
}

export class Path {
    
    static hiddenExts: string[] = [".gif", ".png", ".ico", ".bmp", ".dib", ".tiff", ".tif", ".jpg", ".jpeg", ".jpe", ".jif", ".jfif", ".jfi"];
    
    static splitFileName(n: string): SplittedFileName {
        let index = n.lastIndexOf(".");
        let name = index == -1 ? n : n.substring(0, index);
        let ext = index == -1 ? "" : n.substring(index);
        let extl = ext.toLowerCase();
        return {
            original: n,
            name: name,
            ext: ext,
            extl: extl
        };
    }
    
    static parsePath(path: string): ParsedPath {
        let splitted = path.split("/");
        let name = this.splitFileName(splitted[splitted.length - 1]);
        let result: ParsedPath = {
            name: name,
            path: path,
            parts: splitted,
            isHiddenExt: Path.hiddenExts.indexOf(name.extl) != -1,
            formatted: splitted.length == 1 ? "/" : ""
        };
        for (let i = 1; i < splitted.length - 1; i++) {
            result.formatted += splitted[i] + "/";
        }
        if (splitted.length > 1) {
            result.formatted += result.isHiddenExt ? result.name.name : result.name.original;
        }
        return result;
    }
}
