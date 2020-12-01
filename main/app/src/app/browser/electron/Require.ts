import {ObjectMap} from "../../../utils/ObjectMap";
import {Electron} from "./Electron";
import {IpcMain} from "./IpcMain";

export class Require {
    
    id: number;
    electron: Electron;
    requireBinded: Function;
    
    constructor(id: number, ipcMain: IpcMain, objectMap: ObjectMap) {
        this.id = id;
        this.electron = new Electron(id, ipcMain, objectMap);
        this.requireBinded = this.require.bind(this);
    }
    
    require(name: string): any {
        if (name == "electron") {
            return this.electron;
        }
        else {
            throw new Error("Cannot find electron module '" + name + "'");
        }
    }
}

