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

let starterClass: Starter;
let starter;
switch (process.platform) {
    case "linux":
        starterClass = new LinuxStarter();
        break;
    case "win32":
        starterClass = new WinStarter();
        break;
    case "darwin":
        starterClass = new MacStarter();
        break;
}

if (starterClass) {
    // starter = new starterClass();
    starterClass.run();
}
