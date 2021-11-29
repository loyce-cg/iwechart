"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DataMigration = (function () {
    function DataMigration() {
    }
    DataMigration.migrateTask = function (task) {
        var dataVersion = this.getVersion(task);
        if (dataVersion == 1) {
            task.status = task.status + 1;
            for (var _i = 0, _a = task.history; _i < _a.length; _i++) {
                var entry = _a[_i];
                if (entry.what == "modified" && entry.arg == "status") {
                    entry.oldVal = entry.oldVal + 1;
                    entry.newVal = entry.newVal + 1;
                }
            }
            this.setVersion(task);
        }
    };
    DataMigration.migrateTaskGroup = function (taskGroup) {
        var dataVersion = this.getVersion(taskGroup);
        if (dataVersion == 1) {
            this.setVersion(taskGroup);
        }
    };
    DataMigration.migrateProject = function (project) {
        var dataVersion = this.getVersion(project);
        if (dataVersion <= 2) {
            project.taskStatuses = ["Idea", "[Todo]", "In progress", "Done"];
            this.setVersion(project);
        }
    };
    DataMigration.getVersion = function (obj) {
        return obj[this.DATA_VERSION_KEY] || 1;
    };
    DataMigration.setVersion = function (obj, version) {
        if (version === void 0) { version = null; }
        obj[this.DATA_VERSION_KEY] = version ? version : this.CURR_VERSION;
    };
    DataMigration.DATA_VERSION_KEY = "__data_version__";
    DataMigration.CURR_VERSION = 3;
    return DataMigration;
}());
exports.DataMigration = DataMigration;
DataMigration.prototype.className = "com.privmx.plugin.tasks.main.DataMigration";

//# sourceMappingURL=DataMigration.js.map
