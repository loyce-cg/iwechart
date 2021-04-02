import { BaseWindowController } from "../base/BaseWindowController";
import { app } from "../../Types";
import * as privfs from "privfs-client";
import * as Q from "q";
import { LocaleService, session } from "../../mail";
import { i18n } from "./i18n";
import { BaseWindowManager, ElectronPartitions } from "../../app";
import { SectionService } from "../../mail/section";
import { Dependencies } from "../../utils/Decorators";
import { AudioPlayerController } from "../../component/audioplayer/main";
import { RecordedMediaModel, RecordingType, VideoRecorderMode, VideoRecorderState, VideoResolution } from "./Types";
import { CustomSelectController, CustomSelectItem, CustomSelectSeparator } from "../../component/customselect/main";
import { ThumbsManager } from "../../mail/thumbs";

export * from "./Types";

export interface VideoRecorderSaveModel {
    type: "sectionFile" | "customHandler";
}

export interface VideoRecorderSectionFileSaveModel extends VideoRecorderSaveModel {
    type: "sectionFile";
    session: session.Session;
    sectionId: string;
    path: string;
}
export interface VideoRecorderCustomHandlerSaveModel extends VideoRecorderSaveModel {
    type: "customHandler";
    handler: (recordedMediaModel: RecordedMediaModel) => Promise<void>;
}

export interface VideoRecorderOptions {
    mode: VideoRecorderMode;
    saveModel: VideoRecorderSaveModel;
    closeAfterSaved?: boolean;
}

export interface Model {
    mode: VideoRecorderMode;
    maxMediaDuration: number;
}

@Dependencies(["audioplayer", "customselect"])
export class VideoRecorderWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.videorecorder.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static readonly MAX_DURATION_MS = 60 * 1000;
    
    private _state: VideoRecorderState = VideoRecorderState.BEFORE_RECORDING;
    private _isDirty: boolean = false;
    private _recordedMediaModel: RecordedMediaModel = null;
    private _screenCoverPreventionInterval: number | null = null;
    audioPlayer: AudioPlayerController;
    resolutionCustomSelect: CustomSelectController;
    
    constructor(parent: app.WindowParent, public options: VideoRecorderOptions) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        const hasVideo = options.mode == VideoRecorderMode.VIDEO || options.mode == VideoRecorderMode.AUDIO_AND_VIDEO || options.mode == VideoRecorderMode.PHOTO;
        const isPhoto = options.mode == VideoRecorderMode.PHOTO;
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = hasVideo ? 750 : 500;
        this.openWindowOptions.height = hasVideo ? 530 : 240;
        this.openWindowOptions.minWidth = hasVideo ? 250 : 200;
        this.openWindowOptions.minHeight = hasVideo ? 200 : 120;
        this.openWindowOptions.title = this.i18n("window.videorecorder.title." + (isPhoto ? "photo" : (hasVideo ? "video" : "audio")));
        this.openWindowOptions.icon = "icon " + (hasVideo ? "fa fa-file-video-o" : "fa fa-file-audio-o");
        this.openWindowOptions.backgroundColor = "#292929";
        this.openWindowOptions.electronPartition = ElectronPartitions.HTTPS_SECURE_CONTEXT;
        this._startScreenCoverPreventionInterval();
        
        this.audioPlayer = this.addComponent("audioPlayer", this.componentFactory.createComponent("audioplayer", [this, this.app]));
        this.resolutionCustomSelect = this.addComponent("resolutionCustomSelect", this.componentFactory.createComponent("customselect", [this, {
            items: [],
            editable: true,
            size: "small",
            noSelectionItem: {
                type: "item",
                icon: null,
                text: this.i18n("window.videorecorder.resolutionCustomSelect.noSelection.text"),
                selected: false,
                value: null,
            },
        }]));
    }
    
    init() {
        return Q().then(() => {
        });
    }
    
    getModel(): Model {
        return {
            mode: this.options.mode,
            maxMediaDuration: VideoRecorderWindowController.MAX_DURATION_MS,
        };
    }
    
    onViewCancel(): void {
        this.close();
    }
    
    onViewStartRecording(): void {
        if (this._state != VideoRecorderState.BEFORE_RECORDING) {
            return;
        }
        this.setState(VideoRecorderState.RECORDING);
        this.setDirty(true);
        this.callViewMethod("startRecording");
    }
    
    onViewStopRecording(): void {
        if (this._state != VideoRecorderState.RECORDING) {
            return;
        }
        this.setState(VideoRecorderState.AFTER_RECORDING);
        this.callViewMethod("stopRecording");
    }
    
    onViewRestartRecording(): void {
        if (this._state != VideoRecorderState.AFTER_RECORDING) {
            return;
        }
        this.setState(VideoRecorderState.BEFORE_RECORDING);
        this.callViewMethod("restartRecording");
    }
    
    onViewSetRecordedMediaModel(recordedMediaModelStr: string): void {
        const recordedMediaModel: RecordedMediaModel = JSON.parse(recordedMediaModelStr);
        this._recordedMediaModel = recordedMediaModel;
    }
    
    onViewSave(): void {
        this.save();
    }
    
    async save(): Promise<void> {
        if (!this._recordedMediaModel || !this._isDirty) {
            return;
        }
        this.callViewMethod("showSaving");
        if (this._recordedMediaModel) {
            if (this.options.saveModel.type == "sectionFile") {
                const saveModel = this.options.saveModel as VideoRecorderSectionFileSaveModel;
                const section = this.getSection();
                const fileExt = this._getFileExtensionFromRecordingType(this._recordedMediaModel.recordingType);
                const fileName = await this.app.generateUniqueFileName(section, saveModel.path, fileExt);
                const base64Content = this._getDataAsBase64();
                const content = privfs.lazyBuffer.Content.createFromBase64(base64Content, this._recordedMediaModel.mimeType, fileName);
                const fileUploadResult = await section.uploadFile({
                    data: content,
                    path: saveModel.path,
                });
                if (this._recordedMediaModel.thumbnailDataUrl && this.options.mode == VideoRecorderMode.AUDIO_AND_VIDEO || this.options.mode == VideoRecorderMode.VIDEO) {
                    const thumbnailBase64Content = this._getThumbnailAsBase64();
                    const thumbnailBuffer = Buffer.from(thumbnailBase64Content, "base64");
                    await ThumbsManager.getInstance().createThumb(section, fileUploadResult.fileResult.path, {
                        buffer: Buffer.from(thumbnailBuffer),
                        mimeType: "image/jpeg",
                    });
                }
            }
            else if (this.options.saveModel.type == "customHandler") {
                const saveModel = this.options.saveModel as VideoRecorderCustomHandlerSaveModel;
                await saveModel.handler(this._recordedMediaModel);
            }
        }
        this.callViewMethod("hideSaving");
        this.setDirty(false);
        if (this.options.closeAfterSaved) {
            this.close();
        }
    }
    
    private _getFileExtensionFromRecordingType(recordingType: RecordingType): string {
        if (recordingType == RecordingType.AUDIO) {
            return ".pmxaa";
        }
        if (recordingType == RecordingType.VIDEO) {
            return ".pmxvv";
        }
        if (recordingType == RecordingType.PHOTO) {
            return ".png";
        }
    }
    
    private _getDataAsBase64(): string {
        return this._dataUrlToBase64(this._recordedMediaModel.dataUrl);
    }
    
    private _getThumbnailAsBase64(): string {
        return this._dataUrlToBase64(this._recordedMediaModel.thumbnailDataUrl);
    }
    
    private _dataUrlToBase64(dataUrl: string): string {
        const separator = "base64,";
        const idx = dataUrl.indexOf(separator);
        return dataUrl.substr(idx + separator.length);
    }
    
    getSection(): SectionService | null {
        if (this.options.saveModel.type == "sectionFile") {
            const saveModel = this.options.saveModel as VideoRecorderSectionFileSaveModel;
            return saveModel.session.sectionManager.getSection(saveModel.sectionId);
        }
        return null;
    }
    
    onViewSetDirty(dirty: boolean): void {
        this.setDirty(dirty);
    }
    
    setDirty(dirty: boolean): void {
        if (dirty === this._isDirty) {
            return;
        }
        this._isDirty = dirty;
        this.nwin.setDirty(this._isDirty);
        this.callViewMethod("setDirty", dirty);
    }
    
    setState(state: VideoRecorderState): void {
        this._state = state;
        this.callViewMethod("setState", state);
    }
    
    onViewSetAvailableResolutions(resolutions: VideoResolution[]): void {
        const horizontalResolutions = resolutions.filter(resolution => resolution.width >= resolution.height);
        const verticalResolutions = resolutions.filter(resolution => resolution.width < resolution.height);
        const hasSeparator = horizontalResolutions.length > 0 && verticalResolutions.length > 0;
        const separator: "separator"[] = hasSeparator ? ["separator"] : [];
        const resolutionsWithSeparators: (VideoResolution | "separator")[] = [...horizontalResolutions, ...separator, ...verticalResolutions];
        const items: (CustomSelectItem | CustomSelectSeparator)[] = resolutionsWithSeparators.map(resolutionOrSeparator => {
            if (typeof(resolutionOrSeparator) == "string") {
                return <CustomSelectSeparator>{
                    type: "separator",
                };
            }
            else {
                const resolution = resolutionOrSeparator;
                return <CustomSelectItem>{
                    type: "item",
                    icon: null,
                    selected: resolution.isCurrent,
                    text: `${resolution.width} x ${resolution.height}`,
                    value: `${resolution.width}x${resolution.height}`,
                };
            }
        });
        this.resolutionCustomSelect.setItems(items);
    }
    
    beforeClose(force?: boolean): Q.IWhenable<void> {
        this.manager.stateChanged(BaseWindowManager.STATE_CLOSING);
        
        if (force || !this._isDirty) {
            let defer = Q.defer<void>();
            this.retrieveFromView("resetConstraints").fin(() => {
                this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                this._stopScreenCoverPreventionInterval();
                defer.resolve();
            });
            return defer.promise;
        }
        this.manager.stateChanged(BaseWindowManager.STATE_DIRTY);
        
        let defer = Q.defer<void>();
        this._onBeforeCloseWhenDirty().then(({ close }) => {
            this.manager.stateChanged(BaseWindowManager.STATE_IDLE);
            if (close) {
                this._stopScreenCoverPreventionInterval();
                this.retrieveFromView("resetConstraints").fin(() => {
                    defer.resolve();
                });
            }
            else {
                this.app.manager.cancelClosing();
                defer.reject();
            }
        });
        return defer.promise;
    }
    
    private async _onBeforeCloseWhenDirty(): Promise<{ close: boolean }> {
        const { close, saveChanges } = await this._askAboutChangesBeforeClosing();
        if (saveChanges) {
            await this.save();
        }
        return { close };
    }
    
    private async _askAboutChangesBeforeClosing(): Promise<{ close: boolean, saveChanges: boolean }> {
        const recordingType = this.options.mode === VideoRecorderMode.PHOTO ? "photo" : "audioVideo";
        const result = await this.confirmEx({
            title: this.i18n(`window.videorecorder.unsavedMessage.${recordingType}.title`),
            message: this.i18n(`window.videorecorder.unsavedMessage.${recordingType}.message`),
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
    
}
