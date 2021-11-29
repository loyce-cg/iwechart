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
    function SettingsStorage(sectionPrefix, kvdb) {
        return _super.call(this, kvdb, sectionPrefix) || this;
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
SettingsStorage.prototype.className = "com.privmx.plugin.notes2.main.SettingsStorage";

//# sourceMappingURL=SettingsStorage.js.map
