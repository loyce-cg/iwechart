"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DataEncoder = (function () {
    function DataEncoder() {
    }
    DataEncoder.encode = function (obj) {
        if (typeof (obj) == "object") {
            if (obj == null) {
                return obj;
            }
            if (Array.isArray(obj)) {
                var res_1 = [];
                for (var _i = 0, obj_1 = obj; _i < obj_1.length; _i++) {
                    var x = obj_1[_i];
                    res_1.push(DataEncoder.encode(x));
                }
                return res_1;
            }
            if (obj.constructor.name == "Uint8Array" || obj.toString() == "[object ArrayBuffer]") {
                return Buffer.from(obj);
            }
            var res = {};
            for (var name_1 in obj) {
                res[name_1] = DataEncoder.encode(obj[name_1]);
            }
            return res;
        }
        return obj;
    };
    DataEncoder.decode = function (obj) {
        if (typeof (obj) == "object") {
            if (obj == null) {
                return obj;
            }
            if (Array.isArray(obj)) {
                var res_2 = [];
                for (var _i = 0, obj_2 = obj; _i < obj_2.length; _i++) {
                    var x = obj_2[_i];
                    res_2.push(DataEncoder.decode(x));
                }
                return res_2;
            }
            if (typeof (obj.toArrayBuffer) == "function") {
                return new Uint8Array(obj.toArrayBuffer());
            }
            var res = {};
            for (var name_2 in obj) {
                res[name_2] = DataEncoder.decode(obj[name_2]);
            }
            return res;
        }
        return obj;
    };
    return DataEncoder;
}());
exports.DataEncoder = DataEncoder;
DataEncoder.prototype.className = "com.privmx.plugin.twofa.main.DataEncoder";

//# sourceMappingURL=DataEncoder.js.map
