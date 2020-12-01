import * as fs from "fs";
import * as path from "path";

export class DiskUtils {
    static getDirectorySize(dirPath: string): number {
        let total: number = 0;
        if (! fs.existsSync(dirPath)) {
            return 0;
        }
        let files = fs.readdirSync(dirPath);
        files.forEach(x => {
            let filePath = path.join(dirPath, x);
            let stats = fs.lstatSync(filePath);
            if (stats.isFile()) {
                total += stats.size;
            }
            if (stats.isDirectory() && x != "." && x != "..") {
                total += DiskUtils.getDirectorySize(filePath);
            }
        })
        return total;
    }
    
    static getFilesCount(dirPath: string): number {
        let count: number = 0;
        if (! fs.existsSync(dirPath)) {
            return 0;
        }
        let files = fs.readdirSync(dirPath);
        files.forEach(x => {
            let filePath = path.join(dirPath, x);
            let stats = fs.lstatSync(filePath);
            if (stats.isFile()) {
                count++;
            }
            if (stats.isDirectory() && x != "." && x != "..") {
                count += DiskUtils.getFilesCount(filePath);
            }
        })
        return count;
    }
}