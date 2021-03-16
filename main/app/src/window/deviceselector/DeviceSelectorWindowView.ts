import { BaseWindowView, WindowView } from "../base/BaseWindowView";
import { func as mainTemplate } from "./template/main.html";
import { Model } from "./DeviceSelectorWindowController";
import { app } from "../../Types";
import * as Q from "q";
import { CustomSelectView } from "../../component/customselect/web";
import { AudioLevelIndicator } from "../../component/audiolevelindicator/web";

interface HTMLAudioElementEx extends HTMLAudioElement {
    setSinkId: (deviceId: string) => Promise<void>;
}

@WindowView
export class DeviceSelectorWindowView extends BaseWindowView<Model> {
    
    static readonly DEVICE_OPTION_NAME__USE_DEFAULT = "@useDefault";
    static readonly DEVICE_OPTION_NAME__DISABLED = "@disabled";
    
    model: Model;
    
    // $videoInputSelect: JQuery<HTMLSelectElement>;
    // $audioInputSelect: JQuery<HTMLSelectElement>;
    // $audioOutputSelect: JQuery<HTMLSelectElement>;
    $saveButton: JQuery;
    $cancelButton: JQuery;
    
    videoInputCustomSelect: CustomSelectView;
    audioInputCustomSelect: CustomSelectView;
    audioOutputCustomSelect: CustomSelectView;
    
    audioLevelIndicator: AudioLevelIndicator;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.videoInputCustomSelect = this.addComponent("videoInputCustomSelect", new CustomSelectView(this, {}));
        this.audioInputCustomSelect = this.addComponent("audioInputCustomSelect", new CustomSelectView(this, {}));
        this.audioOutputCustomSelect = this.addComponent("audioOutputCustomSelect", new CustomSelectView(this, {}));
        this.videoInputCustomSelect.onChange(value => { this.onSelectChange("videoinput", value); });
        this.audioInputCustomSelect.onChange(value => { this.onSelectChange("audioinput", value); });
        this.audioOutputCustomSelect.onChange(value => { this.onSelectChange("audiooutput", value); });
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.model = model;
        this.$saveButton = this.$main.find("[data-action='save']");
        this.$cancelButton = this.$main.find("[data-action='cancel']");
        
        this.updateButtonStates();
        
        this.$main.on("click", "[data-action='cancel']", this.onCancelClick.bind(this));
        this.$main.on("click", "[data-action='save']", this.onSaveClick.bind(this));
        this.$main.on("click", "[data-action='preview-audio-output']", this.onPreviewAudioOutputClick.bind(this));
        
        return Q().then(() => {
            this.videoInputCustomSelect.$container = this.$main.find(".video-input-custom-select-container");
            this.audioInputCustomSelect.$container = this.$main.find(".audio-input-custom-select-container");
            this.audioOutputCustomSelect.$container = this.$main.find(".audio-output-custom-select-container");
            return Q.all([
                this.videoInputCustomSelect.triggerInit(),
                this.audioInputCustomSelect.triggerInit(),
                this.audioOutputCustomSelect.triggerInit(),
            ]);
        })
        .then(() => {
            return this._initDevicesList();
        })
        .then(() => {
            this.hideLoading();
            this.updateVideoInputPreview();
            this.updateAudioInputPreview();
        });
    }
    
    updateModel(modelStr: string): void {
        this.model = JSON.parse(modelStr);
        this.updateButtonStates();
    }
    
    private async _initDevicesList(): Promise<void> {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let videoInputDevices = devices.filter(x => x.kind == "videoinput");
        let audioInputDevices = devices.filter(x => x.kind == "audioinput");
        let audioOutputDevices = devices.filter(x => x.kind == "audiooutput");
        this.model.selectedVideoInput = this._getDeviceIdFromTheList(this.model.selectedVideoInput, videoInputDevices);
        this.model.selectedAudioInput = this._getDeviceIdFromTheList(this.model.selectedAudioInput, audioInputDevices);
        this.model.selectedAudioOutput = this._getDeviceIdFromTheList(this.model.selectedAudioOutput, audioOutputDevices);
        this._setDevicesList(videoInputDevices, this.model.selectedVideoInput, "videoinput");
        this._setDevicesList(audioInputDevices, this.model.selectedAudioInput, "audioinput");
        this._setDevicesList(audioOutputDevices, this.model.selectedAudioOutput, "audiooutput");
    }
    
    private _getDeviceIdFromTheList(deviceId: string | null, devicesList: MediaDeviceInfo[]): string | null {
        if (deviceId === null) {
            return null;
        }
        if (!devicesList.find(device => device.deviceId === deviceId)) {
            return null;
        }
        return deviceId;
    }
    
    private _setDevicesList(devicesInfo: MediaDeviceInfo[], selectedId: string | null, devicesType: string): void {
        let devices: { id: string, label: string }[] = [];
        devices.push({
            id: DeviceSelectorWindowView.DEVICE_OPTION_NAME__USE_DEFAULT,
            label: this.helper.i18n("window.deviceselector.defaultOptionName"),
        });
        if (this.model.withDisabledOption) {
            devices.push({
                id: DeviceSelectorWindowView.DEVICE_OPTION_NAME__DISABLED,
                label: this.helper.i18n("window.deviceselector.disabledOptionName"),
            });
        }
        devices = [...devices, ...devicesInfo.map(x => ({ id: x.deviceId, label: x.label }))];
        if (selectedId === null) {
            selectedId = DeviceSelectorWindowView.DEVICE_OPTION_NAME__USE_DEFAULT;
        }
        this.triggerEvent("setDevicesList", devices, selectedId, devicesType);
    }
    
    onCancelClick(): void {
        this.triggerEvent("cancel");
    }
    
    onSaveClick(): void {
        this.save();
    }
    
    onSelectChange(deviceType: "videoinput" | "audioinput" | "audiooutput", value: string): void {
        this.updateDirty();
        if (deviceType == "videoinput") {
            this.updateVideoInputPreview();
        }
        else if (deviceType == "audioinput") {
            this.updateAudioInputPreview();
        }
    }
    
    save(): void {
        this.triggerEvent("save", this.getStateStr());
    }
    
    getState() {
        const selectedVideoInputDeviceId = this._parseOptionValue(<string>this.videoInputCustomSelect.getValue());
        const selectedAudioInputDeviceId = this._parseOptionValue(<string>this.audioInputCustomSelect.getValue());
        const selectedAudioOutputDeviceId = this._parseOptionValue(<string>this.audioOutputCustomSelect.getValue());
        return {
            videoInput: selectedVideoInputDeviceId,
            audioInput: selectedAudioInputDeviceId,
            audioOutput: selectedAudioOutputDeviceId,
        };
    }
    
    private _parseOptionValue(value: string): string | false| null {
        if (value == DeviceSelectorWindowView.DEVICE_OPTION_NAME__USE_DEFAULT) {
            return null;
        }
        if (value == DeviceSelectorWindowView.DEVICE_OPTION_NAME__DISABLED) {
            return false;
        }
        return value;
    }
    
    getStateStr(): string {
        return JSON.stringify(this.getState());
    }
    
    toggleLoading(loading: boolean): void {
        this.$main.find(".loading-container").toggleClass("visible", loading);
    }
    
    hideLoading(): void {
        this.toggleLoading(false);
    }
    
    showLoading(): void {
        this.toggleLoading(true);
    }
    
    toggleSaving(saving: boolean): void {
        this.toggleLoading(saving);
    }
    
    showSaving(): void {
        this.toggleSaving(true);
    }
    
    hideSaving(): void {
        this.toggleSaving(false);
    }
    
    isDirty(): boolean {
        const state = this.getState();
        let dirty: boolean = false;
        if (this.model.chooseVideoInput && this.model.selectedVideoInput != state.videoInput) {
            dirty = true;
        }
        if (this.model.chooseAudioInput && this.model.selectedAudioInput != state.audioInput) {
            dirty = true;
        }
        if (this.model.chooseAudioOutput && this.model.selectedAudioOutput != state.audioOutput) {
            dirty = true;
        }
        return dirty;
    }
    
    updateDirty(): void {
        const isDirty = this.isDirty();
        this.triggerEvent("setDirty", isDirty);
        this.updateButtonStates();
    }
    
    updateButtonStates(): void {
        if (!this.model.docked) {
            return;
        }
        const isDirty = this.isDirty();
        this.$saveButton.prop("disabled", !isDirty);
    }
    
    async updateVideoInputPreview(): Promise<void> {
        if (!this.model.chooseVideoInput || !this.model.withPreviews) {
            return;
        }
        const deviceId = this.getState().videoInput;
        const mediaStream = await this.getMediaStream("video", deviceId);
        const video = <HTMLVideoElement>this.$main.find("video.video-preview")[0];
        if (mediaStream && mediaStream.getVideoTracks().length > 0) {
            video.srcObject = mediaStream;
            video.play();
        }
        else {
            video.src = null;
            video.srcObject = null;
            video.pause();
        }
    }
    
    async updateAudioInputPreview(): Promise<void> {
        if (!this.model.chooseAudioInput) {
            return;
        }
        const deviceId = this.getState().audioOutput;
        if (!this.audioLevelIndicator) {
            this.audioLevelIndicator = new AudioLevelIndicator(this.templateManager);
            await this.audioLevelIndicator.init(this.$main.find(".audio-input-preview"));
        }
        this.audioLevelIndicator.setDeviceId(typeof(deviceId) === "string" ? deviceId : undefined);
    }
    
    onPreviewAudioOutputClick(): void {
        this.previewAudioOutput();
    }
    
    async previewAudioOutput(): Promise<void> {
        if (!this.model.chooseAudioOutput || !this.model.withPreviews) {
            return;
        }
        const deviceId = this.getState().audioOutput;
        const $previewAudioOutput = this.$main.find("[data-action='preview-audio-output']");
        if ($previewAudioOutput.hasClass("previewing")) {
            return;
        }
        $previewAudioOutput.addClass("previewing");
        const audio = <HTMLAudioElementEx>document.createElement("audio");
        try {
            if (typeof(deviceId) == "string") {
                await audio.setSinkId(deviceId);
            }
            audio.src = this.helper.getAsset(this.model.audioOutputPreviewFilePath);
            await audio.play();
            await new Promise<void>((resolve, reject) => {
                audio.onended = () => resolve();
                audio.onerror = () => reject();
            });
        }
        catch {
        }
        $previewAudioOutput.removeClass("previewing");
    }
    
    async getMediaStream(type: "audio" | "video", deviceId: string | boolean): Promise<MediaStream> {
        let constraints: MediaStreamConstraints = {};
        if (type == "video") {
            constraints.video = typeof(deviceId) == "string" ? { deviceId: deviceId } : true;
        }
        if (type == "audio") {
            constraints.audio = typeof(deviceId) == "string" ? { deviceId: deviceId } : true;
        }
        return await navigator.mediaDevices.getUserMedia(constraints);
    }
    
    destroy(): void {
        this.audioLevelIndicator.destroy();
        this.audioLevelIndicator = null;
        super.destroy();
    }
    
}
