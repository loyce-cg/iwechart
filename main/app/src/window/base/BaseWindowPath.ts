import path = require("path");
import {IllegalArgumentException} from "privmx-exception";
import * as Utils from "simplito-utils";

export class BaseWindowPath {
    
    controllerPath: string;
    dirPath: string;
    controllerFilename: string;
    controllerName: string;
    viewPath: string;
    viewFilename: string;
    viewName: string;
    windowPathRelative: string;
    windowPath: string;
    windowFilename: string;
    windowName: string;
    dirName: string;
    name: string;
    qualifiedName: string;
    
    constructor(controllerPath: string, dirPath: string) {
        if (typeof(controllerPath) != "string") {
            throw new IllegalArgumentException("controllerPath", controllerPath);
        }
        if (typeof(dirPath) != "string") {
            throw new IllegalArgumentException("dirPath", dirPath);
        }
        controllerPath = controllerPath.replace("/app/out/", "/");
        dirPath = dirPath.replace("/app/out/", "/");
        Object.defineProperty(this, "controllerPath", {
            value: controllerPath.replace(/\\/g, '/'),
            enumerable: true
        });
        Object.defineProperty(this, "dirPath", {
            value: dirPath.replace(/\\/g, '/'),
            enumerable: true
        });
        Utils.defineLazyReadOnlyProperty(this, "controllerFilename", function(this: BaseWindowPath) {
            return path.basename(this.controllerPath);
        });
        Utils.defineLazyReadOnlyProperty(this, "controllerName", function(this: BaseWindowPath) {
            return this.controllerFilename.replace(".js", "");
        });
        Utils.defineLazyReadOnlyProperty(this, "viewPath", function(this: BaseWindowPath) {
            return this.dirPath + "/" + this.viewFilename;
        });
        Utils.defineLazyReadOnlyProperty(this, "viewFilename", function(this: BaseWindowPath) {
            return this.viewName + ".js";
        });
        Utils.defineLazyReadOnlyProperty(this, "viewName", function(this: BaseWindowPath) {
            return this.controllerName.replace("Controller", "View");
        });
        Utils.defineLazyReadOnlyProperty(this, "windowPathRelative", function(this: BaseWindowPath) {
            return "../" + this.dirName + "/" + this.windowFilename;
        });
        Utils.defineLazyReadOnlyProperty(this, "windowPath", function(this: BaseWindowPath) {
            return this.dirPath + "/" + this.windowFilename;
        });
        Utils.defineLazyReadOnlyProperty(this, "windowFilename", function(this: BaseWindowPath) {
            return this.windowName + ".html";
        });
        Utils.defineLazyReadOnlyProperty(this, "windowName", function(this: BaseWindowPath) {
            return this.controllerName.replace("Controller", "");
        });
        Utils.defineLazyReadOnlyProperty(this, "dirName", function(this: BaseWindowPath) {
            return path.basename(this.dirPath);
        });
        Utils.defineLazyReadOnlyProperty(this, "name", function(this: BaseWindowPath) {
            return this.windowName.replace("Window", "");
        });
        Utils.defineLazyReadOnlyProperty(this, "qualifiedName", function(this: BaseWindowPath) {
            return "window." + this.dirName + "." + this.controllerName;
        });
    }
}
