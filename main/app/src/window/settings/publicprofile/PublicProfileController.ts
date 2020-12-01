import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {Profile, UserPreferences} from "../../../mail/UserPreferences";
import * as Utils from "simplito-utils";
import {utils} from "../../../Types";
import {Lang} from "../../../utils/Lang";
import * as privfs from "privfs-client";
import {Inject} from "../../../utils/Decorators"
import { LocaleService } from "../../../mail";
import { i18n } from "../i18n";

export interface Model {
    profile: Profile;
    hashmail: string;
    testMode: boolean;
    loginExternal?: string;
}

export class PublicProfileController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "publicProfile";
    
    @Inject identity: privfs.identity.Identity;
    @Inject userPreferences: UserPreferences;
    @Inject identityProvider: utils.IdentityProvider;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.identity = this.parent.identity;
        this.identityProvider = this.parent.identityProvider;
        this.userPreferences = this.parent.userPreferences;
    }
    
    prepare(): void {
        let profile = this.userPreferences.data.profile;
        profile = profile ? Utils.simpleDeepClone(profile) : {};
        if (profile.name) {
            profile.name = Lang.getTrimmedString(profile.name);
        }
        if (profile.description) {
            profile.description = Lang.getTrimmedString(profile.description);
        }
        let model: Model = {
            profile: profile,
            hashmail: this.identity.hashmail,
            
            testMode: this.app.isTestMode(),
            loginExternal: this.identityProvider.getRights().indexOf("normal") == -1 ? this.identityProvider.getLogin() : null
        };
        this.callViewMethod("renderContent", model);
    }
}
