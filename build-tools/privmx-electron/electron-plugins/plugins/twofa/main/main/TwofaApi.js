"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TwofaApi = (function () {
    function TwofaApi(gateway) {
        this.gateway = gateway;
    }
    TwofaApi.prototype.getData = function () {
        return this.gateway.request("twofaGetData", {});
    };
    TwofaApi.prototype.disable = function () {
        return this.gateway.request("twofaDisable", {});
    };
    TwofaApi.prototype.enable = function (data) {
        return this.gateway.request("twofaEnable", { data: data });
    };
    TwofaApi.prototype.challenge = function (model) {
        return this.gateway.request("twofaChallenge", model);
    };
    TwofaApi.prototype.resendCode = function () {
        return this.gateway.request("twofaResendCode", {});
    };
    TwofaApi.TWOFA_NOT_ENABLED = 0x7001;
    TwofaApi.TWOFA_INVALID_TYPE = 0x7002;
    TwofaApi.TWOFA_CODE_ALREADY_RESEND = 0x7003;
    TwofaApi.TWOFA_INVALID_GOOLGE_AUTHENTICATOR_SECRET = 0x7004;
    TwofaApi.TWOFA_EMAIL_REQUIRED = 0x7005;
    TwofaApi.TWOFA_MOBILE_REQUIRED = 0x7006;
    TwofaApi.TWOFA_INVALID_CODE = 0x7007;
    TwofaApi.TWOFA_VERIFICATION_FAILED = 0x7008;
    return TwofaApi;
}());
exports.TwofaApi = TwofaApi;
TwofaApi.prototype.className = "com.privmx.plugin.twofa.main.TwofaApi";

//# sourceMappingURL=TwofaApi.js.map
