"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_web_1 = require("pmc-web");
var ViewTreeItem = (function () {
    function ViewTreeItem($el) {
        this.$el = $el;
        this.id = this.$el.data("id");
        this.type = this.$el.data("type");
        this.parentId = this.$el.data("parent-id");
        this.checked = this.$el.find("input[type=checkbox]").prop("checked");
    }
    ViewTreeItem.fromId = function (parent, id) {
        var $el = pmc_web_1.JQuery(parent).find(".file-entry[data-id='" + id + "']");
        return new ViewTreeItem($el);
    };
    ViewTreeItem.fromEvent = function (e) {
        var $el = pmc_web_1.JQuery(e.currentTarget).closest(".file-entry");
        return new ViewTreeItem($el);
    };
    ViewTreeItem.prototype.serialize = function () {
        return JSON.stringify({
            id: this.id,
            parentId: this.parentId,
            type: this.type,
            checked: this.checked
        });
    };
    return ViewTreeItem;
}());
exports.ViewTreeItem = ViewTreeItem;
ViewTreeItem.prototype.className = "com.privmx.plugin.notes2.window.filesimporter.ViewTreeItem";

//# sourceMappingURL=TreeItem.js.map
