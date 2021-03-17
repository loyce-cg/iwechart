import {Starter} from "./starter/Starter";
import {LinuxStarter} from "./starter/LinuxStarter";
import {WinStarter} from "./starter/WinStarter";
import {MacStarter} from "./starter/MacStarter";
import * as http from "http";
import * as https from "https";
'use strict';

let xhr2 = require("xhr2");
xhr2.nodejsSet({
    httpAgent: new http.Agent({keepAlive: true}),
    httpsAgent: new https.Agent({keepAlive: true}),
});


export let starter: Starter;
switch (process.platform) {
    case "linux":
        starter = new LinuxStarter();
        break;
    case "win32":
        starter = new WinStarter();
        break;
    case "darwin":
        starter = new MacStarter();
        break;
}

if (starter) {
    starter.run();
}

// for chrome://inspect to get instance of the node app:
// let app = require("./app/out/app/electron/start.js").starter.instance
