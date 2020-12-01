import {webUtils, window} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {Model} from "./SettingsTwofaWindowController";
import {TwofaEnableData} from "../../main/TwofaApi";
import QRious = require("qrious");

export class SettingsTwofaWindowView extends window.settings.BaseView<Model> {
    
    scope: webUtils.Scope<{
        methods: string[];
        enabled: boolean;
        type: string;
        googleAuthenticatorKey: string;
        email: string;
        mobile: string;
        saving: boolean;
        save: () => void;
        generateKey: () => void;
    }>;
    qr: QRious;
    
    constructor(parent: window.settings.SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "plugin-twofa",
            priority: 250,
            groupId: "account",
            icon: "lock",
            labelKey: "plugin.twofa.window.settingstwofa.menu.item.twofa.label"
        };
        this.parent.registerTab({tab: this});
    }
    
    afterRenderContent(model: Model) {
        this.scope = new webUtils.Scope(this.$main.find(".section"), {
            methods: model.methods,
            enabled: model.enabled,
            type: model.type,
            googleAuthenticatorKey: model.googleAuthenticatorKey,
            email: model.email,
            mobile: model.mobile,
            saving: false,
            save: this.onSaveButtonClick.bind(this),
            toggleEnabled: this.onToggleEnabled.bind(this),
            generateKey: this.onGenerateGoogleAuthenticatorKeyClick.bind(this)
        });
        this.qr  = new QRious({
          level: "M",
          size: 200,
          value: model.googleAuthenticatorKeyUri
        });
        this.$main.find(".canvas-placeholder").append(this.qr.canvas);
    }
    
    onToggleEnabled(): void {
        let newEnabled = !this.scope.data.enabled;
        if (!newEnabled) {
            this.triggerEvent("disable");
            this.updateDirty();
        }
        else {
            this.setEnabled(newEnabled);
        }
        setTimeout(() => {
            this.updateDirty();
        }, 0);
    }
    
    setEnabled(newEnabled: boolean): void {
        this.scope.data.enabled = newEnabled;
        this.scope.onChange();
        this.$main.find(".twofa-enabled").prop("checked", this.scope.data.enabled);
        this.updateDirty();
    }
    
    onSaveButtonClick(): void {
        this.scope.data.saving = true;
        this.scope.onChange();
        this.saveData();
    }
    
    onGenerateGoogleAuthenticatorKeyClick(): void {
        this.triggerEvent("generateGoogleAuthenticatorKey");
    }
    
    saveData() {
        let data: TwofaEnableData = {
            type: this.scope.data.type,
            googleAuthenticatorKey: this.scope.data.googleAuthenticatorKey,
            email: this.scope.data.type == "email" ? this.scope.data.email : "",
            mobile: this.scope.data.type == "sms" ? this.scope.data.mobile : ""
        };
        this.triggerEvent("enable", data);
    }
    
    finishSaving(resetDirty: boolean = false): void {
        setTimeout(() => {
            this.scope.data.saving = false;
            this.scope.onChange();
            if (resetDirty) {
                this.resetDirty();
            }
            setTimeout(() => {
                if (resetDirty) {
                    this.resetDirty();
                }
            }, 0);
        }, 500);
    }
    
    setGoogleAuthenticatorKey(key: string, uri: string): void {
        this.scope.data.googleAuthenticatorKey = key;
        this.qr.set({value: uri});
        this.scope.onChange();
    }
    
    getState(): string {
        return JSON.stringify({
            enabled: this.scope.data.enabled,
            type: this.scope.data.type,
            googleAuthenticatorKey: this.scope.data.googleAuthenticatorKey,
            email: this.scope.data.type == "email" ? this.scope.data.email : "",
            mobile: this.scope.data.type == "sms" ? this.scope.data.mobile : "",
        });
    }
    
    isDirty(): boolean {
        let currState = this.getState()
        return (currState != this.savedState);
    }
    
    resetDirty(): void {
        this.savedState = this.getState();
        this.updateDirty();
    }
    
}
