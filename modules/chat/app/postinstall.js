const fs = require("fs");

// Patch Olm
console.log("Patching Olm...");
const olmPath = "node_modules/olm/";
const olmWasm = fs.readFileSync(olmPath + "olm.wasm").toString("base64");
const olmJs = fs.readFileSync(olmPath + "olm.js", "utf8");
let patchedOlmJs = olmJs.replace("olm.wasm", "data:application/octet-stream;base64," + olmWasm);
fs.writeFileSync(olmPath + "olm.js", patchedOlmJs);
console.log("Patched Olm");
