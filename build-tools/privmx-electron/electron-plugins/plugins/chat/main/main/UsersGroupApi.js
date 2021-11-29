"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var UsersGroupApi = (function () {
    function UsersGroupApi(srpSecure) {
        this.srpSecure = srpSecure;
    }
    UsersGroupApi.prototype.getUsersGroup = function (id) {
        return this.srpSecure.request("getUsersGroup", { id: id });
    };
    UsersGroupApi.prototype.getUsersGroups = function () {
        return this.srpSecure.request("getUsersGroups", {});
    };
    UsersGroupApi.prototype.createUsersGroup = function (id, type, users) {
        return this.srpSecure.request("createUsersGroup", { id: id, type: type, users: users });
    };
    UsersGroupApi.prototype.updateUsersGroup = function (id, type, users) {
        return this.srpSecure.request("updateUsersGroup", { id: id, type: type, users: users });
    };
    UsersGroupApi.prototype.addToUsersGroup = function (id, username) {
        return this.srpSecure.request("addToUsersGroup", { id: id, username: username });
    };
    UsersGroupApi.prototype.deleteUsersGroup = function (id) {
        return this.srpSecure.request("deleteUsersGroup", { id: id });
    };
    return UsersGroupApi;
}());
exports.UsersGroupApi = UsersGroupApi;
UsersGroupApi.prototype.className = "com.privmx.plugin.chat.main.UsersGroupApi";

//# sourceMappingURL=UsersGroupApi.js.map
