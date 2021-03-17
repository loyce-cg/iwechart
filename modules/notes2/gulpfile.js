var Project = require("privmx-builder");
const gulp = require("gulp");
var gutil = Project.libs.gutil;

var baseConfig = Project.getConfig();
baseConfig.scriptsConfig["plugin-main"] = {
    clearRequires: ["trash", "drivelist", "ncp", "fs", "path", "os", "original-fs", "hidefile"]
};
gutil.log("Building " + baseConfig.buildId + " ...");

var mainProject = new Project(baseConfig, "app", null, "notes2");
mainProject.init();

mainProject.createTask("default", ["electron-plugin"]);
