var Project = require("privmx-builder");
var gutil = Project.libs.gutil;

var baseConfig = Project.getConfig();
gutil.log("Building " + baseConfig.buildId + " ...");

var mainProject = new Project(baseConfig, "app", null, "calendar");
mainProject.init();

mainProject.createTask("default", ["electron-plugin"]);
