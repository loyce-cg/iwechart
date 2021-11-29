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
var BaseItemsPanelController = (function (_super) {
    __extends(BaseItemsPanelController, _super);
    function BaseItemsPanelController(parent, personsComponent) {
        var _this = _super.call(this, parent) || this;
        _this.personsComponent = personsComponent;
        _this.ipcMode = true;
        _this.itemsMergedCollection = _this.addComponent("mergedCollection", new pmc_mail_1.utils.collection.MergedCollection());
        _this.itemsProxyCollection = _this.addComponent("proxyCollection", new pmc_mail_1.utils.collection.ProxyCollection(_this.itemsMergedCollection));
        _this.itemsFilteredCollection = _this.addComponent("filteredCollection", new pmc_mail_1.utils.collection.FilteredCollection(_this.itemsProxyCollection, _this.filterEntry.bind(_this)));
        _this.itemsSortedCollection = _this.addComponent("sortedCollection", new pmc_mail_1.utils.collection.SortedCollection(_this.itemsFilteredCollection, _this.sortEntry.bind(_this)));
        _this.itemsActiveCollection = _this.addComponent("activeCollection", new pmc_mail_1.utils.collection.WithActiveCollection(_this.itemsSortedCollection));
        _this.itemsTransformCollection = _this.addComponent("transformCollection", new pmc_mail_1.utils.collection.TransformCollection(_this.itemsActiveCollection, _this.convertEntry.bind(_this)));
        _this.items = _this.addComponent("items", _this.componentFactory.createComponent("extlist", [_this, _this.itemsTransformCollection]));
        _this.items.ipcMode = true;
        _this.registerChangeEvent(_this.itemsActiveCollection.changeEvent, function (event) {
            _this.onActiveCollectionChange(event);
        });
        return _this;
    }
    BaseItemsPanelController.prototype.addBaseCollection = function (collection) {
        this.itemsMergedCollection.addCollection(collection);
    };
    return BaseItemsPanelController;
}(pmc_mail_1.window.base.WindowComponentController));
exports.BaseItemsPanelController = BaseItemsPanelController;

//# sourceMappingURL=BaseItemsPanelController.js.map
