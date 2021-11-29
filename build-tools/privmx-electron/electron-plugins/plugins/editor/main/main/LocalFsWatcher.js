"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var LocalFfWatcher = (function () {
    function LocalFfWatcher() {
    }
    LocalFfWatcher.prototype.watch = function (fileName, callback) {
        this.unwatch();
        return this.watched = fs.watch(fileName, function () {
            callback();
        });
    };
    LocalFfWatcher.prototype.unwatch = function () {
        if (this.watched) {
            this.watched.close();
        }
    };
    return LocalFfWatcher;
}());
exports.LocalFfWatcher = LocalFfWatcher;
LocalFfWatcher.prototype.className = "com.privmx.plugin.editor.main.LocalFfWatcher";

//# sourceMappingURL=LocalFsWatcher.js.map
