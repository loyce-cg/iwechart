import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {BaseView} from "./BaseView";
import {LoginView} from "./login/LoginView";
import {AlternativeLoginView} from "./alternativelogin/AlternativeLoginView";
import {RegisterView} from "./register/RegisterView";
import {AfterRegisterView} from "./afterregister/AfterRegisterView";
import {RegisterNewWayView} from "./registernewway/RegisterNewWayView";
import * as $ from "jquery";
import {func as mainTemplate} from "./template/main.html";
import {func as updatesTemplate} from "./template/updates.html";

import {ContextMenu} from "../../web-utils/ContextMenu";
import * as Q from "q";
import {Model} from "./LoginWindowController";
import {app} from "../../Types";
import { ActivateView } from "./activate/ActivateView";
import { ActivateNewWayView } from "./activatenewway/ActivateNewWayView";
import { ContainerWindowView } from "../container/ContainerWindowView";
// import { WayChooserView } from "./waychooser/WayChooserView";

@WindowView
export class LoginWindowView extends BaseWindowView<Model> {
    
    login: LoginView;
    alternativeLogin: AlternativeLoginView;
    register: RegisterView;
    activate: ActivateView;
    activateNewWay: ActivateNewWayView;
    // wayChooser: WayChooserView;
    afterRegister: AfterRegisterView;
    registerNewWay: RegisterNewWayView;
    active: BaseView<any>;
    $updates: JQuery;
    $updatesContainer: JQuery;
    $updatesInProgress: JQuery;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate, "api.login.notification");
        this.login = this.addComponent("login", new LoginView(this));
        this.alternativeLogin = this.addComponent("alternativeLogin", new AlternativeLoginView(this));
        this.register = this.addComponent("register", new RegisterView(this));
        this.activate = this.addComponent("activate", new ActivateView(this));
        this.activateNewWay = this.addComponent("activateNewWay", new ActivateNewWayView(this));
        // this.wayChooser = this.addComponent("wayChooser", new WayChooserView(this));
        // this.afterRegister = this.addComponent("afterRegister", new AfterRegisterView(this));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q().then(() => {
            return Q.all([
                this.login.triggerInit(),
                this.alternativeLogin.triggerInit(),
                this.register.triggerInit(),
                this.activate.triggerInit(),
                // this.wayChooser.triggerInit(),
                this.activateNewWay.triggerInit()
            ])
        })
        .then(() => {
            this.$main.find(".main")
                .append(this.login.$main)
                .append(this.alternativeLogin.$main)
                .append(this.register.$main)
                .append(this.activate.$main)
                .append(this.activateNewWay.$main);
                // .append(this.wayChooser.$main);
            this.$main.on("click", ".langs-menu", this.onLangsMenuClick.bind(this));
            this.$main.on("click", "[data-url]", this.onUrlClick.bind(this));
            this.$main.on("click", "[data-trigger]", this.onTriggerClick.bind(this));
            this.$main.on("click", "[data-action-id]", this.onActionClick.bind(this));
            this.$main.on("click", ".section-header #close-button", this.onCloseInfoClick.bind(this));
            this.$main.on("click", "[data-action='activate-account']", this.onActivateAccountClick.bind(this));
            this.$main.on("click", "[trigger-action=open-license]", this.openLicense.bind(this));

            let $container = this.$main.find(".main");            
            $container.append($("<div class='license-docked page'></div>"));

            // this.active = (<any>this)[model.active];

            // console.log("active window in view", this.active, model.active);

            // this.active.activate(null, true);

            this.setActive(model.active);
            
            if (model.forceUpdate) {
                this.$updatesContainer = this.$main.find(".updates-container");
                this.renderUpdates(model);
            }
        });
    }
    
    openLicense(): void {
        this.triggerEvent("openLicense");
    }

    activateLicense(): void {
        this.$main.find(".license-docked").toggleClass("active", true);
    }

    isLicenseActive(): boolean {
        return this.$main.find(".license-docked").hasClass("active");
    }

    deactivateLicense(): void {
        this.$main.find(".license-docked").toggleClass("active", false);
    }

    setActive(name: string): void {
        this.$main.find(".activate-link").toggleClass("hide", name != "login");
        this.$main.find(".logo-container").toggleClass("hide", name != "login");
        if (this.active) {
            this.active.deactivate(() => {
                if (name == "license") {
                    this.activateLicense();
                }
                else {
                    this.active = (<any>this)[name];
                    this.active.name = name;
                    this.active.activate();
                }
            }, (this.active.name && this.active.name == "activate") || name == "activate" ? true: false);
        }
        else if(this.isLicenseActive()) {
            if (name != "license") {
                this.deactivateLicense();
                this.active = (<any>this)[name];
                this.active.name = name;
                this.active.activate();
            }
        }
        else {
            if (name == "license") {
                this.activateLicense();
            }
            else {
                this.active = (<any>this)[name];
                this.active.name = name;
                this.active.activate();    
            }
        }
    }
    
    onTriggerClick(event: Event): void {
        let $elem = $(event.currentTarget);
        let action = $elem.data("trigger");
        
        if ($elem.hasClass("window-header-button") && (action === "windowClose" || action === "windowMinimize" || action === "windowToggleMaximize")) {
            this.triggerEvent(action);
        }
    }
    
    onLangsMenuClick(): boolean {
        ContextMenu.show({
            $element: true,
            $contextMenu: this.$main.find(".langs-menu .context-menu-nav-bar").clone().addClass("context-menu"),
            handler: this.onLangsMenuAction.bind(this)
        });
        return false;
    }
    
    onLangsMenuAction(action: string, event: Event): void {
        let lang = $(event.currentTarget).data("lang");
        this.triggerEvent("changeLang", lang);
    }
    
    onUrlClick(event: Event): boolean {
        let url = $(event.currentTarget).data("url");
        this.triggerEventInTheSameTick("openUrl", url);
        return false;
    }
    
    onActionClick(e: MouseEvent): void {
        let action = $(e.currentTarget).closest("[data-action-id]").data("action-id");
        this.setUpdateStatus("checking");
        this.triggerEvent("action", action);
    }
    
    setUpdateStatus(status: string): void {
        this.$updates.toggleClass("hide", !(status == "available" || status == "readyToInstall"));
        this.$updatesInProgress.toggleClass("hide", status == "available" || status == "readyToInstall");

        this.$updates.children("span").toggleClass("hide", true);
        this.$updatesInProgress.children("span").toggleClass("hide", true);
        this.$updates.find("." + status).toggleClass("hide", false);
        this.$updatesInProgress.find("." + status).toggleClass("hide", false);
    }
    
    setDownloadProgress(progress: number): void {
        this.$updatesInProgress.find(".download-progress").text(progress + "%");
    }
    
    renderUpdates(model: Model): void {
        this.templateManager.createTemplate(updatesTemplate).renderToJQ(model);
        this.$updates = this.$main.find(".updates");
        this.$updatesInProgress = this.$main.find(".updates-in-progress");
    }
    
    disableLangChooser(): void {
        this.$main.find(".lang-chooser").prop("disabled", true);
    }
    
    
    onCloseInfoClick(): void {
      this.$main.find(".section-header").hide();
      this.triggerEvent("hideLoginInfo");
    }
    
    onActivateAccountClick(): void {
        this.triggerEvent("activateAccount");
    }
    
    initAfterRegisterAndActivate() {
        Q().then(() => {
          this.afterRegister = this.addComponent("afterRegister", new AfterRegisterView(this));
          return this.afterRegister.triggerInit();
      })
      .then(() => {
          this.$main.find(".main").append(this.afterRegister.$main);
          this.setActive("afterRegister");
      })
    }

    initRegisterNewWayAndActivate() {
        Q().then(() => {
          this.registerNewWay = this.addComponent("registerNewWay", new RegisterNewWayView(this));
          return this.registerNewWay.triggerInit();
      })
      .then(() => {
          this.$main.find(".main").append(this.registerNewWay.$main);
          this.setActive("registerNewWay");
      })

    }
    showIframe(id: number, load: app.WindowLoadOptions) {
        let $container = this.$main.find(".iframe-container");
        let $iframe = $container.find(".iframe-container#iframe-" + id);
        if ($iframe.length > 0) {
            // this.clearPreview();
            $iframe.addClass("active");
            // this.hideEditorLoader();
        }
        else {
            // this.clearPreview();
            let $active = $('<div id="iframe-' + id + '" class="iframe-container active"></div>');
            $container.append($active);
            this.viewManager.parent.registerDockedWindow(id, load, $active[0]);
        }
    }

    registerDockedLicense(id: number, load: app.WindowLoadOptions) {
        let $container = this.$main.find(".license-docked");
        this.viewManager.parent.registerDockedWindow(id, load, $container[0]);
    }

}
