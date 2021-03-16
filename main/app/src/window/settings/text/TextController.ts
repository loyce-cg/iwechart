import {BaseController} from "../BaseController";
import {SettingsWindowController} from "../SettingsWindowController";
import {UI, UserPreferences, PasteAsFileAction, ContentEditableEditorSettings} from "../../../mail/UserPreferences";
import {mail, utils} from "../../../Types";
import {Inject} from "../../../utils/Decorators"
import { LocaleService, MailConst } from "../../../mail";
import { i18n } from "../i18n";
import { EncryptionEffectController } from "../../../component/encryptioneffect/main";

export interface NotesPreferences {
    style?: string;
}

export interface SpellCheckerLanguage {
    code: string;
    spellCheckerCode: string;
}

export interface Model {
    ui: UI;
    isElectron: boolean;
    systemLabel?: string;
    osSuffix: string;
    isEncryptionEffectFeatureEnabled?: boolean;
    availablePasteAsFileActions: PasteAsFileAction[];
    availableSpellCheckerLanguages: SpellCheckerLanguage[];
    spellCheckerLanguages: string[];
    notes: NotesPreferences;
    availableNotesStyles: { [name: string]: string };
    contentEditableEditor:ContentEditableEditorSettings;
    platform: string;
}

export class TextController extends BaseController {
    
    static textsPrefix: string = "window.settings.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static tabId = "text";
    
    @Inject userPreferences: UserPreferences;
    
    constructor(parent: SettingsWindowController) {
        super(parent);
        this.ipcMode = true;
        this.userPreferences = this.parent.userPreferences;
    }
    
    prepare(): void {
        this.app.getComponent("editor-plugin").getNotesPreferences().then((notes: NotesPreferences) => {
            let cedPrefs = this.userPreferences.data.contentEditableEditor || {};
            Object.keys(UserPreferences.DEFAULTS.contentEditableEditor).forEach(key => {  
                if ((<any>cedPrefs)[key] == null) {
                    (<any>cedPrefs)[key] = (<any>UserPreferences.DEFAULTS.contentEditableEditor)[key];
                }
            })
            let availableSpellCheckerLanguages: SpellCheckerLanguage[] = [];
            if (this.app.isElectronApp()) {
                let tmpAvailableSpellCheckerLanguages = this.parent.nwin.getAvailableSpellCheckerLangauges();
                availableSpellCheckerLanguages = this.app.localeService.availableLangs
                    .map(x => LocaleService.AVAILABLE_LANGS.find(y => y.code == x))
                    .filter(x => !!x)
                    .map(x => ({
                        code: x.code,
                        spellCheckerCode: x.spellCheckerCode,
                    }))
                    .filter(x => tmpAvailableSpellCheckerLanguages.indexOf(x.spellCheckerCode) >= 0);
            }
            let model: Model = {
                ui: this.userPreferences.data.ui,
                isElectron: this.app.isElectronApp(),
                systemLabel: this.app.isElectronApp() ? (<any>this.app).getSystemLabel() : null,
                osSuffix: this.app.isElectronApp() ? "." + process.platform : "",
                isEncryptionEffectFeatureEnabled: EncryptionEffectController.FEATURE_ENABLED,
                availablePasteAsFileActions: [PasteAsFileAction.ASK, PasteAsFileAction.PASTE_AS_TEXT, PasteAsFileAction.PASTE_AS_FILE],
                availableSpellCheckerLanguages: availableSpellCheckerLanguages,
                spellCheckerLanguages: this.app.userPreferences.getSpellCheckerLanguages(true),
                notes: notes,
                availableNotesStyles: this.getAvailableNotesStyles(),
                contentEditableEditor: cedPrefs,
                platform: process.platform,
            };
            this.callViewMethod("renderContent", model);
        });
    }
    
    getAvailableNotesStyles(): { [name: string]: string } {
        return {
            "default": "Default",
            "terminal": "Terminal",
            "black-on-white": "Black on white",
            "white-on-black": "White on black",
            "papyrus": "Papyrus"
        };
    }
    
}
