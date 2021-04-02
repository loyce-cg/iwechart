import {window, utils, privfs, Q, mail} from "pmc-mail";
import {TwofaService, AdditionalLoginStepData} from "../../main/TwofaService";
import {TwofaEnableData, TwofaData} from "../../main/TwofaApi";
import {CodeWindowController} from "../code/CodeWindowController";
import {i18n} from "./i18n/index";
import * as base32 from "thirty-two";
import Inject = utils.decorators.Inject;

export interface Model {
    methods: string[];
    enabled: boolean;
    type: string;
    googleAuthenticatorKey: string;
    googleAuthenticatorKeyUri: string;
    email: string;
    mobile: string;
}

export class SettingsTwofaWindowController extends window.settings.BaseController {
    
    static textsPrefix: string = "plugin.twofa.window.settingstwofa.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    twofaService: TwofaService;
    is2faEnabled: boolean = null;
    
    constructor(parent: window.settings.SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.identity = this.parent.identity;
        this.twofaService = this.app.getComponent("twofa-plugin");
        this.parent.registerTab({id: "plugin-twofa", tab: this});
        this.parent.addViewScript({path: "build/view.js", plugin: "twofa"});
        this.parent.addViewStyle({path: "window/settingstwofa/template/main.css", plugin: "twofa"});
    }
    
    prepare(): Q.Promise<void> {
        return Q().then(() => {
            return this.twofaService.api.getData();
        })
        .then(result => {
            let data = result.data || <TwofaData>{};
            let model: Model = {
                methods: result.methods,
                enabled: "enabled" in data ? data.enabled : false,
                type: data.type || "googleAuthenticator",
                googleAuthenticatorKey:  data.googleAuthenticatorKey || this.generateGoogleAuthenticatorKey(),
                googleAuthenticatorKeyUri: "",
                email: data.email || "",
                mobile: data.mobile || ""
            };
            if (model.methods.indexOf(model.type) == -1) {
                model.enabled = false;
                model.type = model.methods[0];
            }
            model.googleAuthenticatorKeyUri = this.getGoogleAuthenticatorKeyUri(model.googleAuthenticatorKey);
            this.is2faEnabled = model.enabled;
            this.callViewMethod("renderContent", model);
        });
    }
    
    onViewEnable(data: TwofaEnableData) {
        if (data.type == "email" && (!data.email || !/^[a-z0-9_\.\+-]+@[a-z0-9_\.-]+$/.test(data.email))) {
            this.callViewMethod("finishSaving");
            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.error.email"));
            return;
        }
        if (data.type == "sms" && (!data.mobile || !/^[0-9\+ ]{3,18}$/.test(data.mobile))) {
            this.callViewMethod("finishSaving");
            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.error.mobile"));
            return;
        }
        if (data.type == "googleAuthenticator" && (!data.googleAuthenticatorKey || !/^[234567a-z ]{32,39}$/.test(data.googleAuthenticatorKey))) {
            this.callViewMethod("finishSaving");
            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.error.googleAuthenticatorKey"));
            return;
        }
        this.addTaskEx("", true, () => {
            let saved: boolean = false;
            return Q().then(() => {
                return this.twofaService.api.enable(data);
            })
            .then(res => {
                let als: AdditionalLoginStepData = {
                    reason: "twofa",
                    type: data.type,
                    mobile: data.mobile,
                    email: data.email
                };
                if (!CodeWindowController.isSupported(als)) {
                    return Q.reject<void>("Unsupported 2FA type " + data.type);
                }
                return this.ioc.create(CodeWindowController, [this.parent, {
                    data: als,
                    api: this.twofaService.api,
                    cancellable: true,
                    host: this.identity.host,
                    u2f: {register: res.webauthnRegister, login: null}
                }]).then(win => {
                    win.open();
                    return win.getPromise().then(() => {
                        this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.successEnable"));
                        this.is2faEnabled = true;
                        this.callViewMethod("resetDirty");
                        saved = true;
                    })
                    .fail(e => {
                        this.logError(e);
                        if (e === "additional-login-step-fail") {
                            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.additionalLoginStepFail"));
                        }
                        else if (e !== "additional-login-step-cancel") {
                            this.parent.alert(this.i18n("plugin.twofa.window.settingstwofa.unknown"));
                        }
                    });
                });
            })
            .fin(() => {
                this.callViewMethod("finishSaving", saved);
            });
        });
    }
    
    onViewDisable() {
        if (!this.is2faEnabled) {
            this.callViewMethod("setEnabled", false);
            return;
        }
        this.parent.confirmEx({
            message: this.i18n("plugin.twofa.window.settingstwofa.confirm.disable"),
            yes: {
                visible: true,
            },
            no: {
                visible: true,
            },
        }).then(result => {
            if (result.result == "yes") {
                return this.twofaService.api.disable()
                .then(() => {
                    this.is2faEnabled = false;
                    this.callViewMethod("setEnabled", false);
                });
            }
        })
        .fail(this.errorCallback);
    }
    
    onViewGenerateGoogleAuthenticatorKey() {
        let key = this.generateGoogleAuthenticatorKey();
        let uri = this.getGoogleAuthenticatorKeyUri(key);
        this.callViewMethod("setGoogleAuthenticatorKey", key, uri);
    }
    
    generateGoogleAuthenticatorKey() {
        let key = privfs.crypto.service.randomBytes(20);
        let encoded = base32.encode(key);
        return this.formatGoogleAuthenticatorKey(encoded.toString("utf8").replace(/=/g, ""));
    }
    
    formatGoogleAuthenticatorKey(key: string): string {
        return key.toLowerCase().replace(/\W+/g, "").replace(/=/g, "").replace(/(\w{4})/g, "$1 ").trim();
    }
    
    getGoogleAuthenticatorKeyUri(key: string): string {
        let encodedKey = key.toUpperCase().replace(/\W+/g, "");
        return "otpauth://totp/" + this.app.userCredentials.hashmail.host + ":" + this.app.userCredentials.hashmail.user + "?secret=" + encodedKey + "&issuer=" + this.app.userCredentials.hashmail.host + "&algorithm=SHA1&digits=6&period=30";
    }
}