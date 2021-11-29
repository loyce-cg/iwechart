"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var UniqueId = (function () {
    function UniqueId() {
    }
    UniqueId.next = function () {
        var n = 1000;
        while (n-- > 0) {
            var id = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
            if (this.usedIds.indexOf(id) < 0) {
                this.usedIds.push(id);
                return id;
            }
        }
    };
    UniqueId.usedIds = [];
    return UniqueId;
}());
exports.UniqueId = UniqueId;
UniqueId.prototype.className = "com.privmx.plugin.tasks.main.UniqueId";

//# sourceMappingURL=UniqueId.js.map
