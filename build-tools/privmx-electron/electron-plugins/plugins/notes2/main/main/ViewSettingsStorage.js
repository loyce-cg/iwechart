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
var ViewSettingsStorage = (function (_super) {
    __extends(ViewSettingsStorage, _super);
    function ViewSettingsStorage(sectionPrefix, kvdb) {
        return _super.call(this, kvdb, sectionPrefix) || this;
    }
    ViewSettingsStorage.prototype.mergeValues = function (a, b) {
        var map = {};
        a.forEach(function (x) { return map[x.key] = x; });
        b.forEach(function (x) {
            var found = map[x.key];
            if ((found && x.setDT > found.setDT) || !found) {
                map[x.key] = x;
            }
        });
        var list = [];
        for (var pId in map) {
            list.push(map[pId]);
        }
        return list;
    };
    return ViewSettingsStorage;
}(Mail.mail.KvdbListSettingsStorage));
exports.ViewSettingsStorage = ViewSettingsStorage;
ViewSettingsStorage.prototype.className = "com.privmx.plugin.notes2.main.ViewSettingsStorage";

//# sourceMappingURL=ViewSettingsStorage.js.map
