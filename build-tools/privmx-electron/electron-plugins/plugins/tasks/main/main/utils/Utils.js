"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Utils = (function () {
    function Utils() {
    }
    Utils.arraysEqual = function (a, b, equalCb) {
        if (a.length != b.length) {
            return false;
        }
        return this.orderedArraysEqual(a.slice().sort(), b.slice().sort(), equalCb);
    };
    Utils.orderedArraysEqual = function (a, b, equalCb) {
        if (a.length != b.length) {
            return false;
        }
        if (!equalCb) {
            equalCb = function (a, b) { return a == b; };
        }
        for (var i = 0; i < a.length; ++i) {
            if (!equalCb(a[i], b[i])) {
                return false;
            }
        }
        return true;
    };
    Utils.indexOfBy = function (arr, cmp) {
        for (var i = 0; i < arr.length; ++i) {
            if (cmp(arr[i])) {
                return i;
            }
        }
        return -1;
    };
    Utils.uniqueArrayMerge = function (dst, src, comparator) {
        if (comparator === void 0) { comparator = function (a, b) { return a == b; }; }
        for (var _i = 0, src_1 = src; _i < src_1.length; _i++) {
            var el = src_1[_i];
            var found = false;
            for (var _a = 0, dst_1 = dst; _a < dst_1.length; _a++) {
                var el2 = dst_1[_a];
                if (comparator(el, el2)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                dst.push(el);
            }
        }
    };
    Utils.arrayDiff = function (first, second) {
        var result = { added: [], removed: [] };
        for (var _i = 0, first_1 = first; _i < first_1.length; _i++) {
            var element = first_1[_i];
            if (second.indexOf(element) < 0) {
                result.removed.push(element);
            }
        }
        for (var _a = 0, second_1 = second; _a < second_1.length; _a++) {
            var element = second_1[_a];
            if (first.indexOf(element) < 0) {
                result.added.push(element);
            }
        }
        return result;
    };
    return Utils;
}());
exports.Utils = Utils;
Utils.prototype.className = "com.privmx.plugin.tasks.main.utils.Utils";

//# sourceMappingURL=Utils.js.map
