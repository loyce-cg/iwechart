import {app} from "../Types";

export class WebUtils {
    
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