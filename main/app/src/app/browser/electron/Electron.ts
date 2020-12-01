import {ObjectMap} from "../../../utils/ObjectMap";
import {IpcRenderer} from "./IpcRenderer";
import {IpcMain} from "./IpcMain";
import {Remote} from "./Remote";

export class Electron {
    
    ipcRenderer: IpcRenderer;
    remote: Remote;
    
    constructor(id: number, ipcMain: IpcMain, objectMap: ObjectMap) {
        this.ipcRenderer = new IpcRenderer(id, ipcMain);
        this.remote = new Remote(id, objectMap);
    }
}
