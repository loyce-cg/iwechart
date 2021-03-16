const process = require("process");
const { execSync } = require("child_process");
const fs = require("fs");

function exec(cmd) {
    execSync(cmd, {stdio: "inherit"});
}

const quickInstall = process.env.QUICK_POST_INSTALL == "true"
const mainDir = process.cwd();
const cacheDir = process.env.HOME + "/.npm/custom-cache";

console.log(
`======================
     html2pdf.js
======================`);

const html2pdfDir = mainDir + "/node_modules/html2pdf.js";
const version = JSON.parse(fs.readFileSync(html2pdfDir + "/package.json", "utf8")).version;
const html2pdfCacheDir = cacheDir + "/packages/html2pdf.js/" + version;

if (quickInstall && fs.existsSync(html2pdfCacheDir)) {
    console.log("html2pdf.js cached bundle present (" + html2pdfCacheDir + "), copying from cache...");
    exec("cp -r -v " + html2pdfCacheDir + "/* " + html2pdfDir);
}
else {
    if (quickInstall) {
        console.log("html2pdf.js cached bundle missing (" + html2pdfCacheDir + "), building...")
    }
    
    process.chdir(html2pdfDir);
    exec("npm run build");
    process.chdir(mainDir);
    
    if (quickInstall) {
        console.log("html2pdf.js copying bundle to cache (" + html2pdfCacheDir + ") ...");
        exec("mkdir -p " + html2pdfCacheDir);
        exec("cp -r -v " + html2pdfDir + "/dist" + " " + html2pdfCacheDir);
    }
}

console.log(
`======================
   electron-rebuild
======================`);

const electron = {version: "11.3.0", modules: ["clipboard-files", "sqlite3"]};

function getElectronBindingVersion(v) {
    while (v.endsWith(".0")) {
        v = v.substr(0, v.length - 2)
    }
    return v;
}

const electronBindingVersion = getElectronBindingVersion(electron.version);
const electronBindingName = "electron-v" + electronBindingVersion + "-" + require("os").platform() + "-" + require("os").arch();
const modules = electron.modules.map(moduleName => {
    const version = JSON.parse(fs.readFileSync(mainDir + "/node_modules/" + moduleName + "/package.json", "utf8")).version;
    return {
        name: moduleName,
        bindingDir: mainDir + "/node_modules/" + moduleName + "/lib/binding/" + electronBindingName,
        cacheDir: cacheDir + "/binding/" + electronBindingName + "/" + moduleName + "/" + version,
        version: version
    };
});

let scheduled = false;
if (quickInstall) {
    for (const module of modules) {
        if (fs.existsSync(module.cacheDir)) {
            console.log(module.name + " cached binding present (" + module.cacheDir + "), copying from cache...");
            exec("mkdir -p " + module.bindingDir);
            exec("cp -r -v " + module.cacheDir + "/* " + module.bindingDir);
            console.log("----");
            module.copied = true;
        }
        else {
            console.log(module.name + " cached binding missing (" + module.cacheDir + "), rebuild scheduled");
            scheduled = true;
        }
    }
}
if (!quickInstall || scheduled) {
    exec(mainDir + "/node_modules/.bin/electron-rebuild -v " + electron.version);
    
    if (quickInstall) {
        for (const module of modules) {
            if (!module.copied) {
                console.log(module.name + " copying binding to cache (" + module.cacheDir + ") ...");
                exec("mkdir -p " + module.cacheDir);
                exec("cp -r -v " + module.bindingDir + "/* " + module.cacheDir);
                console.log("----");
            }
        }
    }
}
