var fs = require("fs");
var NodePath = require("path");
var mkdirp = require('mkdirp');
var config = require("./config.json");

var plugins = [
  "notes2", "chat", "calendar", "apps", "editor", "twofa", "tasks"
];

// var baseDir = "/Users/kamil/projects/privmx/privfs-mail-client/app";
if (process.argv.length < 4) {
    console.log("Incorrect parameters.\nUsage: nmcleaner dir_with_node_modules out_dir\n");
    process.exit(1);
}
var baseDir = NodePath.resolve(process.argv[2]);
var outDir = NodePath.resolve(process.argv[3]);
var processPlugin = process.argv.length == 5;
var pluginName;
if (processPlugin) {
    plugins.forEach(x => {
        if (baseDir.indexOf(x) > -1) {
            pluginName = x;
            return;
        }
    });
}
console.log("Processing: ", baseDir);
// var filesToCheck = [
//     {type: "file", path: "/Users/kamil/projects/privmx/privfs-mail-client/app/out/app/electron/start.js"},
//     {type: "file", path: "/Users/kamil/projects/privmx/privfs-mail-client/app/node_modules/pson/dist/PSON.js"},
//     {type: "file", path: "/Users/kamil/projects/privmx/privfs-mail-client/app/node_modules/sqlite3/lib/binding/electron-v4.1-darwin-x64/node_sqlite3.node"},
//     {type: "file", path: "/Users/kamil/projects/privmx/privfs-mail-client/app/out/build/core-electron.js"}
// ];
var filesToCheck = processPlugin ?
[
    {type: "file", path: "build/main.js"}
] : config.filesToCheck.common.concat(config.filesToCheck[process.platform]);

if (processPlugin && config.filesToCheck.plugins[pluginName]) {
    filesToCheck = filesToCheck.concat(config.filesToCheck.plugins[pluginName].common);
    if (config.filesToCheck.plugins[pluginName][process.platform]) {
          filesToCheck = filesToCheck.concat(config.filesToCheck.plugins[pluginName][process.platform]);
    }
}


filesToCheck.forEach(x => x.path = NodePath.join(baseDir, x.path));


var libPackages = config.libPackages.common.concat(config.libPackages[process.platform]);


// var outDir = "/Users/kamil/projects/nm-cleaner/out";

var checkedFiles = {
    // "/home/lukas/Work/Projects/privfs/privmx/privfs-mail-client/app/node_modules/linkifyjs/lib/linkify/index.js": true,
    // "/home/lukas/Work/Projects/privfs/privmx/privfs-mail-client/app/node_modules/elliptic/lib/elliptic/index.js": true,
    // "/home/lukas/Work/Projects/privfs/privmx/privfs-mail-client/app/node_modules/hash.js/lib/hash/index.js": true
};
var checkedModules = {};
// var libPackages = ["os", "path", "fs", "util", "crypto", "electron", "assert", "events", "constants",
//     "child_process", "dns", "tty", "stream", "zlib", "tls", "net", "querystring", "url",
//     "http", "https", "vm", "osx-temperature-sensor", "memcpy", "xor4096"];

function getOccuriencies(str, beg, end) {
    var res = [];
    var index = 0;
    while (true) {
        var bIndex = content.indexOf(beg, index);
        if (bIndex == -1) {
            break;
        }
        var eIndex = content.indexOf(end, bIndex + beg.length);
        if (eIndex == -1) {
            console.log("Warning cannnot find end str at " + index);
            break;
        }
        var p = content.substring(bIndex + beg.length, eIndex);
        if (!/^[a-zA-Z0-9\/\-\._@]*$/.test(p)) {
            console.log("\n\nRequire do not match regex " + bIndex + " " + eIndex + " " + content.substr(bIndex, 20) + " " + p + "\n\n");
            //process.exit();
        }
        else {
            res.push(p);
        }
        index = eIndex + end.length;
    }
    return res;
}

function saveContent(contentBin, path) {
    var outPath = path.replace(baseDir, outDir);
    console.log("saveContent outPath", outPath);
    mkdirp.sync(NodePath.dirname(outPath));
    fs.writeFileSync(outPath, contentBin);
}

function resolveRequire(fullPath) {
    var jsFile = (fullPath.endsWith(".js") || fullPath.endsWith(".node")) ? fullPath : fullPath + ".js";
    if (fs.existsSync(jsFile) && fs.statSync(jsFile).isFile()) {
        return jsFile;
    }
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        var indexJs = NodePath.resolve(fullPath, "index.js");
        if (fs.existsSync(indexJs)) {
            return NodePath.resolve(fullPath, "index.js");
        }
        var files = fs.readdirSync(fullPath);
        var content = "";
        for (var file of files) {
            content += "require('./" + file + "')\n";
        }
        return {path: indexJs, content: content};
    }
    if (!fullPath.endsWith(".js") && !fullPath.endsWith(".json")) {
        return fullPath + ".js";
    }
    return fullPath;
}

function addFile(pathIn, base) {
    if (!fs.existsSync(pathIn)) {
        return;
    }
    var content = null;
    var path = pathIn;
    if (typeof(pathIn) == "object") {
        content = pathIn.content;
        path = pathIn.path;
    }
    if (!(path in checkedFiles)) {
        checkedFiles[path] = true;
        filesToCheck.push({type: "file", path: path, content: content, base: base});
    }
}

function addModule(path, base) {
    if (!(path in checkedModules)) {
        checkedModules[path] = true;
        filesToCheck.push({type: "module", path: path, base: base});
    }
}

function copyLib(libPath) {
    var libFiles = fs.readdirSync(libPath);
    libFiles.forEach(x => {
        if (x.indexOf("..") == 0 || (x.indexOf(".") == 0 && x.length == 1)) {
            return;
        }
        let entryPath = NodePath.resolve(libPath, x);

        let fileStat = fs.lstatSync(entryPath);
        if (fileStat.isDirectory()) {
            console.log("adding lib dir: ", entryPath);
            copyLib(entryPath);
        }
        else {
            console.log("adding lib file: ", entryPath);
            let content = fs.readFileSync(entryPath);
            console.log("after content read of ",entryPath);
            saveContent(content, entryPath);
        }
    })
}

while (filesToCheck.length > 0) {
    var entry = filesToCheck.pop()
    console.log("Reading", entry.type, entry.path);
    console.log("    from", entry.base);
    if (entry.type == "lib") {
        copyLib(entry.path);
    }
    if (entry.type == "file") {
        checkedFiles[entry.path] = true;
        var content;
        if (entry.content == null) {
            console.log("entry path: ", entry.path);
            var contentBin = fs.readFileSync(entry.path);
            saveContent(contentBin, entry.path);
            if (! entry.path.endsWith(".js")) {
                continue;
            }
            content = contentBin.toString("utf8");
        }
        else {
            content = entry.content;
        }
        var requires = [].concat(
            getOccuriencies(content, "require(\"", "\")"),
            getOccuriencies(content, "require('", "')")
        );
        for (var r of requires) {
            var fullPath = r;
            if (r.startsWith(".")) {
                var fullPath = resolveRequire(NodePath.resolve(NodePath.dirname(entry.path), r));
                addFile(fullPath, entry.path);
            }
            else {
                if (r.indexOf("/") == -1) {
                    if (!libPackages.includes(r)) {
                        var fullPath = NodePath.resolve(baseDir, "node_modules", r);
                        addModule(fullPath, entry.path);
                    }
                }
                else {
                    var fullPath = resolveRequire(NodePath.resolve(baseDir, "node_modules", r));
                    addFile(fullPath, entry.path);
                }
            }
        }
    }
    else {
        checkedModules[entry.path] = true;
        var packagePath = NodePath.resolve(entry.path, "package.json");
        if (fs.existsSync(packagePath)) {
            var contentBin = fs.readFileSync(packagePath);
            saveContent(contentBin, packagePath);
            copyLicense(packagePath);
            var packageJson = JSON.parse(contentBin.toString("utf8"));
            var main = packageJson.main || "index.js";
            var fullPath = resolveRequire(NodePath.resolve(entry.path, main));
            addFile(fullPath, entry.path);

        }
    }
}

function copyLicense(packagePath) {
    let parts = packagePath.split(NodePath.sep);
    let srcPackageDir = parts.slice(0, parts.indexOf("node_modules") + 2).join(NodePath.sep);
    let outPackageDir = srcPackageDir.replace(baseDir, outDir);
    let files = fs.readdirSync(srcPackageDir);
    files.forEach(x => {
        if (x.indexOf("license") > -1 || x.indexOf("license".toUpperCase()) > -1) {
            fs.writeFileSync(NodePath.join(outPackageDir, x), fs.readFileSync(NodePath.join(srcPackageDir, x)));
        }
    })
}
