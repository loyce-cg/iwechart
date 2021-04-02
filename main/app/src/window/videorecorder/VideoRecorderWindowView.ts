import { BaseWindowView, WindowView } from "../base/BaseWindowView";
import { func as mainTemplate } from "./template/main.html";
import { Model } from "./VideoRecorderWindowController";
import { app } from "../../Types";
import * as Q from "q";
import * as $ from "jquery";
import { VideoRecorder } from "./VideoRecorder";
import { Timer } from "./Timer";
import { AudioPlayerView } from "../../component/audioplayer/web";
import { RecordedMediaModel, RecordingType, VideoRecorderMode, VideoRecorderState, VideoResolution } from "./Types";
import { CustomSelectView } from "../../component/customselect/web";
import { AudioLevelIndicator } from "../../component/audiolevelindicator/web";

export * from "./Types";
export { CameraConfiguration } from "./CameraConfiguration";

@WindowView
export class VideoRecorderWindowView extends BaseWindowView<Model> {
    
    model: Model;
    state: VideoRecorderState = VideoRecorderState.BEFORE_RECORDING;
    videoRecorder: VideoRecorder | null = null;
    recordedData: Blob | null = null;
    autoStopTimeout: number | null = null;
    
    $video: JQuery<HTMLVideoElement>;
    $audioPlayerContainer: JQuery;
    $resolutionCustomSelectContainer: JQuery;
    $recordingTimerCurrent: JQuery;
    $recordingTimerLimit: JQuery;
    $afterRecordingTimerTotal: JQuery;
    $controlsContainer: JQuery;
    recordingTimerCurrent: Timer;
    recordingTimerLimit: Timer;
    afterRecordingTimerTotal: Timer;
    selectedVideoInputDeviceId: string | null = null;
    selectedAudioInputDeviceId: string | null = null;
    selectedAudioOutputDeviceId: string | null = null;
    
    audioPlayer: AudioPlayerView;
    resolutionCustomSelect: CustomSelectView;
    audioLevelIndicator?: AudioLevelIndicator;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.audioPlayer = this.addComponent("audioPlayer", new AudioPlayerView(this));
        this.resolutionCustomSelect = this.addComponent("resolutionCustomSelect", new CustomSelectView(this, {}));
        this.resolutionCustomSelect.onChange(value => {
            this.onResolutionCustomSelectChange(value);
        });
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.model = model;
        this.$video = <JQuery<HTMLVideoElement>>this.$main.find(".preview video");
        this.$audioPlayerContainer = this.$main.find(".preview .audio-player-container");
        this.$resolutionCustomSelectContainer = this.$main.find(".resolution-custom-select-container");
        this.$recordingTimerCurrent = this.$main.find(".controls--recording .timer--current-time");
        this.$recordingTimerLimit = this.$main.find(".controls--recording .timer--limit");
        this.$afterRecordingTimerTotal = this.$main.find(".controls--after-recording .timer--current-time");
        this.$controlsContainer = this.$main.find(".controls");
        this.recordingTimerCurrent = new Timer(this.$recordingTimerCurrent);
        this.recordingTimerLimit = new Timer(this.$recordingTimerLimit);
        this.afterRecordingTimerTotal = new Timer(this.$afterRecordingTimerTotal);
        
        this.$main.on("click", "[data-action='change-devices']", this.onChangeDevicesClick.bind(this));
        this.$main.on("click", "[data-action='cancel']", this.onCancelClick.bind(this));
        this.$main.on("click", "[data-action='start-recording']", this.onStartRecordingClick.bind(this));
        this.$main.on("click", "[data-action='stop-recording']", this.onStopRecordingClick.bind(this));
        this.$main.on("click", "[data-action='restart-recording']", this.onRestartRecordingClick.bind(this));
        this.$main.on("click", "[data-action='save']", this.onSaveClick.bind(this));
        this.$main.on("click", "[data-switch-container-for='grayscale']", this.onGrayscaleSwitchContainerClick.bind(this));
        $(window).on("resize", () => {
            this.updateControlsContainerMiniState();
        });
        
        return Q()
        .then(() => {
            if (this.$audioPlayerContainer.length > 0) {
                this.audioPlayer.$container = this.$audioPlayerContainer;
                return this.audioPlayer.triggerInit();
            }
        })
        .then(() => {
            if (this.$resolutionCustomSelectContainer.length > 0) {
                this.resolutionCustomSelect.$container = this.$resolutionCustomSelectContainer;
                return this.resolutionCustomSelect.triggerInit();
            }
        })
        .then(() => {
            return this.chooseDevices(false);
        })
        .then(() => {
            return this.updateAudioLevelIndicatorIfNeeded();
        })
        .then(() => {
            this.updateConstraintsButtons();
            this.hideLoading();
        });
    }
    
    async chooseDevices(showDeviceSelector: boolean): Promise<void> {
        try {
            const mediaDevices = await this.getMediaDevices({
                videoInput: this.model.mode != VideoRecorderMode.AUDIO,
                audioInput: this.model.mode != VideoRecorderMode.PHOTO,
                audioOutput: false,
            }, showDeviceSelector);
            this.selectedVideoInputDeviceId = mediaDevices.videoInput;
            this.selectedAudioInputDeviceId = mediaDevices.audioInput;
            this.selectedAudioOutputDeviceId = mediaDevices.audioOutput;
            await this._setupVideoRecorder();
            this.updateAvailableResolutions();
        }
        catch {
            let deviceType: string = "";
            if (this.model.mode == VideoRecorderMode.AUDIO_AND_VIDEO) {
                deviceType = "cameraMicrophone";
            }
            else if (this.model.mode == VideoRecorderMode.AUDIO) {
                deviceType = "microphone";
            }
            else if (this.model.mode == VideoRecorderMode.PHOTO || this.model.mode == VideoRecorderMode.VIDEO) {
                deviceType = "camera";
            }
            this.msgBox.alert(this.i18n("window.videorecorder.error.deviceSetupFailed." + deviceType)).finally(() => {
                this.triggerEvent("cancel");
            });
        }
    }
    
    async updateAudioLevelIndicatorIfNeeded(): Promise<void> {
        if (this.model.mode == VideoRecorderMode.AUDIO) {
            return this.createAudioLevelIndicator(this.selectedAudioInputDeviceId);
        }
    }
    
    async createAudioLevelIndicator(deviceId: string): Promise<void> {
        if (!this.audioLevelIndicator) {
            this.audioLevelIndicator = new AudioLevelIndicator(this.templateManager);
            this.audioLevelIndicator.init(this.$main.find(".audio-level-indicator-container"));
        }
        this.audioLevelIndicator.setDeviceId(deviceId);
    }
    
    onChangeDevicesClick(): void {
        this.chooseDevices(true);
    }
    
    onCancelClick(): void {
        this.triggerEvent("cancel");
    }
    
    private async _setupVideoRecorder(): Promise<void> {
        const currentCameraConfiguration = this.videoRecorder ? this.videoRecorder.getCameraConfiguration() : null;
        if (this.videoRecorder) {
            await this.videoRecorder.destroy();
        }
        this.videoRecorder = new VideoRecorder({
            previewElement: this.$video[0] || this.audioPlayer,
            videoInput: this.model.mode !== VideoRecorderMode.AUDIO ? this.selectedVideoInputDeviceId : null,
            audioInput: this.model.mode !== VideoRecorderMode.PHOTO ? this.selectedAudioInputDeviceId : null,
            audioOutput: this.model.mode !== VideoRecorderMode.PHOTO ? this.selectedAudioOutputDeviceId : null,
            baseCameraConfiguration: currentCameraConfiguration,
        });
        await this.videoRecorder.setup();
    }
    
    onStartRecordingClick(): void {
        this.triggerStartRecording();
    }
    
    onStopRecordingClick(): void {
        this.triggerStopRecording();
    }
    
    onRestartRecordingClick(): void {
        this.triggerRestartRecording();
    }
    
    triggerStartRecording(): void {
        this.triggerEvent("startRecording");
    }
    
    triggerStopRecording(): void {
        this.triggerEvent("stopRecording");
    }
    
    triggerRestartRecording(): void {
        this.triggerEvent("restartRecording");
    }
    
    
    onSaveClick(): void {
        this.save();
    }
    
    async onGrayscaleSwitchContainerClick(): Promise<void> {
        const $switch = this.$main.find("[data-switch-for='grayscale']");
        const newIsActive = !$switch.hasClass("active");
        await this.videoRecorder.toggleGrayscale(newIsActive);
        this.updateConstraintsButtons();
    }
    
    save(): void {
        this.triggerEvent("save");
    }
    
    async updateRecordedMediaModel(): Promise<void> {
        if (!this.recordedData) {
            return;
        }
        const mimeType = this.recordedData.type;
        const dataUrl = await this._getDataUrl();
        if (!dataUrl) {
            return;
        }
        const recordedMediaModel: RecordedMediaModel = {
            dataUrl: dataUrl,
            mimeType: mimeType,
            recordingType: this._getRecordingTypeFromMode(this.model.mode),
        };
        if (this.model.mode == VideoRecorderMode.AUDIO_AND_VIDEO || this.model.mode == VideoRecorderMode.VIDEO) {
            recordedMediaModel.thumbnailDataUrl = await this.videoRecorder.getVideoThumbnail();
        }
        this.triggerEvent("setRecordedMediaModel", JSON.stringify(recordedMediaModel));
    }
    
    private _getRecordingTypeFromMode(mode: VideoRecorderMode): RecordingType | null {
        if (mode == VideoRecorderMode.AUDIO) {
            return RecordingType.AUDIO;
        }
        if (mode == VideoRecorderMode.VIDEO || mode == VideoRecorderMode.AUDIO_AND_VIDEO) {
            return RecordingType.VIDEO;
        }
        if (mode == VideoRecorderMode.PHOTO) {
            return RecordingType.PHOTO;
        }
        return null;
    }
    
    async startRecording(): Promise<void> {
        if (this.model.mode == VideoRecorderMode.PHOTO) {
            await this.videoRecorder.takePhoto();
            this.triggerStopRecording();
        }
        else {
            this._unbindVideoDurationChangedWatcher();
            this.videoRecorder.startRecording();
            this.recordingTimerCurrent.setValue(0);
            this.recordingTimerCurrent.start();
            this.recordingTimerLimit.setValue(this.model.maxMediaDuration);
            this._startAutoStopTimeout();
        }
    }
    
    async stopRecording(): Promise<void> {
        this.videoRecorder.stopRecording();
        this.showPreviewControls();
        if (this.$video[0]) {
            this.$video[0].pause();
        }
        else {
            this.audioPlayer.pause();
        }
        const data = await this.videoRecorder.getData()
        this._bindVideoDurationChangedWatcher();
        this._onVideoRecorderDataReady(data);
        this.recordingTimerCurrent.stop();
        this._stopAutoStopTimeout();
        if (this.model.mode == VideoRecorderMode.PHOTO) {
            this._setPhotoPreview(data);
        }
    }
    
    private _bindVideoDurationChangedWatcher(): void {
        if (this.$video[0]) {
            this.$video[0].ondurationchange = () => this._onVideoDurationChanged(this.$video[0]);
        }
    }
    
    private _unbindVideoDurationChangedWatcher(): void {
        if (this.$video[0]) {
            this.$video[0].ondurationchange = null;
        }
    }
    
    private _onVideoDurationChanged(el: HTMLVideoElement): void {
        if (!Number.isFinite(el.duration)) {
            el.currentTime = 86400;
            return;
        }
        el.currentTime = 0;
        this._unbindVideoDurationChangedWatcher();
    }
    
    private _startAutoStopTimeout(): void {
        this._stopAutoStopTimeout();
        this.autoStopTimeout = <any>setTimeout(() => {
            this.triggerEvent("stopRecording");
        }, this.model.maxMediaDuration);
    }
    
    private _stopAutoStopTimeout(): void {
        if (this.autoStopTimeout) {
            clearTimeout(this.autoStopTimeout);
            this.autoStopTimeout = null;
        }
    }
    
    private _onVideoRecorderDataReady(data: Blob): void {
        this.recordedData = data;
        this.updateRecordedMediaModel();
        this.triggerEvent("setDirty", true);
    }
    
    private _setPhotoPreview(data: Blob): void {
        const img = this.$main.find(".preview--photo img")[0] as HTMLImageElement;
        if (img.src) {
            window.URL.revokeObjectURL(img.src);
        }
        img.src = window.URL.createObjectURL(data);
    }
    
    async restartRecording(): Promise<void> {
        await this.clearRecording();
        this.triggerEvent("setDirty", false);
    }
    
    async clearRecording(): Promise<void> {
        this.hidePreviewControls();
        await this.videoRecorder.reset();
    }
    
    showPreviewControls(): void {
        this.$video.attr("controls", "");
        this.$audioPlayerContainer.addClass("visible");
        this.$main.find(".preview .preview--no-video .audio-player-placeholder").addClass("hide");
        this.$main.find(".preview .preview--no-video .audio-level-indicator-container").addClass("hide");
    }
    
    hidePreviewControls(): void {
        this.$video.removeAttr("controls");
        this.$audioPlayerContainer.removeClass("visible");
        this.$main.find(".preview .preview--no-video .audio-player-placeholder").removeClass("hide");
        this.$main.find(".preview .preview--no-video .audio-level-indicator-container").removeClass("hide");
    }
    
    setState(state: VideoRecorderState): void {
        this.state = state;
        this.setHtmlElementData(this.$main, "state", state);
    }
    
    setHtmlElementData($el: JQuery, dataName: string, value: string): void {
        $el.data(dataName, value);
        $el.attr(`data-${dataName}`, value);
    }
    
    destroy(): void {
        if (this.videoRecorder) {
            this.videoRecorder.reset();
        }
        if (this.audioLevelIndicator) {
            this.audioLevelIndicator.destroy();
        }
    }
    
    private async _getDataUrl(): Promise<string | null> {
        if (!this.recordedData) {
            return null;
        }
        return new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.readAsDataURL(this.recordedData);
            reader.onloadend = () => {
                resolve(<string>reader.result);
            };
        });
    }
    
    updateConstraintsButtons(): void {
        const hasVideo = this.model.mode !== VideoRecorderMode.AUDIO;
        const canChangeGrayscale = this.videoRecorder && hasVideo ? this.videoRecorder.canChangeGrayscale() : false;
        const isGrayscaleOn = this.videoRecorder && hasVideo ? this.videoRecorder.isGrayscaleOn() : false;
        const $grayscaleSwitch = this.$main.find("[data-switch-for='grayscale']");
        $grayscaleSwitch.toggleClass("active", isGrayscaleOn);
        $grayscaleSwitch.parent().css("display", canChangeGrayscale ? "" : "none");
    }
    
    async resetConstraints(): Promise<void> {
        try {
            if (this.$video[0]) {
                this.$video[0].pause();
            }
            else {
                this.audioPlayer.pause();
            }
        }
        catch {}
        if (this.videoRecorder) {
            await this.videoRecorder.resetConstraints();
        }
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
    
    setDirty(dirty: boolean): void {
        this.setSaveButtonEnabled(dirty);
    }
    
    setSaveButtonEnabled(enabled: boolean): void {
        this.$main.find("button[data-action=save]").prop("disabled", !enabled);
    }
    
    updateAvailableResolutions(): void {
        let resolutions: VideoResolution[] = this.videoRecorder.getAvailableResolutions();
        this.triggerEvent("setAvailableResolutions", resolutions);
    }
    
    onResolutionCustomSelectChange(resolutionStr: string): void {
        if (!resolutionStr) {
            return;
        }
        const [width, height] = resolutionStr.split("x").map(x => parseInt(x));
        this.videoRecorder.setResolution({ width, height });
    }
    
    updateControlsContainerMiniState(): void {
        const hasVideo = this.model.mode !== VideoRecorderMode.AUDIO;
        const thresholds: number[] = hasVideo ? [570, 370] : [320, 120];
        this.$controlsContainer.toggleClass("mini", this.$main.width() < thresholds[0]);
        this.$controlsContainer.toggleClass("mini--without-advanced-controls", this.$main.width() < thresholds[1]);
    }
    
}
