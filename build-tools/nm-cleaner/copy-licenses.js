// Przykladowe uzycie:
// node ./copy-licenses.js ../../privmx-electron/app/node_modules ../../privmx-electron/dist/assets/vendors

var fs = require("fs");
var NodePath = require("path");
var mkdirp = require('mkdirp');
var config = require("./config.json");


var baseDir = NodePath.resolve(process.argv[2]);
var outDir = NodePath.resolve(process.argv[3]);
getPackages();

function getPackages() {
    let packagesDirs = fs.readdirSync(baseDir).filter(x => fs.lstatSync(NodePath.join(baseDir, x)).isDirectory());
    console.log(packagesDirs);
    packagesDirs.forEach(x => copyLicense(NodePath.join(baseDir, x)));
}

function copyLicense(packagePath) {
    let parts = packagePath.split(NodePath.sep);
    let srcPackageDir = parts.slice(0, parts.indexOf("node_modules") + 2).join(NodePath.sep);
    let outPackageDir = srcPackageDir.replace(baseDir, outDir);
    let files = fs.readdirSync(srcPackageDir);
    files.forEach(x => {
        if (x.indexOf("license") > -1 || x.indexOf("license".toUpperCase()) > -1) {
            console.log(NodePath.join(srcPackageDir, x), " => ", NodePath.join(outPackageDir, x));
            fs.mkdirSync(outPackageDir, { recursive: true });
            fs.writeFileSync(NodePath.join(outPackageDir, x), fs.readFileSync(NodePath.join(srcPackageDir, x)));
        }
    })
}
