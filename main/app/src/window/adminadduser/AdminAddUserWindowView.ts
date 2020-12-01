import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Scope} from "../../web-utils/Scope";
import {Model, AddUserModel, UserType} from "./AdminAddUserWindowController";
import {app} from "../../Types";

export interface ScopeData {
    mode: "default" | "managable";
    username: string;
    email: string;
    description: string;
    sendActivationLink: boolean;
    notificationEnabled: boolean;
    adding: boolean;
    usertype: UserType;
    privateSectionAllowed?: boolean;
    addUser: () => void;
    close: () => void;
}

@WindowView
export class AdminAddUserWindowView extends BaseWindowView<Model> {
    
    scope: Scope<ScopeData>;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.scope = new Scope(this.$main, {
            mode: <"default" | "managable">"managable",
            username: "",
            email: "",
            description: "",
            usertype: <UserType>"regular",
            sendActivationLink: model.showSendActivationLink,
            notificationEnabled: false,
            privateSectionAllowed: false,
            adding: false,
            addUser: this.onAddUserClick.bind(this),
            close: this.onCloseClick.bind(this)
        });
        this.$main.on("change", "[vf-model=\"usertype\"]", this.updateUserTypeClass.bind(this));

        this.$main.on("change", "[vf-model=\"mode\"]", this.updateManagableClass.bind(this));
        this.$main.on("click", ".collapsable-switch", this.onCollapseExtendSwitch.bind(this));
        this.updateManagableClass();
        this.updateUserTypeClass();
    }
    
    onAddUserClick(event: MouseEvent): void {
        this.scope.data.adding = true;
        this.scope.onChange();
        let data: AddUserModel = {
            username: this.scope.data.username,
            userType: this.scope.data.usertype,
            email: this.scope.data.email,
            description: this.scope.data.description,
            sendActivationLink: this.scope.data.sendActivationLink,
            notificationEnabled: this.scope.data.notificationEnabled,
            privateSectionAllowed: this.scope.data.privateSectionAllowed
        };
        this.triggerEvent("addUser", data, this.scope.data.mode == "managable");
    }
    
    unlockForm(): void {
        this.scope.data.adding = false;
        this.scope.onChange();
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    updateManagableClass() {
        let managable = this.scope.data.mode == "managable";
        this.$main.toggleClass("managable", managable);
        this.$main.toggleClass("not-managable", !managable);
        this.refreshWindowHeight();
    }

    updateUserTypeClass() {
        let usertype = this.scope.data.usertype;
        this.$main.find(".type-regular").toggleClass("hide", usertype != "regular");
        this.$main.find(".type-basic").toggleClass("hide", usertype != "basic");
        this.$main.find(".type-keeper").toggleClass("hide", usertype != "keeper")
    }


    onCollapseExtendSwitch(e: Event): void {
        let $e = $(e.target).closest(".link");
        let action = $e.attr("collapsable-role");
        let group = $e.parent().attr("collapsable-id");
        this.triggerEvent("setWindowHeightForMode", action);

        $e.parent().find(".link[collapsable-role=extend]").toggleClass("collapsed", action == "extend");
        $e.parent().find(".link[collapsable-role=collapse]").toggleClass("collapsed", action == "collapse");

        if (action == "extend") {
            this.$main.find("[collapsable-id='" + group + "']").toggleClass("collapsed", false);
        }
        else
        if (action == "collapse") {
            this.$main.find("[collapsable-id='" + group + "']").toggleClass("collapsed", true);
        }
    }
}
