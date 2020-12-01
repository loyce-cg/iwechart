var Project = require("privmx-builder");
var fs = require("fs");
var path = require("path");
const svg2img = require("svg2img");
var ts = require("gulp-typescript");
var gulp = require("gulp");

var gulp = Project.libs.gulp;
var gutil = Project.libs.gutil;
var sh = Project.libs.shelljs;
var baseConfig = Project.getConfig();
baseConfig.generateWindowsRegistry = true;
baseConfig.generateServicesInterfaces = true;
gutil.log("Building " + baseConfig.buildId + " ...");

//======================

var mainProject = new Project(baseConfig, "app");
mainProject.viewExposedModules.push("jquery");
mainProject.viewExposedModules.push("jquery-mousewheel");
mainProject.init();

const config = require("./build-config.json");

mainProject.createTask("zxcvbn", [], null, function() {
    return mainProject.buildScript({
        reqs: [["./" + mainProject.basePath + "/node_modules/zxcvbn-mod/lib/main", {expose: "zxcvbn-mod"}]],
        destination: "zxcvbn.js",
        requireName: "privmxLibZxcvbRequire"
    });
});

mainProject.createTask("highlight", [], null, function() {
    return mainProject.buildScript({
        reqs: [["./" + mainProject.basePath + "/node_modules/highlight.js/lib/index", {expose: "highlight.js"}]],
        destination: "highlight.js",
        requireName: "privmxLibHighlightRequire"
    });
});

mainProject.createTask("aggrid", [], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/node_modules/@ag-grid-community/core/dist/styles/ag-grid.min.css",
        "./" + mainProject.basePath + "/node_modules/@ag-grid-community/core/dist/styles/ag-theme-balham-dark.min.css"
    ];
    return gulp.src(locations, {base: "./app/node_modules/@ag-grid-community/core/dist/styles"})
        .pipe(gulp.dest(mainProject.config.dest + "build/aggrid"));
});

mainProject.createTask("voicechat", [], null, function() {
    var voiceChatJsPath = "./" + mainProject.basePath + "/node_modules/@simplito/libopus/src";
    var locations = [
        voiceChatJsPath + "/libopus.wasm",
        voiceChatJsPath + "/libopus.wasm.js"
    ];
    return gulp.src(locations, {base: "./app/node_modules/@simplito/libopus/src"})
        .pipe(gulp.dest(mainProject.config.dest + "build/voicechat"));
});

let voicechatTsLocations = ["voicechat/src/*.ts", "voicechat/src/**/*.ts"];
mainProject.createTsTask({
    name: "compile-voicechat-ts",
    tsProjectPath: "./voicechat/tsconfig.json",
    dependencies: [],
    watchDependencies: [],
    tsWatchLocations: voicechatTsLocations,
    tsCompileLocations: voicechatTsLocations,
    tsOutPath: "./voicechat/out/"
});
mainProject.bundleTask({
    name: "stream-audio-processor",
    dependsTs: "compile-voicechat-ts",
    adds: ["./voicechat/out/StreamAudioProcessor.js"],
    destination: "voicechat/stream-audio-processor.js"
});
mainProject.bundleTask({
    name: "stream-record-processor",
    dependsTs: "compile-voicechat-ts",
    adds: ["./voicechat/out/StreamRecordProcessor.js"],
    destination: "voicechat/stream-record-processor.js"
});

mainProject.createTask("tui", [], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/node_modules/fabric-dist/dist/fabric.js",
        "./" + mainProject.basePath + "/node_modules/tui-code-snippet/dist/tui-code-snippet.min.js",
        "./" + mainProject.basePath + "/node_modules/tui-color-picker/dist/tui-color-picker.min.js",
        "./" + mainProject.basePath + "/node_modules/tui-color-picker/dist/tui-color-picker.min.css",
        "./" + mainProject.basePath + "/node_modules/tui-image-editor/dist/tui-image-editor.js",
        "./" + mainProject.basePath + "/node_modules/tui-image-editor/dist/tui-image-editor.css",
        "./" + mainProject.basePath + "/node_modules/tui-image-editor/examples/js/theme/black-theme.js",
        "./" + mainProject.basePath + "/node_modules/tui-image-editor/examples/js/theme/white-theme.js"
    ];
    return gulp.src(locations, {base: "./app/node_modules"})
        .pipe(gulp.dest(mainProject.config.dest + "build/tui"));
});


function svg2imgPromise(src, dest) {
    return new Promise((resolve, reject) => {
        svg2img(src, (err, buffer) => {
            if (err) {
                reject(err);
            }
            else {
                fs.writeFileSync(dest, buffer);
                resolve(buffer);
            }
        })
    })
}

// var icons = ["1f600", "1f606", "1f604", "1f44c", "1f91e", "1f44d", "1f44e", "1f44f", "1f91d"];
// mainProject.createSimpleTask("twemoji-convert",[], function() {
//     return new Promise(resolve => {

//         let convertActions = [];
//         let iconsDir = "./" + mainProject.basePath + "/node_modules/twemoji/2/svg/";
//         icons.forEach(x => {
//             convertActions.push(svg2imgPromise(iconsDir + x + ".svg", iconsDir + x + ".png"))
//         })
//         return Promise.all(convertActions).then(() => resolve());
//     })
// })


var icons = [];
var compatIcons = ["1f600", "1f606", "1f604", "1f44c", "1f91e", "1f44d", "1f44e", "1f44f", "1f91d"];
mainProject.createSimpleTask("twemoji-convert",[], function() {
    return new Promise(resolve => {
        let convertActions = [];
        let iconsDir = "./" + mainProject.basePath + "/src/emoji/";
        let iconsFiles = fs.readdirSync(iconsDir).filter(x => x != "." && x != "..");
        icons = iconsFiles.map(x => x.split(".")[0]);

        icons.forEach(x => {
            convertActions.push(svg2imgPromise(iconsDir + x + ".svg", iconsDir + x + ".png"))
        })

        let compatIconsDir = "./" + mainProject.basePath + "/node_modules/twemoji/2/svg/";
        compatIcons.forEach(x => {
            convertActions.push(svg2imgPromise(compatIconsDir + x + ".svg", compatIconsDir + x + ".png"))
        })
        return Promise.all(convertActions).then(() => resolve());
    })
})


mainProject.createTask("twemoji", ["twemoji-convert"], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/node_modules/twemoji/2/twemoji.min.js",
    ];
        icons.forEach(function(x) {
            locations.push("./" + mainProject.basePath + "/src/emoji/" + x + ".svg");
            locations.push("./" + mainProject.basePath + "/src/emoji/" + x + ".png");
        });

        compatIcons.forEach(function(x) {
            locations.push("./" + mainProject.basePath + "/node_modules/twemoji/2/svg/" + x + ".svg");
            locations.push("./" + mainProject.basePath + "/node_modules/twemoji/2/svg/" + x + ".png");
        });

        return gulp.src(locations)
          .pipe(gulp.dest(mainProject.config.dest + "build/twemoji"));
});


// old
// mainProject.createSimpleTask("twemoji-convert",[], function() {
//     return new Promise(resolve => {

//         let convertActions = [];
//         let iconsDir = "./" + mainProject.basePath + "/node_modules/twemoji/2/svg/";
//         icons.forEach(x => {
//             convertActions.push(svg2imgPromise(iconsDir + x + ".svg", iconsDir + x + ".png"))
//         })
//         return Promise.all(convertActions).then(() => resolve());
//     })
// })

// mainProject.createTask("twemoji", ["twemoji-convert"], null, function() {
//     var locations = [
//         "./" + mainProject.basePath + "/node_modules/twemoji/2/twemoji.min.js",
//     ];
//         icons.forEach(function(x) {
//             locations.push("./" + mainProject.basePath + "/node_modules/twemoji/2/svg/" + x + ".svg");
//             locations.push("./" + mainProject.basePath + "/node_modules/twemoji/2/svg/" + x + ".png");
//         });
//         return gulp.src(locations, {base: "./app/node_modules"})
//           .pipe(gulp.dest(mainProject.config.dest + "build/twemoji"));
// });

mainProject.bundleTask({
    name: "core-light",
    prodAdds: true,
    pluginContext: "app",
    reqs: [["./" + mainProject.basePath + "/out/build/core-light.js", {expose: "privmx-core"}]],
    destination: "privmx-core-light.js",
    requireName: "privmxCoreRequire"
});

mainProject.createTask("pdf", [], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/node_modules/pdfjs-dist/build/pdf.js",
        "./" + mainProject.basePath + "/node_modules/pdfjs-dist/build/pdf.worker.js",
        "./" + mainProject.basePath + "/node_modules/html2pdf.js/dist/html2pdf.bundle.min.js",
    ];
    return gulp.src(locations, {base: "./app/node_modules"})
        .pipe(gulp.dest(mainProject.config.dest + "build/pdf"));
});

mainProject.createTask("colorpicker", [], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/node_modules/a-color-picker/dist/acolorpicker.js",
    ];
    return gulp.src(locations, {base: "./app/node_modules"})
        .pipe(gulp.dest(mainProject.config.dest + "build/colorpicker"));
});

mainProject.createTask("mail-client", [
    "main",
    "zxcvbn",
    "highlight",
    "tui",
    "pdf",
    "colorpicker",
    "twemoji",
    "aggrid",
    "voicechat",
    "bundle-stream-audio-processor",
    "bundle-stream-record-processor"
]);

//======================

var tasks = ["mail-client"];
if (baseConfig.libBuild) {
    tasks.push("privmx-client");
}
mainProject.createTask("default", tasks);

mainProject.createSimpleTask("electron-dist-purge", [], function() {
    sh.exec("rm -rf " + config.electronDistDest, {silent: false});
    return gutil.emptyTaskBody();
});

mainProject.createSimpleTask("electron-dist-copy", ["electron-dist-purge"], function() {
    // throw Error("Add support to index.php");
    // TODO: app.html is old index.html, index.php is new index.html
    sh.mkdir("-p", config.electronDistDest);
    sh.mkdir("-p", config.electronDistTmpDest);
    
    let dictsSrc = path.resolve("./app/src/dictionaries");
    let dictsOut = path.join(config.electronDistDest, "dist/dictionaries");
    console.log("COPY: "+ dictsSrc+ " => " + dictsOut);
    sh.mkdir("-p", dictsOut);
    sh.exec("rm -rf " + dictsOut);
    sh.exec("cp -R " + dictsSrc + " " + dictsOut);

    let assetsSrc = path.resolve("./app/src/assets");
    console.log("assetsDir", assetsSrc);
    let assetsOut = path.join(config.electronDistDest, "dist/assets");
    console.log("COPY: "+ assetsSrc+ " => " + assetsOut);
    sh.mkdir("-p", assetsOut);
    sh.exec("rm -rf " + assetsOut);
    sh.exec("cp -R " + assetsSrc + " " + assetsOut);
    
    
    var copyLocations = [
        "app/out/**",
        "app/node_modules/**",
        "app/package.json",
        "dist/components/**",
        "dist/icons/**",
        "dist/plugins/**",
        "dist/component/**",
        "dist/sounds/**",
        "dist/themes/**",
        "dist/window/**",
        "dist/build/**",
        "dist/dictionaries/**",
        "dist/assets/**"
        // "node_modules/**"
    ];

    if (baseConfig.production) {
        var srcProdDir = path.resolve("releases", baseConfig.buildId);
        console.log("dist-copy in production ... " + srcProdDir);
        copyLocations = [
            "app/out/**",
            "app/node_modules/**",
            "app/package.json"
        ];

        var manualCopy = [
            "component",
            "sounds",
            "themes",
            "window",
            "build",
            "icons"
        ]
        if (! fs.existsSync(path.join(config.electronDistDest, "dist"))) {
          sh.mkdir("-p", path.join(config.electronDistDest, "dist"));
        }
        manualCopy.forEach(x => {
            console.log("COPY: "+ path.join(srcProdDir, x)+ " => " + path.join(config.electronDistDest, "dist"));
            sh.exec("rm -rf " + path.join(config.electronDistDest, "dist", x));
            sh.exec("cp -R " + path.join(srcProdDir, x) + " " + path.join(config.electronDistDest, "dist"));
        })
        // sh.exec("cp -R " + srcProdDir + "/icons" + " " + path.resolve(config.electronDistDest, "dist/icons"));
    }
    else {
        console.log("dist-copy std ...");
    }
    var packageJson = require("./package.json");
    var mainPackageJson = require("./app/package.json");
    mainPackageJson.version = "--version-placeholder--";

    var outPackageJson = {
        main: "app/out/app/electron/start.js"
    };
    var keys = [
        "name", "description", "productName",
        "author", "license", "dependencies", "window"
    ];
    keys.forEach(function(key){
        outPackageJson[key] = packageJson[key];
    });
    if (process.platform === "win32") {
        outPackageJson.description = packageJson.build.win.description;
        outPackageJson.productName = packageJson.build.win.productName;
        outPackageJson.name = packageJson.build.win.name;
    }
    if (process.platform === "linux") {
        outPackageJson.productName = packageJson.build.linux.productName;
        outPackageJson.name = packageJson.build.linux.name;
        outPackageJson.version = packageJson.build.linux.version;
    }
    fs.writeFileSync(path.join(config.electronDistDest, "package.json"), JSON.stringify(outPackageJson, null, 2));
    console.log("path: ", config.electronDistDest);
    fs.writeFileSync(path.join(config.electronDistTmpDest, "app-package.json"), JSON.stringify(mainPackageJson));
    return gulp.src(copyLocations,{base: "./"})
        .pipe(gulp.dest(config.electronDistDest));
});

mainProject.createSimpleTask("electron-dist", ["electron-dist-copy"], function() {
    sh.pushd(config.electronDistDest)
    // sh.exec("npm install --cache-min 9999999 --production", {silent: false});
    sh.popd();
    return gutil.emptyTaskBody();
});


mainProject.createSimpleTask("electron-dist-clean", ["electron-dist"], function() {
    const mainPackageJson = require("./app/package.json");
    const privfsClientLibVersion = mainPackageJson.dependencies["privfs-client"].substr(1, mainPackageJson.dependencies["privfs-client"].length);
    const privfsClientLibFile = "privmx-client";
    console.log(privfsClientLibFile, privfsClientLibVersion);

    // cleanup unnesessary libs
    const libsPath = path.resolve(config.electronDistDest, "dist/build/lib");
    // fs.readdir(libsPath, function(err, items) {
    //     for (var i=0; i<items.length; i++) {
    //         if (items[i].indexOf(privfsClientLibFile) > -1 && items[i].indexOf(privfsClientLibVersion) == -1) {
    //             console.log("toRemove: ", items[i]);
    //             sh.exec("rm -rf " + path.resolve(libsPath, items[i]), {silent: false});
    //         }
    //     }
    // });

    //usuwamy cale lib dla electrona
    sh.exec("rm -rf " + libsPath);
    sh.exec("rm -rf " + path.resolve(config.electronDistDest, "dist/build/privmx-core.js"));
    sh.exec("rm -rf " + path.resolve(config.electronDistDest, "dist/build/privmx-init.js"));
    sh.exec("rm -rf " + path.resolve(config.electronDistDest, "dist/build/privmx-view-lite.js"));
    sh.exec("rm -rf " + path.resolve(config.electronDistDest, "dist/build/*.map"));

    // copy and cleanup plugins
    var pluginsSrcDir = path.resolve(config.pluginsSrcDir);
    console.log("dir1", pluginsSrcDir);
    sh.exec("cp -R -L " + pluginsSrcDir + " " + config.electronDistDest, {silent: false});

    var pluginsDir2 = path.resolve(config.electronDistDest, "electron-plugins/plugins")+"/";
    console.log("dir2: ", pluginsDir2);
    fs.readdir(pluginsDir2, function(err, items) {
        items.forEach(dirName => {
            var dirPath = path.resolve(pluginsDir2, dirName);
            console.log("plugins: ", dirPath);
            var clientDirPath = path.resolve(dirPath, "client");
            fs.readdir(clientDirPath, function(err, buildIds) {

                var newestBuildIdx = 0;
                var newestBuildTimestamp = 0;
                for (var i=0;i< buildIds.length;i++) {
                    var dateString = buildIds[i];
                    if (dateString.length >= 14) {
                        var mTimestamp = new Date(dateString.substr(0,4)+"-"+dateString.substr(4,2)+"-"+dateString.substr(6,2)+" "+dateString.substr(8,2)+":"+dateString.substr(10,2)+":"+dateString.substr(12,2)+":").getTime();
                        if (mTimestamp !==NaN && mTimestamp > newestBuildTimestamp) {
                            newestBuildTimestamp = mTimestamp;
                            newestBuildIdx = i;
                        }
                    }

                }
                console.log("For " + clientDirPath + " using: " + buildIds[newestBuildIdx]);
                fs.readdir(clientDirPath, function(err, items) {
                    for (var i=0; i<items.length; i++) {
                        if (items[i].indexOf(buildIds[newestBuildIdx]) == -1) {
                            console.log("toRemove: ", path.resolve(clientDirPath, items[i]));
                            sh.exec("rm -rf " + path.resolve(clientDirPath, items[i]), {silent: false});
                        }
                    }
                });
            });
        });
    });
    return gutil.emptyTaskBody();
});


mainProject.createSimpleTask("electron-dist-light", [], function() {
    var copyLocations = [
        "app/out/**",
        "app/package.json",
        "dist/components/**",
        "dist/icons/**",
        "dist/plugins/**",
        "dist/component/**",
        "dist/sounds/**",
        "dist/themes/**",
        "dist/window/**",
        "dist/build/**",
        "dist/dictionaries/**",
    ];
    var packageJson = require("./package.json");
    var mainPackageJson = require("./app/package.json");
    mainPackageJson.version = "--version-placeholder--";

    var outPackageJson = {
        main: "app/out/app/electron/start.js"
    };
    var keys = [
        "name", "description", "productName",
        "author", "license", "dependencies", "window"
    ];
    keys.forEach(function(key){
        outPackageJson[key] = packageJson[key];
    });
    if (process.platform === "win32") {
        outPackageJson.description = packageJson.build.win.description;
        outPackageJson.productName = packageJson.build.win.productName;
        outPackageJson.name = packageJson.build.win.name;
    }
    if (process.platform === "linux") {
        outPackageJson.productName = packageJson.build.linux.productName;
        outPackageJson.name = packageJson.build.linux.name;
        outPackageJson.version = packageJson.build.linux.version;
    }
    fs.writeFileSync(path.join(config.electronDistDest, "package.json"), JSON.stringify(outPackageJson, null, 2));
    fs.writeFileSync(path.join(config.electronDistDest, "app-package.json"), JSON.stringify(mainPackageJson));
    return gulp.src(copyLocations,{base: "./"})
        .pipe(gulp.dest(config.electronDistDest));
});


mainProject.createSimpleTask("electron-build-clean", [], function() {
  sh.exec("rm -rf " + config.electronBuildDir, {silent: false});
  return gutil.emptyTaskBody();
});

mainProject.createSimpleTask("build-electron", ["electron-dist-clean"]);

mainProject.createSimpleTask("electron-dist-watch", ["electron-dist-light"], function(){
    var copyLocations = [
        "app/out/**/*.js",
        "app/package.json",
        "dist/components/**/*.js",
        "dist/icons/**",
        "dist/plugins/**/*.js",
        "dist/component/**/*.js",
        "dist/sounds/**",
        "dist/themes/**",
        "dist/window/**/*.js",
        "dist/build/**/*.js",
        "dist/dictionaries/**",
    ];

    return gulp.watch(copyLocations).on("change", function(file) {
        gutil.log(gutil.colors.yellow("JS changed" + " (" + file.path + ")"));
        gulp.src(file.path, {base: "./"})
            .pipe(gulp.dest(config.electronDistDest));
    })
});
