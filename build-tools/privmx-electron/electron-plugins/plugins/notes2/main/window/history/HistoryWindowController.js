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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var i18n_1 = require("./i18n");
var Dependencies = pmc_mail_1.utils.decorators.Dependencies;
var HistoryWindowController = (function (_super) {
    __extends(HistoryWindowController, _super);
    function HistoryWindowController(parentWindow, session, fileSystem, path) {
        var _this = _super.call(this, parentWindow, __filename, __dirname) || this;
        _this.session = session;
        _this.ipcMode = true;
        _this.identity = session.sectionManager.identity;
        _this.setPluginViewAssets("notes2");
        _this.notes2Plugin = _this.app.getComponent("notes2-plugin");
        _this.entry = {
            name: pmc_mail_1.mail.filetree.Path.parsePath(path).name.original,
            path: path,
            mimeType: "",
            icon: "",
            fileSystem: fileSystem,
            ref: null
        };
        _this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            minWidth: 440,
            width: 440,
            height: 400,
            resizable: true,
            icon: "icon fa fa-book",
            title: _this.i18n("plugin.notes2.window.history.title") + " " + _this.entry.name
        };
        return _this;
    }
    HistoryWindowController.registerTexts = function (localeService) {
        localeService.registerTexts(i18n_1.i18n, this.textsPrefix);
    };
    HistoryWindowController.prototype.init = function () {
        var _this = this;
        return pmc_mail_1.Q().then(function () {
            return _this.entry.fileSystem.openFile(_this.entry.path, pmc_mail_1.privfs.fs.file.Mode.READ_ONLY).then(function (handle) {
                _this.entry.ref = handle.ref;
                return handle.getMeta().then(function (meta) {
                    _this.entry.mimeType = pmc_mail_1.mail.filetree.MimeType.resolve2(_this.entry.name, meta.mimeType);
                    _this.entry.icon = _this.app.shellRegistry.resolveIcon(_this.entry.mimeType);
                    return _this.entry.fileSystem.fsd.manager.getDescriptorVersions(_this.entry.ref);
                });
            });
        })
            .then(function (descriptor) {
            _this.descriptor = descriptor;
            return pmc_mail_1.Q.all(_this.descriptor.versions.map(function (x) { return x.getExtra(_this.entry.ref.readKey); }));
        })
            .then(function (extraList) {
            var data = _this.descriptor.versions.map(function (x, i) {
                var res = {
                    signature: x.raw.signature,
                    serverDate: x.raw.serverDate.getTime(),
                    createDate: extraList[i].meta.createDate,
                    modifiedDate: extraList[i].meta.modifiedDate,
                    modifier: x.raw.modifier && x.raw.modifier != "guest" ? x.raw.modifier + "#" + _this.identity.host : "",
                    path: _this.entry.path,
                    fileName: _this.entry.name,
                    icon: _this.entry.icon,
                    size: extraList[i].meta.size
                };
                return res;
            });
            if (data.length > 1 && data[0].size == 0) {
                data = data.slice(1);
            }
            data = data.reverse();
            _this.versionsCollection = _this.addComponent("versionsCollection", new pmc_mail_1.utils.collection.MutableCollection(data));
            _this.activeCollection = _this.addComponent("activeCollection", new pmc_mail_1.utils.collection.WithActiveCollection(_this.versionsCollection));
            _this.activeCollection.setActive(_this.activeCollection.get(0));
            _this.versions = _this.addComponent("versions", _this.componentFactory.createComponent("extlist", [_this, _this.activeCollection]));
            _this.versions.ipcMode = true;
            _this.personsComponent = _this.addComponent("personsComponent", _this.componentFactory.createComponent("persons", [_this]));
            _this.notifications = _this.addComponent("notifications", _this.componentFactory.createComponent("notification", [_this]));
        });
    };
    HistoryWindowController.prototype.getModel = function () {
        return {
            icon: this.entry.icon,
            name: this.entry.name,
            path: this.entry.path
        };
    };
    HistoryWindowController.prototype.onViewSetActive = function (signature) {
        var active = this.activeCollection.find(function (x) { return x.signature == signature; });
        if (active != null) {
            this.activeCollection.setActive(active);
        }
    };
    HistoryWindowController.prototype.onViewOpenSelectedVersion = function () {
        var _this = this;
        var active = this.activeCollection.getActive();
        if (active == null) {
            return;
        }
        var version = pmc_mail_1.utils.Lang.find(this.descriptor.versions, function (x) { return x.raw.signature == active.signature; });
        if (version == null) {
            return;
        }
        pmc_mail_1.app.common.shelltypes.DescriptorVersionElement.create(this.entry.name, this.entry.mimeType, this.entry.ref.readKey, version, true).then(function (element) {
            _this.app.shellRegistry.shellOpen({
                element: element,
                action: pmc_mail_1.app.common.shelltypes.ShellOpenAction.PREVIEW,
                session: _this.session
            });
        });
    };
    HistoryWindowController.prototype.onViewCopySelectedVersion = function () {
        var _this = this;
        var active = this.activeCollection.getActive();
        if (active == null) {
            return;
        }
        var version = pmc_mail_1.utils.Lang.find(this.descriptor.versions, function (x) { return x.raw.signature == active.signature; });
        if (version == null) {
            return;
        }
        pmc_mail_1.app.common.shelltypes.DescriptorVersionElement.create(this.entry.name, this.entry.mimeType, this.entry.ref.readKey, version, true).then(function (element) {
            var clipboardEntry = {
                element: element,
                cut: false,
                hostHash: _this.session.hostHash,
            };
            _this.app.clipboard.set({ file: clipboardEntry });
            _this.notifications.showNotification(_this.i18n("plugin.notes2.window.history.notifier.copied-to-clipboard"));
        });
    };
    HistoryWindowController.prototype.onViewSelectUp = function () {
        if (this.activeCollection.active) {
            var currentIndex = this.activeCollection.active.index;
            if (currentIndex > 0) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex - 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    };
    HistoryWindowController.prototype.onViewSelectDown = function () {
        if (this.activeCollection.active) {
            var currentIndex = this.activeCollection.active.index;
            if (currentIndex < this.activeCollection.size() - 1) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex + 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    };
    HistoryWindowController.prototype.onViewClose = function () {
        this.close();
    };
    HistoryWindowController.textsPrefix = "plugin.notes2.window.history.";
    HistoryWindowController = __decorate([
        Dependencies(["persons", "notification", "extlist"])
    ], HistoryWindowController);
    return HistoryWindowController;
}(pmc_mail_1.window.base.BaseWindowController));
exports.HistoryWindowController = HistoryWindowController;
HistoryWindowController.prototype.className = "com.privmx.plugin.notes2.window.history.HistoryWindowController";

//# sourceMappingURL=HistoryWindowController.js.map
