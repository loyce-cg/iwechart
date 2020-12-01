import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import {Scope} from "../../web-utils/Scope";
import {Model, AddUserModel} from "./AdminAddExternalUserWindowController";
import {app} from "../../Types";

export interface ScopeData {
    managable: boolean;
    username: string;
    usertype: string;
    login: string;
    privmxaddress: string;
    description: string;
    adding: boolean;
    privateSectionAllowed: boolean;
    addUser: () => void;
    close: () => void;
}

@WindowView
export class AdminAddExternalUserWindowView extends BaseWindowView<Model> {
    
    scope: Scope<ScopeData>;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: Model): void {
        this.scope = new Scope(this.$main, {
            managable: true,
            username: "",
            login: "",
            privmxaddress: "",
            description: "",
            adding: false,
            usertype: "privmx",
            privateSectionAllowed: false,
            addUser: this.onAddUserClick.bind(this),
            close: this.onCloseClick.bind(this)
        });
        this.$main.on("change", "[vf-model=\"managable\"]", this.updateManagableClass.bind(this));
        this.updateManagableClass();
        this.checkDefaultUserType();
    }
    
    onAddUserClick(event: MouseEvent): void {
        this.scope.data.adding = true;
        this.scope.onChange();
        let data: AddUserModel = {
            login: this.scope.data.login,
            privmxaddress: this.scope.data.privmxaddress,
            userType: this.scope.data.usertype,
            description: this.scope.data.description,
            privateSectionAllowed: this.scope.data.privateSectionAllowed
        };
        this.triggerEvent("addUser", data, this.scope.data.managable);
    }
    
    unlockForm(): void {
        this.scope.data.adding = false;
        this.scope.onChange();
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    updateManagableClass() {
        let managable = this.scope.data.managable;
        this.$main.toggleClass("managable", managable);
        this.$main.toggleClass("not-managable", !managable);
        this.refreshWindowHeight();
    }
    
    checkDefaultUserType(): void {
        this.scope.data.usertype = "email";
        this.scope.onChange();
    }

}
