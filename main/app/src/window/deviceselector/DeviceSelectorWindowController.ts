import { BaseWindowController } from "../base/BaseWindowController";
import { app } from "../../Types";
import * as Q from "q";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { BaseWindowManager, ElectronPartitions } from "../../app";
import { SelectedDevices, SelectedDevicesManager } from "./SelectedDevices";
import { CustomSelectController, CustomSelectItem } from "../../component/customselect/main";
import { Dependencies } from "../../utils/Decorators";

export interface DeviceSelectorOptions {
    videoInput: boolean;
    audioInput: boolean;
    audioOutput: boolean;
    withDisabledOption?: boolean;
    withPreviews?: boolean;
    audioOutputPreviewFilePath?: string;
    docked?: boolean;
}

export interface SavedState {
    videoInput: string | false | null;
    audioInput: string | false | null;
    audioOutput: string | false | null;
}

export interface Model {
    chooseVideoInput: boolean;
    chooseAudioInput: boolean;
    chooseAudioOutput: boolean;
    withDisabledOption: boolean;
    withPreviews: boolean;
    audioOutputPreviewFilePath: string;
    docked: boolean;
    selectedVideoInput: string;
    selectedAudioInput: string;
    selectedAudioOutput: string;
}

export interface DeviceSelectorResult {
    selected: boolean;
    videoInput?: string | false | null;
    audioInput?: string | false | null;
    audioOutput?: string | false | null;
}

@Dependencies(["customselect"])
export class DeviceSelectorWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.deviceselector.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    videoInputCustomSelect: CustomSelectController;
    audioInputCustomSelect: CustomSelectController;
    audioOutputCustomSelect: CustomSelectController;
    
    private _isDirty: boolean = false;
    private _screenCoverPreventionInterval: number | null = null;
    private _selectedDevicesManager: SelectedDevicesManager;
    private _resultDeferred: Q.Deferred<DeviceSelectorResult> = Q.defer();
    private _savedState: SavedState = null;
    
    constructor(parent: app.WindowParent, public options: DeviceSelectorOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 500;
        this.openWindowOptions.height = 260;
        this.openWindowOptions.title = this.i18n("window.deviceselector.title");
        this.openWindowOptions.icon = "icon " + (options.videoInput ? "privmx-icon privmx-icon-videocall" : "fa fa-microphone");
        if (!this.options.docked) {
            this.openWindowOptions.backgroundColor = "#292929";
        }
        this.openWindowOptions.modal = true;
        this.openWindowOptions.electronPartition = ElectronPartitions.HTTPS_SECURE_CONTEXT;
        this._startScreenCoverPreventionInterval();
        this._selectedDevicesManager = new SelectedDevicesManager(this.app);
        
        this.videoInputCustomSelect = this.addComponent("videoInputCustomSelect", this.componentFactory.createComponent("customselect", [this, {
            items: [],
            editable: true,
            size: "small",
        }]));
        this.audioInputCustomSelect = this.addComponent("audioInputCustomSelect", this.componentFactory.createComponent("customselect", [this, {
            items: [],
            editable: true,
            size: "small",
        }]));
        this.audioOutputCustomSelect = this.addComponent("audioOutputCustomSelect", this.componentFactory.createComponent("customselect", [this, {
            items: [],
            editable: true,
            size: "small",
        }]));
    }
    
    init() {
        return Q().then(() => {
        });
    }
    
    getModel(): Model {
        const selectedDevices = this._selectedDevicesManager.getCurrentSelectedDevices() || {};
        return {
            chooseVideoInput: this.options.videoInput,
            chooseAudioInput: this.options.audioInput,
            chooseAudioOutput: this.options.audioOutput,
            withDisabledOption: this.options.withDisabledOption,
            withPreviews: this.options.withPreviews,
            audioOutputPreviewFilePath: this.options.audioOutputPreviewFilePath,
            docked: this.options.docked,
            selectedVideoInput: selectedDevices.videoInput || null,
            selectedAudioInput: selectedDevices.audioInput || null,
            selectedAudioOutput: selectedDevices.audioOutput || null,
        };
    }
    
    getResultPromise(): Q.Promise<DeviceSelectorResult> {
        return this._resultDeferred.promise;
    }
    
    onViewCancel(): void {
        this.saveWindowState = null;
        if (this.options.docked) {
            this.updateViewModel();
        }
        else {
            this.close();
        }
    }
    
    async onViewSave(savedStateStr: string): Promise<void> {
        await this.save(JSON.parse(savedStateStr));
        this.setDirty(false);
        if (this.options.docked) {
            this.updateViewModel();
        }
        else {
            this.close();
        }
    }
    
    updateViewModel(): void {
        const model = this.getModel();
        this.callViewMethod("updateModel", JSON.stringify(model));
    }
    
    onViewSetDirty(dirty: boolean): void {
        this.setDirty(dirty);
    }
    
    setDirty(dirty: boolean): void {
        if (dirty === this._isDirty) {
            return;
        }
        this._isDirty = dirty;
        if (!this.options.docked) {
            this.nwin.setDirty(this._isDirty);
        }
    }
    
    async save(savedState: SavedState): Promise<void> {
        this._savedState = savedState;
        let selectedDevices: SelectedDevices = this._selectedDevicesManager.getCurrentSelectedDevices() || {};
        if (this.options.videoInput && savedState.videoInput !== false) {
            selectedDevices.videoInput = savedState.videoInput;
        }
        if (this.options.audioInput && savedState.audioInput !== false) {
            selectedDevices.audioInput = savedState.audioInput;
        }
        if (this.options.audioOutput && savedState.audioOutput !== false) {
            selectedDevices.audioOutput = savedState.audioOutput;
        }
        await this._selectedDevicesManager.setCurrentSelectedDevices(selectedDevices);
    }
    
    beforeClose(force?: boolean): Q.IWhenable<void> {
        if (this.options.docked) {
            return;
        }
        
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        
        if (force || !this._isDirty) {
            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
            this._stopScreenCoverPreventionInterval();
            this._resolveResultFromSavedState();
            return;
        }
        this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
        
        let defer = Q.defer<void>();
        this._onBeforeCloseWhenDirty().then(({ close }) => {
            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
            if (close) {
                this._stopScreenCoverPreventionInterval();
                defer.resolve();
            }
            else {
                this.app.manager.cancelClosing();
                defer.reject();
            }
        });
        defer.promise.then(() => {
            this._resolveResultFromSavedState();
        });
        return defer.promise;
    }
    
    private _resolveResultFromSavedState(): void {
        this._resultDeferred.resolve({
            selected: this._savedState ? true : false,
            videoInput: this._savedState ? this._savedState.videoInput : undefined,
            audioInput: this._savedState ? this._savedState.audioInput : undefined,
            audioOutput: this._savedState ? this._savedState.audioOutput : undefined,
        });
    }
    
    private async _onBeforeCloseWhenDirty(): Promise<{ close: boolean }> {
        const { close, saveChanges } = await this._askAboutChangesBeforeClosing();
        if (saveChanges) {
            const savedStateStr: string = await this.retrieveFromView<string>("getStateStr");
            await this.save(JSON.parse(savedStateStr));
        }
        return { close };
    }
    
    private async _askAboutChangesBeforeClosing(): Promise<{ close: boolean, saveChanges: boolean }> {
        const result = await this.confirmEx({
            title: this.i18n("window.deviceselector.unsavedMessage.title"),
            message: this.i18n("window.deviceselector.unsavedMessage.message"),
            yes: {
                visible: true,
                label: this.i18n("core.button.yes.label"),
            },
            no: {
                visible: true,
                label: this.i18n("core.button.no.label"),
                btnClass: "btn-warning",
            },
            cancel: {
                visible: true,
                label: this.i18n("core.button.cancel.label"),
            },
        });
        if (result.result == "yes") {
            return { close: true, saveChanges: true };
        }
        if (result.result == "no") {
            return { close: true, saveChanges: false };
        }
        if (result.result == "cancel") {
            return { close: false, saveChanges: false };
        }
        return { close: false, saveChanges: false };
    }
    
    private _startScreenCoverPreventionInterval(): void {
        this._stopScreenCoverPreventionInterval();
        this._screenCoverPreventionInterval = <any>setInterval(() => {
            this._onScreenCoverPreventionInterval();
        }, 10000);
    }
    
    private _stopScreenCoverPreventionInterval(): void {
        if (this._screenCoverPreventionInterval) {
            clearInterval(this._screenCoverPreventionInterval);
            this._screenCoverPreventionInterval = null;
        }
    }
    
    private _onScreenCoverPreventionInterval(): void {
        let listener = this.app.getUIEventsListener();
        if (listener) {
            listener();
        }
    }
    
    destroy(): void {
        this._stopScreenCoverPreventionInterval();
        super.destroy();
    }
    
    onViewSetDevicesList(devices: { id: string, label: string }[], selectedDeviceId: string | null, devicesType: "videoinput" | "audioinput" | "audiooutput"): void {
        let customSelect: CustomSelectController = null;
        if (devicesType == "videoinput") {
            customSelect = this.videoInputCustomSelect;
        }
        else if (devicesType == "audioinput") {
            customSelect = this.audioInputCustomSelect;
        }
        else if (devicesType == "audiooutput") {
            customSelect = this.audioOutputCustomSelect;
        }
        if (!customSelect) {
            return;
        }
        customSelect.setItems(devices.map(device => (<CustomSelectItem>{
            type: "item",
            icon: null,
            selected: device.id === selectedDeviceId,
            text: device.label.trim().length == 0 ? this.i18n("window.deviceselector.deviceName.emptyString") : device.label,
            value: device.id,
        })));
    }
    
}
