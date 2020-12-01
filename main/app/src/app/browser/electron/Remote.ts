import {ObjectMap} from "../../../utils/ObjectMap";

export class Remote {
    
    id: number;
    objectMap: ObjectMap;
    
    constructor(id: number, objectMap: ObjectMap) {
        this.id = id;
        this.objectMap = objectMap;
    }
    
    require(name: string): any {
        if (name == "../../app/electron/ObjectMap") {
            return this.objectMap;
        }
        else {
            throw new Error("Cannot find remote module '" + name + "'");
        }
    }
    
    getCurrentWindow(): {id: number} {
        return {id: this.id};
    }
}
