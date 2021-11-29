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
var pmc_mail_1 = require("pmc-mail");
var index_1 = require("./i18n/index");
var NoSectionsController = (function (_super) {
    __extends(NoSectionsController, _super);
    function NoSectionsController(parent) {
        var _this = _super.call(this, parent) || this;
        _this.isSectionSet = false;
        _this.ipcMode = true;
        _this.chatPlugin = _this.app.getComponent("chat-plugin");
        return _this;
    }
    NoSectionsController.registerTexts = function (localeService) {
        localeService.registerTexts(index_1.i18n, this.textsPrefix);
    };
    NoSectionsController.prototype.init = function () {
    };
    NoSectionsController.prototype.getModel = function () {
        return { data: null };
    };
    NoSectionsController.textsPrefix = "plugin.chat.component.noSections.";
    return NoSectionsController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.NoSectionsController = NoSectionsController;
NoSectionsController.prototype.className = "com.privmx.plugin.chat.component.nosections.NoSectionsController";

//# sourceMappingURL=NoSectionsController.js.map
