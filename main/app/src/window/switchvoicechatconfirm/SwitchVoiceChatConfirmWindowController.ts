import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import {Inject} from "../../utils/Decorators"
import {UserPreferences} from "../../mail/UserPreferences";
import { LocaleService, MailConst } from "../../mail";
import { i18n } from "./i18n";

export interface Model {
    warningDisabled?: boolean;
}

export enum Result {
    CANCEL,
    OK,
}

export class SwitchVoiceChatConfirmWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.switchVoiceChatConfirm.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject userPreferences: UserPreferences;
    onModalClose: (result: Result) => void;
    dontShowWarning: boolean;
    
    constructor(parent: app.WindowParent) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions = {
            modal: true,
            alwaysOnTop: true,
            showInactive: false,
            toolbar: false,
            maximized: false,
            maximizable: false,
            minimizable: false,
            show: false,
            position: "center-always",
            minWidth: 350,
            minHeight: 215,
            width: 400,
            height: 220,
            resizable: false,
            title: this.app.localeService.i18n("window.switchVoiceChatConfirm.title"),
            icon: "fa fa-microphone"
        };
    }
    
    getModel(): Model {
        return {
            warningDisabled: this.userPreferences.getValue(MailConst.SWITCH_VOICE_CHAT_SHOW_CONFIRM, false)
        };
    }
    
    onViewOpen(): void {
        this.dontShowWarning = this.userPreferences.getValue(MailConst.SWITCH_VOICE_CHAT_SHOW_CONFIRM, false);
    }
    
    onViewClose(): void {
        this.onModalClose(Result.CANCEL);
        this.close();
    }
    
    showModal(onModalClose: (result: Result) => void) {
        this.onModalClose = onModalClose;
        this.open();
        this.nwin.focus();
    }
    
    onViewDontShowAgain(): void {
    }
    
    onViewOk() {
        this.onModalClose(Result.OK);
        this.close();
    }
    
    onViewCheckboxChange(checked: boolean): void {
        this.dontShowWarning = checked;
        this.userPreferences.set(MailConst.SWITCH_VOICE_CHAT_SHOW_CONFIRM, this.dontShowWarning, true);
    }
}
