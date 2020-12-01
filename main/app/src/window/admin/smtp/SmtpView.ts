import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as summaryTemplate} from "./template/summary.html";
import {Scope} from "../../../web-utils/Scope";
import {AdminWindowView} from "../AdminWindowView";
import {SmtpConfig, SmtpInnerConfig} from "./SmtpController";
import * as Utils from "simplito-utils";

export interface ScopeData {
    smtpCfg: SmtpInnerConfig;
    type: string;
    loaded: boolean;
    error: boolean;
    saveCfg: () => void
}

export class SmtpView extends BaseView<void> {
    
    scope: Scope<ScopeData>;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "smtp",
            priority: 500,
            groupId: "misc",
            icon: "envelope-square",
            labelKey: "window.admin.menu.smtp"
        };
    }
    
    initTab(): void {
        this.scope = new Scope(this.$main, {
            smtpCfg: {port: 25, auth: false, username: "", password: ""},
            type: null,
            loaded: false,
            error: false,
            saveCfg: this.onSaveCfg.bind(this)
        });
        this.$main.on("input", "input, select", this.onInput.bind(this));
    }
    
    refreshContent(config: SmtpConfig) {
        this.scope.data.type = config.type;
        this.scope.data.smtpCfg = config.smtpCfg || {port: 25, auth: false, username: "", password: ""};
        this.scope.data.loaded = true;
        this.scope.data.error = false;
        this.scope.onChange();
    }
    
    showSaveSuccess(): void {
        this.$main.append(this.templateManager.createTemplate(summaryTemplate).renderToJQ());
    }
    
    showSaveError(): void {
        this.scope.data.error = true;
        this.scope.onChange();
    }
    
    onSaveCfg(e: Event): void {
        this.scope.data.error = false;
        this.scope.onChange();
        let data: SmtpConfig = {
            type: this.scope.data.type
        };
        if (this.scope.data.type == "smtp") {
            data.smtpCfg = Utils.simpleDeepClone(this.scope.data.smtpCfg);
            data.smtpCfg.port = isFinite(data.smtpCfg.port) ? parseInt(<string><any>data.smtpCfg.port) : null;
            if (!data.smtpCfg.auth) {
                data.smtpCfg.username = "";
                data.smtpCfg.password = "";
            }
        }
        this.triggerEventWithProgress(e, "save", data);
    }
    
    onInput(): void {
        setTimeout(() => {
            this.scope.data.error = false;
            this.scope.onChange();
        }, 1);
    }
}
