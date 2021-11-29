"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DataObject = (function () {
    function DataObject(obj) {
        if (obj === void 0) { obj = null; }
        if (typeof (obj) == "object") {
            for (var k in obj) {
                if (typeof (obj[k]) != "function") {
                    this[k] = obj[k];
                }
            }
        }
    }
    DataObject.prototype.ensureFieldIsArray = function (fieldName) {
        if (!Array.isArray(this[fieldName])) {
            this[fieldName] = [];
        }
    };
    DataObject.prototype.ensureFieldsAreArrays = function (fieldNames) {
        for (var _i = 0, fieldNames_1 = fieldNames; _i < fieldNames_1.length; _i++) {
            var fieldName = fieldNames_1[_i];
            this.ensureFieldIsArray(fieldName);
        }
    };
    DataObject.prototype.addToProperty = function (property, newMember, ensureUnique, first) {
        if (first === void 0) { first = false; }
        if (!ensureUnique || property.indexOf(newMember) == -1) {
            if (first) {
                property.splice(0, 0, newMember);
            }
            else {
                property.push(newMember);
            }
            return true;
        }
        return false;
    };
    DataObject.prototype.removeFromProperty = function (property, member) {
        var idx = property.indexOf(member);
        if (idx >= 0) {
            property.splice(idx, 1);
            return true;
        }
        return false;
    };
    DataObject.prototype.isFieldSerializable = function (fieldName) {
        return fieldName == "__version__" || fieldName == "__data_version__" || fieldName.length == 0 || fieldName[0] != "_";
    };
    DataObject.prototype.toJSON = function () {
        var res = {};
        for (var k in this) {
            if (this.isFieldSerializable(k)) {
                res[k] = this[k];
            }
        }
        return res;
    };
    DataObject.prototype.updateObjectProperties = function (other, hooks) {
        if (hooks === void 0) { hooks = {}; }
        if (this == other) {
            return;
        }
        for (var _i = 0, _a = Object.getOwnPropertyNames(other); _i < _a.length; _i++) {
            var prop = _a[_i];
            if (this[prop] != other[prop]) {
                this[prop] = other[prop];
                if (prop in hooks) {
                    hooks[prop](this[prop]);
                }
            }
        }
    };
    return DataObject;
}());
exports.DataObject = DataObject;
DataObject.prototype.className = "com.privmx.plugin.tasks.main.data.DataObject";

//# sourceMappingURL=DataObject.js.map
