import fs = require("fs");
import path = require("path");
import * as Q from "q";

function name2key(name: string): string {
    return new Buffer(name, "binary").toString("hex");
}

export class HddStorage {
    
    dirPath: string;
    
    constructor(dirPath: string) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
        this.dirPath = dirPath;
    }
    
    getStorageType() {
        return "HDD";
    }
    
    getItem(name: string, prefix: string = ""): Q.Promise<string> {
        return Q().then(() => {
            let key = prefix+name2key(name);
            let pathStr = path.resolve(this.dirPath, key);
            if (fs.existsSync(pathStr)) {
                return fs.readFileSync(pathStr).toString("binary");
            }
            return "";
        });
    }
    
    setItem(name: string, val: string, prefix: string = ""): Q.Promise<void> {
        return Q().then(() => {
            let key = prefix+name2key(name);
            let pathStr = path.resolve(this.dirPath, key);
            fs.writeFileSync(pathStr, new Buffer(val, "binary"));
        });
    }
    
    removeItem(name: string, prefix:string = ""): Q.Promise<void> {
        return Q().then(() => {
            let key = prefix+name2key(name);
            let pathStr = path.resolve(this.dirPath, key);
            fs.unlinkSync(pathStr);
        });
    }
    
    clear(): Q.Promise<void> {
        return Q().then(() => {
            if (fs.existsSync(this.dirPath)) {
                fs.readdirSync(this.dirPath).forEach(file => {
                    let pathStr = path.resolve(this.dirPath, file);
                    if (fs.lstatSync(pathStr).isFile()) {
                        fs.unlinkSync(pathStr);
                    }
                });
            }
        });
    }
    
    length(): Q.Promise<number> {
        return Q().then(() => {
            if (fs.existsSync(this.dirPath)) {
                return fs.readdirSync(this.dirPath).filter(file => {
                    let pathStr = path.resolve(this.dirPath, file);
                    return fs.lstatSync(pathStr).isFile();
                }).length;
            }
            return 0;
        });
    }
    
    iterate(func: (key: string, value: string) => void): Q.Promise<void> {
        return Q().then(() => {
            if (fs.existsSync(this.dirPath)) {
                fs.readdirSync(this.dirPath).filter(file => {
                    let pathStr = path.resolve(this.dirPath, file);
                    if (fs.lstatSync(pathStr).isFile()) {
                        func(file, fs.readFileSync(pathStr).toString("binary"));
                    }
                }).length;
            }
        });
    }
        
}
