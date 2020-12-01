import {utils} from "../Types";

export class FileSizeChecker {
    
    constructor(
        public maxFileSize: utils.Option<number>
    ) {
    }
    
    hasFileSizeLimit(): boolean {
        return this.maxFileSize.value != null;
    }
    
    getFileSizeLimit(): number {
        return this.maxFileSize.value;
    }
    
    isValidFileSize(fileSize: number): boolean {
        return this.maxFileSize.value ? fileSize <= this.maxFileSize.value : true;
    }
    
    checkFileSize(fileSize: number): void {
        if (!this.isValidFileSize(fileSize)) {
            throw new Error("MAX_FILE_SIZE_EXCEEDED");
        }
    }
}