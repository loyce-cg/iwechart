import { AudioPlayerView } from "../../component/audioplayer/web";
import { CameraConfiguration } from "./CameraConfiguration";
import { VideoResolution } from "./Types";

export interface VideoRecorderOptions {
    previewElement: HTMLVideoElement | AudioPlayerView;
    videoInput: string;
    audioInput: string;
    audioOutput: string;
    baseCameraConfiguration: CameraConfiguration | null;
}

export class VideoRecorder {
    
    private _mediaStream: MediaStream | null = null;
    private _mediaRecorder: MediaRecorder | null = null;
    private _mediaChunks: Blob[] = [];
    private _dataReadyPromise: Promise<Blob | null> | null = null;
    private _cameraConfiguration: CameraConfiguration | null = null;
    
    constructor(private options: VideoRecorderOptions) {
    }
    
    getCameraConfiguration(): CameraConfiguration | null {
        return this._cameraConfiguration;
    }
    
    async setup(): Promise<void> {
        await this.setupDevices();
        await this.setupPreview();
    }
    
    async setupDevices(): Promise<void> {
        let constraints: MediaStreamConstraints = {};
        if (this.options.videoInput || this.options.videoInput === "") {
            constraints.video = { deviceId: this.options.videoInput };
        }
        if (this.options.audioInput || this.options.videoInput === "") {
            constraints.audio = { deviceId: this.options.audioInput };
        }
        this._mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (this.options.videoInput) {
            this._cameraConfiguration = new CameraConfiguration(this._mediaStream, undefined, this.options.baseCameraConfiguration);
        }
    }
    
    async setupPreview(): Promise<void> {
        if (!this.options.previewElement || !this._mediaStream) {
            return;
        }
        this.options.previewElement.srcObject = this._mediaStream;
        this.options.previewElement.muted = true;
        await this.options.previewElement.play();
    }
    
    startRecording(): void {
        this._mediaChunks = [];
        this._createMediaRecorder();
        this._mediaRecorder.start();
        if (this.options.previewElement) {
            this.options.previewElement.play();
        }
    }
    
    private _createMediaRecorder(): void {
        this._mediaRecorder = new MediaRecorder(this._mediaStream);
        this._mediaRecorder.ondataavailable = event => {
            this._mediaChunks.push(event.data);
        };
        this._dataReadyPromise = new Promise(resolve => {
            this._mediaRecorder.onstop = () => {
                resolve(this._getCurrentDataBlob());
            };
        });
        this._dataReadyPromise.then(data => {
            this._onMediaRecorderDataReady(data);
        });
    }
    
    private _onMediaRecorderDataReady(data: Blob): void {
        if (!this.options.previewElement || !data) {
            return;
        }
        this.options.previewElement.srcObject = null;
        this.options.previewElement.src = window.URL.createObjectURL(data);
        this.options.previewElement.muted = false;
    }
    
    stopRecording(): void {
        if (this._mediaRecorder) {
            this._mediaRecorder.stop();
        }
    }
    
    async takePhoto(): Promise<void> {
        if (!this._mediaStream || !this.options || !(this.options.previewElement instanceof HTMLVideoElement)) {
            return;
        }
        
        const video = this.options.previewElement as HTMLVideoElement;
        const initialState = {
            controls: video.controls,
        };
        video.controls = false;
        
        const trackSettings = this._mediaStream.getVideoTracks()[0].getSettings();
        const width = trackSettings.width;
        const height = trackSettings.height;
        
        const cnv = document.createElement("canvas");
        const ctx = cnv.getContext("2d");
        cnv.width = width;
        cnv.height = height;
        ctx.drawImage(video, 0, 0);
        this._dataReadyPromise = new Promise<Blob>(resolve => {
            cnv.toBlob(blob => {
                resolve(blob);
            }, "image/png", 1.0);
        });
        await this._dataReadyPromise;
        
        video.controls = initialState.controls;
    }
    
    async getData(): Promise<Blob | null> {
        if (!this._dataReadyPromise) {
            return null;
        }
        return await this._dataReadyPromise;
    }
    
    private _getCurrentDataBlob(): Blob | null {
        if (this._mediaChunks.length == 0) {
            return null;
        }
        return new Blob(this._mediaChunks, { type: this._mediaRecorder.mimeType });
    }
    
    async reset(): Promise<void> {
        await this.resetPreview();
        await this.destroyMediaRecorder();
        await this.setupPreview();
    }
    
    async resetPreview(): Promise<void> {
        if (this.options.previewElement) {
            this.options.previewElement.srcObject = null;
            if (this.options.previewElement.src) {
                window.URL.revokeObjectURL(this.options.previewElement.src);
                this.options.previewElement.src = null;
            }
        }
    }
    
    async destroyMediaRecorder(): Promise<void> {
        if (this._mediaRecorder) {
            if (this._mediaRecorder.state == "recording") {
                this._mediaRecorder.stop();
            }
            this._mediaRecorder = null;
        }
    }
    
    async destroy(): Promise<void> {
        await this.resetPreview();
        await this.destroyMediaRecorder();
    }
    
    async getVideoThumbnail(): Promise<string> {
        const cnv = document.createElement("canvas");
        const ctx = cnv.getContext("2d");
        const video = this.options.previewElement as HTMLVideoElement;
        if (video.videoWidth == 0) {
            await new Promise<void>(resolve => {
                video.oncanplay = () => {
                    if (video.readyState == 4) {
                        resolve();
                    }
                };
            });
        }
        cnv.width = video.videoWidth;
        cnv.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        return new Promise<string>(resolve => {
            cnv.toBlob(async blob => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    resolve(<string>reader.result);
                };
            }, "image/jpeg", 0.95);
        });
    }
    
    
    
    
    
    /*************************************************
    **************** VideoTrack config ***************
    *************************************************/
    canChangeGrayscale(): boolean {
        if (!this._cameraConfiguration) {
            return false;
        }
        return this._cameraConfiguration.canChangeSaturation();
    }
    isGrayscaleOn(): boolean {
        if (!this._cameraConfiguration) {
            return false;
        }
        return this._cameraConfiguration.getSaturation() === 0;
    }
    async enableGrayscale(): Promise<void> {
        await this.toggleGrayscale(true);
    }
    async disableGrayscale(): Promise<void> {
        await this.toggleGrayscale(false);
    }
    async toggleGrayscale(grayscaleOn: boolean): Promise<void> {
        if (!this._cameraConfiguration) {
            return;
        }
        let saturation: number = 0;
        if (grayscaleOn) {
            saturation = 0;
        }
        else {
            let initialSaturation = this._cameraConfiguration.getInitialSaturation();
            if (initialSaturation === null || initialSaturation < 10) {
                saturation = 55;
            }
            else {
                saturation = initialSaturation;
            }
        }
        await this._cameraConfiguration.setSaturation(saturation);
    }
    
    async resetConstraints(): Promise<void> {
        if (this._cameraConfiguration) {
            await this._cameraConfiguration.resetConstraints();
        }
    }
    
    getAvailableResolutions(): VideoResolution[] {
        if (!this._cameraConfiguration) {
            return [];
        }
        return this._cameraConfiguration.getAvailableResolutions();
    }
    
    setResolution(resolution: VideoResolution) {
        if (!this._cameraConfiguration) {
            return;
        }
        this._cameraConfiguration.setResolution(resolution);
    }
}
