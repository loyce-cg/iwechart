import {ObjectMap} from "../../../utils/ObjectMap";
import {Require} from "./Require";
import {IpcMain} from "./IpcMain";

export class ElectronModule {
    
    id: number;
    ipcMain: IpcMain;
    objectMap: ObjectMap;
    
    constructor() {
        this.id = 0;
        this.ipcMain = new IpcMain();
        this.objectMap = new ObjectMap();
    }
    
    createRequire(): Require {
        return new Require(this.id++, this.ipcMain, this.objectMap);
    }
}