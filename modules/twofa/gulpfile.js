var Project = require("privmx-builder");
const gulp = require("gulp");
var gutil = Project.libs.gutil;

var baseConfig = Project.getConfig();
gutil.log("Building " + baseConfig.buildId + " ...");

var mainProject = new Project(baseConfig, "app", null, "twofa");
mainProject.init();

mainProject.createTask("default", ["electron-plugin"]);
