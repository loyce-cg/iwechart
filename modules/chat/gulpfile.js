var Project = require("privmx-builder");
const gulp = require("gulp");
var gutil = Project.libs.gutil;

var baseConfig = Project.getConfig();
gutil.log("Building " + baseConfig.buildId + " ...");

var mainProject = new Project(baseConfig, "app", null, "chat");
mainProject.init();

mainProject.createTask("jitsi", [], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/src/main/videoConference/jitsi/lib-jitsi-meet.min.js",
        "./" + mainProject.basePath + "/src/main/videoConference/jitsi/lib-jitsi-meet.min.map",
        "./" + mainProject.basePath + "/src/main/videoConference/jitsi/lib-jitsi-meet.e2ee-worker.js",
    ];
    return gulp.src(locations, {base: "./app/src/main/videoConference/jitsi/"})
        .pipe(gulp.dest(mainProject.config.dest + "build/jitsi"));
});

mainProject.createTask("jitsi-electron-plugin", [], null, function() {
    var locations = [
        "./" + mainProject.basePath + "/src/main/videoConference/jitsi/lib-jitsi-meet.min.js",
        "./" + mainProject.basePath + "/src/main/videoConference/jitsi/lib-jitsi-meet.min.map",
        "./" + mainProject.basePath + "/src/main/videoConference/jitsi/lib-jitsi-meet.e2ee-worker.js",
    ];
    return gulp.src(locations, {base: "./app/src/main/videoConference/jitsi/"})
        .pipe(gulp.dest("./dist-electron/client/" + mainProject.config.buildId + "/build/jitsi"));
});


mainProject.createTask("default", ["jitsi", "electron-plugin", "jitsi-electron-plugin"]);
