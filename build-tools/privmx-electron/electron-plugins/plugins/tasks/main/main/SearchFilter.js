"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SearchFilter = (function () {
    function SearchFilter() {
    }
    SearchFilter.prepareString = function (str) {
        return str
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l");
    };
    SearchFilter.prepareHaystack = function (haystack) {
        return this.prepareString(haystack);
    };
    SearchFilter.prepareNeedle = function (needle) {
        return this.prepareString(needle);
    };
    SearchFilter.matches = function (preparedNeedle, haystack) {
        var preparedHaystack = this.prepareString(haystack);
        return preparedHaystack.indexOf(preparedNeedle) >= 0;
    };
    return SearchFilter;
}());
exports.SearchFilter = SearchFilter;
SearchFilter.prototype.className = "com.privmx.plugin.tasks.main.SearchFilter";

//# sourceMappingURL=SearchFilter.js.map
