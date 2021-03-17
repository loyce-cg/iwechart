import {app} from "../Types";

export interface NamedObjectURL {
    url: string;
    counter: number;
}

export class NamedObjectUrlManager {
    
    private blobsRefs: {[name: string]: NamedObjectURL} = {};
    
    createNamedObjectURL(name: string, data: app.BlobData): string {
        return this.getOrCreateNamedObjectURL(name, () => new Blob([data.buffer], {type: data.mimetype}));
    }
    
    createNamedObjectURLFromBlob(name: string, blobData: Blob): string {
        return this.getOrCreateNamedObjectURL(name, () => blobData);
    }
    
    private getOrCreateNamedObjectURL(name: string, onCreate: () => Blob): string {
        if (name in this.blobsRefs) {
            const entry = this.blobsRefs[name];
            entry.counter++;
            return entry.url;
        }
        this.blobsRefs[name] = {
            counter: 1,
            url: URL.createObjectURL(onCreate())
        }
        return this.blobsRefs[name].url;
    }
    
    revokeNamedObjectURL(name: string) {
        if (name in this.blobsRefs) {
            const obj = this.blobsRefs[name];
            obj.counter--;
            if (obj.counter == 0) {
                URL.revokeObjectURL(obj.url);
                delete this.blobsRefs[name];
            }
        }
        else {
            console.error("Cannot revoke non-existant objectURL with name", name);
        }
    }
}

export class WebUtils {
    
    private static namedObjectUrlManager = new NamedObjectUrlManager();
    
    static createFileHandle(file: File): app.FileHandle {
        if ((<app.ElectronBrowserFile>file).path) {
            return <app.ElectronFileHandle>{
                handleType: "electron",
                path: (<app.ElectronBrowserFile>file).path,
                type: file.type
            }
        }
        return <app.BrowserFileHandle>{
            handleType: "browser",
            file: file
        };
    }
    
    static createObjectURL(data: app.BlobData): string {
        let blob = new Blob([data.buffer], {type: data.mimetype});
        return URL.createObjectURL(blob);
    }
    
    static createNamedObjectURL(name: string, data: app.BlobData): string {
        return WebUtils.namedObjectUrlManager.createNamedObjectURL(name, data);
    }
    
    static createNamedObjectURLFromBlob(name: string, blobData: Blob): string {
        return WebUtils.namedObjectUrlManager.createNamedObjectURLFromBlob(name, blobData);
    }
    
    static revokeNamedObjectURL(name: string) {
        return WebUtils.namedObjectUrlManager.revokeNamedObjectURL(name);
    }
    
    static hasCtrlModifier(e: MouseEvent|KeyboardEvent): boolean {
        return e.ctrlKey || e.metaKey;
    }
    
    static hasShiftModifier(e: MouseEvent|KeyboardEvent): boolean {
        return e.shiftKey;
    }
    
    static hasAltModifier(e: MouseEvent|KeyboardEvent): boolean {
        return e.altKey;
    }
}
