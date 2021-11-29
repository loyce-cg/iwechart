"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Mail = require("pmc-mail");
var SettingsStorage = (function (_super) {
    __extends(SettingsStorage, _super);
    function SettingsStorage(session, sectionPrefix, kvdb, tasksPlugin) {
        var _this = _super.call(this, kvdb, sectionPrefix) || this;
        kvdb.collection.changeEvent.add(function (event) {
            if (!event || !event.element || !event.element.secured) {
                return;
            }
            if (event.element.secured.key.indexOf("plugin.tasks.watchedTasksHistory-") != 0) {
                return;
            }
            var data = JSON.parse(event.element.secured.value);
            if (!data) {
                return;
            }
            for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
                var entry = data_1[_i];
                if (entry) {
                    tasksPlugin.updateWatchedStatus(session, entry);
                }
            }
        });
        return _this;
    }
    SettingsStorage.prototype.mergeValues = function (a, b) {
        var map = {};
        a.forEach(function (x) { return map[x.id] = x; });
        b.forEach(function (x) {
            var found = map[x.id];
            if ((found && x.lastWatched > found.lastWatched) || !found) {
                map[x.id] = x;
            }
        });
        var list = [];
        for (var tId in map) {
            list.push(map[tId]);
        }
        return list;
    };
    return SettingsStorage;
}(Mail.mail.KvdbListSettingsStorage));
exports.SettingsStorage = SettingsStorage;
SettingsStorage.prototype.className = "com.privmx.plugin.tasks.main.SettingsStorage";

//# sourceMappingURL=SettingsStorage.js.map
