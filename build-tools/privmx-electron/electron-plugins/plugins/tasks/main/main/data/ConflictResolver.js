"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ConflictResolutionStatus;
(function (ConflictResolutionStatus) {
    ConflictResolutionStatus[ConflictResolutionStatus["UNRESOLVED"] = 0] = "UNRESOLVED";
    ConflictResolutionStatus[ConflictResolutionStatus["RESOLVED"] = 1] = "RESOLVED";
    ConflictResolutionStatus[ConflictResolutionStatus["IDENTICAL"] = 2] = "IDENTICAL";
    ConflictResolutionStatus[ConflictResolutionStatus["DIFFERENT_OBJECT"] = 3] = "DIFFERENT_OBJECT";
})(ConflictResolutionStatus = exports.ConflictResolutionStatus || (exports.ConflictResolutionStatus = {}));
var ConflictResolver = (function () {
    function ConflictResolver(original, first, second) {
        this.original = original;
        this.first = first;
        this.second = second;
    }
    ConflictResolver.prototype.tryResolveSimplePropertyConflict = function (propertyName, resolved, aDiffs, bDiffs, abDiffs) {
        if (abDiffs.indexOf(propertyName) >= 0 && aDiffs.indexOf(propertyName) >= 0 && bDiffs.indexOf(propertyName) >= 0) {
            return ConflictResolutionStatus.UNRESOLVED;
        }
        if (abDiffs.indexOf(propertyName) >= 0) {
            if (aDiffs.indexOf(propertyName) >= 0 && bDiffs.indexOf(propertyName) >= 0) {
                return ConflictResolutionStatus.UNRESOLVED;
            }
            var PropertyName = propertyName[0].toUpperCase() + propertyName.substr(1);
            if (aDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName](this.first["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
            if (bDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName](this.second["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
        }
        return ConflictResolutionStatus.IDENTICAL;
    };
    ConflictResolver.prototype.tryResolveSimpleArrayPropertyConflict = function (propertyName, resolved, aDiffs, bDiffs, abDiffs) {
        var PropertyName = propertyName[0].toUpperCase() + propertyName.substr(1);
        if (aDiffs.indexOf(propertyName) >= 0 && bDiffs.indexOf(propertyName) >= 0 && abDiffs.indexOf(propertyName) >= 0) {
            var orig = this.original["get" + PropertyName]();
            var a = this.first["get" + PropertyName]();
            var b = this.second["get" + PropertyName]();
            var c = orig.slice();
            for (var i = 0; i < orig.length; ++i) {
                if (a.indexOf(orig[i]) < 0 || b.indexOf(orig[i]) < 0) {
                    var idx = c.indexOf(orig[i]);
                    if (idx >= 0) {
                        c.splice(idx, 1);
                    }
                }
            }
            for (var i = 0; i < a.length; ++i) {
                if (orig.indexOf(a[i]) < 0) {
                    c.push(a[i]);
                }
            }
            for (var i = 0; i < b.length; ++i) {
                if (orig.indexOf(b[i]) < 0) {
                    c.push(b[i]);
                }
            }
            resolved["set" + PropertyName](c);
            return ConflictResolutionStatus.RESOLVED;
        }
        if (abDiffs.indexOf(propertyName) >= 0) {
            if (aDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName](this.first["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
            if (bDiffs.indexOf(propertyName) >= 0) {
                resolved["set" + PropertyName](this.second["get" + PropertyName]());
                return ConflictResolutionStatus.RESOLVED;
            }
        }
        return ConflictResolutionStatus.IDENTICAL;
    };
    ConflictResolver.prototype.tryResolveSimpleOrderedArrayPropertyConflict = function (propertyName, resolved, aDiffs, bDiffs, abDiffs) {
        var PropertyName = propertyName[0].toUpperCase() + propertyName.substr(1);
        var aDiff = aDiffs.indexOf(propertyName) >= 0;
        var bDiff = bDiffs.indexOf(propertyName) >= 0;
        var abDiff = abDiffs.indexOf(propertyName) >= 0;
        if (!abDiff) {
            return ConflictResolutionStatus.IDENTICAL;
        }
        if (aDiff && bDiff) {
            return ConflictResolutionStatus.UNRESOLVED;
        }
        var orig = this.original["get" + PropertyName]();
        var a = this.first["get" + PropertyName]();
        var b = this.second["get" + PropertyName]();
        var c = [];
        if (!aDiff) {
            c = b.slice();
        }
        else if (!bDiff) {
            c = a.slice();
        }
        resolved["set" + PropertyName](c);
        return ConflictResolutionStatus.RESOLVED;
    };
    return ConflictResolver;
}());
exports.ConflictResolver = ConflictResolver;
ConflictResolver.prototype.className = "com.privmx.plugin.tasks.main.data.ConflictResolver";

//# sourceMappingURL=ConflictResolver.js.map
