var Project = require("privmx-builder");
const gulp = require("gulp");
var gutil = Project.libs.gutil;

var baseConfig = Project.getConfig();
gutil.log("Building " + baseConfig.buildId + " ...");

var mainProject = new Project(baseConfig, "app", null, "editor");

mainProject.addHtmlCompilerOptions = function(htmlCompiler) {
    htmlCompiler.plugin = false;
    htmlCompiler.defaultHelperType = "EditorViewHelper";
    htmlCompiler.defaultHelperImport = "EditorViewHelper";
    htmlCompiler.defaultHelperPath = "main/EditorViewHelper";
    htmlCompiler.defaultHelperDefinition = "\"com.privmx.plugin.editor.main.EditorViewHelper\"";
    htmlCompiler.defaultHelperPathBacks = -2;
}

mainProject.init();

mainProject.createTask("default", ["electron-plugin"]);
