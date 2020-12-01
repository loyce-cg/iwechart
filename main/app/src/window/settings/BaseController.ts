import {WindowComponentController} from "../base/WindowComponentController";
import {SettingsWindowController, PreferencesToSave} from "./SettingsWindowController";
import * as Q from "q";
import {UserPreferences} from "../../mail/UserPreferences";
import {Inject} from "../../utils/Decorators";
import {utils} from "../../Types";

export abstract class BaseController extends WindowComponentController<SettingsWindowController> {
    
    @Inject userPreferences: UserPreferences;
    @Inject identityProvider: utils.IdentityProvider;
    parent: SettingsWindowController;
    isUserExternal: boolean;
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
        this.identityProvider = this.parent.identityProvider;
        this.isUserExternal = this.identityProvider.getRights().indexOf("normal") == -1;
    }
    
    abstract prepare(): Q.IWhenable<void>;
    
    updateAutostartSetting(enabled: boolean): Q.Promise<void> {
        return Q().then(() => {
            if (! this.app.isElectronApp()) {
                return;
            }
            let isSetEnabled: boolean = (<any>this.app).isAutostartEnabled();
            if (isSetEnabled == enabled) {
                return;
            }
            (<any>this.app).setAutostartEnabled(enabled);
        })
    }

    getAutostartSetting(): boolean {
        let isSetEnabled: boolean = (<any>this.app).isAutostartEnabled();
        return isSetEnabled;        
    }

    onViewSave(settingsMapStr: string): void {
        let settingsMap: PreferencesToSave = JSON.parse(settingsMapStr);
        let settingsToSave = settingsMap;
        let notifyOnLangChange = "ui.lang" in settingsToSave && this.userPreferences.data.ui.lang != settingsToSave["ui.lang"];
        
        let autostartEnabled: boolean = this.getAutostartSetting();
        if ("ui.autostartEnabled" in settingsToSave) {
            autostartEnabled = settingsToSave["ui.autostartEnabled"];
            
            // ustawienie trzymamy tylko w pliku profilu
            delete settingsToSave["ui.autostartEnabled"];
        }


        if (this.isUserExternal && settingsToSave["profile.name"] && settingsToSave["profile.name"].length == 0) {
            settingsToSave["profile.name"] = this.identityProvider.getLogin();
        }
        
        this.addTaskEx("", true, () => {
            return Q().then(() => {
                return this.userPreferences.setMany(settingsToSave, true);
            })
            .then(() => {
                if (notifyOnLangChange) {
                    return this.app.msgBox.alert(this.i18n("window.settings.section.interface.lang.info.text"));
                }
            })
            .then(() => {
                return this.updateAutostartSetting(autostartEnabled)
            })
            .fin(() => {
                Q.delay(500)
                .then(() => {
                    this.callViewMethod("clearSaveButtonState");
                });
            });
        });
    }
}
