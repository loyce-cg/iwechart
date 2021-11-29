"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_web_1 = require("pmc-web");
var Editor = (function () {
    function Editor(options) {
        this.relatedHostHash = null;
        this.relatedSectionId = null;
        this.parent = options.parent;
        this.editMode = options.editMode;
        this.newFile = options.newFile;
        this.preferences = options.preferences || {};
        this.previewMode = options.previewMode;
        this.taskStatuses = options.taskStatuses;
        this.listeners = {};
        this.$body = pmc_web_1.JQuery("body");
        this.setCurrentState(options.initState);
        this.initState = this.getState();
    }
    Editor.prototype.initContainer = function () {
        this.$container = pmc_web_1.JQuery("<div class='editor-inner'></div>");
    };
    Editor.prototype.createDataFromState = function (_state) {
        throw new Error("Unimplemented");
    };
    Editor.prototype.paste = function (_data) {
    };
    Editor.prototype.beforeSave = function () {
    };
    Editor.prototype.getState = function () {
        throw new Error("Unimplemented");
    };
    Editor.prototype.getElements = function () {
        throw new Error("Unimplemented");
    };
    Editor.prototype.render = function () {
        if (!this.rendered) {
            this.rendered = true;
            this.$container.html("");
            this.$container.append("<div>" + this.data + "</div>");
        }
    };
    Editor.prototype.attach = function ($container) {
        this.render();
        $container.append(this.$container);
    };
    Editor.prototype.detach = function () {
        this.$container.detach();
    };
    Editor.prototype.focus = function () {
    };
    Editor.prototype.isChanged = function () {
        return this.initState != this.getState();
    };
    Editor.prototype.setEditMode = function (editMode) {
        this.editMode = editMode;
    };
    Editor.prototype.confirmSave = function (initState) {
        this.initState = initState;
        this.triggerEvent("change", false);
    };
    Editor.prototype.setCurrentState = function (state) {
        this.data = this.createDataFromState(state);
        if (this.rendered) {
            var $oldContainer = this.$container;
            this.initContainer();
            this.rendered = false;
            this.render();
            $oldContainer.replaceWith(this.$container);
        }
        else {
            this.initContainer();
            this.rendered = false;
        }
        this.triggerEvent("change", false);
    };
    Editor.prototype.backToInitState = function () {
        this.setCurrentState(this.initState);
    };
    Editor.prototype.addEventListener = function (eventName, callback) {
        if (typeof (callback) != "function") {
            throw new Error("Callback is not a function");
        }
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    };
    Editor.prototype.triggerEvent = function (eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(function (callback) {
                callback(data);
            });
        }
    };
    Editor.prototype.getCustomToolbarMenuHtml = function () {
        return "";
    };
    Editor.prototype.getCustomToolbarRightSideMenuHtml = function () {
        return "";
    };
    Editor.prototype.updateLayout = function () {
    };
    Editor.prototype.updateTaskBadges = function () {
    };
    Editor.clazz = "Editor";
    return Editor;
}());
exports.Editor = Editor;
Editor.prototype.className = "com.privmx.plugin.editor.window.editor.editors.Editor";

//# sourceMappingURL=Editor.js.map
