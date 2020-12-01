import * as privfs from "privfs-client";
import { SetUserlbkModel } from "./Types";

export class AdminApi {
    constructor(
        public gateway: privfs.gateway.RpcGateway
    ) {
    }
    
    setUserLbk(model: SetUserlbkModel): Q.Promise<"OK"> {
        return this.gateway.request("setUserLbk", model);
    }
}