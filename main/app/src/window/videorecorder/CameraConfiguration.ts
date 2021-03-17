import { VideoResolution } from "./Types";

export interface Property {
    canChange: boolean;
    type: "range" | "oneOf";
    initialValue: number | string | null;
    currentValue: number | string | null;
}

export interface RangeProperty extends Property {
    type: "range";
    min: number | null;
    max: number | null;
    step: number | null;
    initialValue: number | null;
    currentValue: number | null;
}

export interface OneOfProperty extends Property {
    type: "oneOf";
    availableValues: string[] | null;
    initialValue: string | null;
    currentValue: string | null;
}

export interface Properties {
    aspectRatio: RangeProperty;
    brightness: RangeProperty;
    colorTemperature: RangeProperty;
    contrast: RangeProperty;
    frameRate: RangeProperty;
    height: RangeProperty;
    saturation: RangeProperty;
    sharpness: RangeProperty;
    width: RangeProperty;
}

export type PropertyName = keyof Properties;

interface _ULongRange {
    max?: number;
    min?: number;
}
interface _ConstrainULongRange extends _ULongRange {
    exact?: number;
    ideal?: number;
    step?: number;
}
type _ConstrainULong = number | _ConstrainULongRange;
export interface MediaTrackCapabilitiesEx extends MediaTrackCapabilities {
    brightness?: _ConstrainULong;
    colorTemperature?: _ConstrainULong;
    contrast?: _ConstrainULong;
    saturation?: _ConstrainULong;
    sharpness?: _ConstrainULong;
}

export interface MediaTrackConstraintSetEx extends MediaTrackConstraintSet {
    brightness?: _ConstrainULong;
    colorTemperature?: _ConstrainULong;
    contrast?: _ConstrainULong;
    saturation?: _ConstrainULong;
    sharpness?: _ConstrainULong;
}

export interface MediaTrackSettingsEx extends MediaTrackSettings {
    brightness?: number;
    colorTemperature?: number;
    contrast?: number;
    saturation?: number;
    sharpness?: number;
}

export class CameraConfiguration {
    
    static readonly KNOWN_RESOLUTIONS: VideoResolution[] = [
        { width: 1920, height: 1440 },
        { width: 1920, height: 1080 },
        { width: 1280, height: 960 },
        { width: 1280, height: 720 },
        { width: 640, height: 480 },
        { width: 640, height: 360 },
        { width: 320, height: 240 },
        { width: 320, height: 180 },
        { width: 1440, height: 1920 },
        { width: 1080, height: 1920 },
        { width: 960, height: 1280 },
        { width: 720, height: 1280 },
        { width: 480, height: 640 },
        { width: 360, height: 640 },
        { width: 240, height: 320 },
        { width: 180, height: 320 },
    ];
    
    private _mediaStream: MediaStream;
    private _properties: Properties | null;
    private _knownResolutions: VideoResolution[];
    
    constructor(mediaStream: MediaStream, knownResolutions?: VideoResolution[]) {
        this._mediaStream = mediaStream;
        this._knownResolutions = knownResolutions ? knownResolutions: JSON.parse(JSON.stringify(CameraConfiguration.KNOWN_RESOLUTIONS));
        this._updatePropertiesFromCurrentMediaStream();
    }
    
    private _updatePropertiesFromCurrentMediaStream(): void {
        let track: MediaStreamTrack = this._getVideoTrack()
        if (!track) {
            this._properties = null;
            return;
        }
        let capabilities: MediaTrackCapabilitiesEx;
        if (track.getCapabilities) {
            capabilities = <MediaTrackCapabilitiesEx>track.getCapabilities();
        }
        else {
            capabilities = this._getDefaultTrackCapabilities();
        }
        let settings: MediaTrackSettingsEx = track.getSettings();
        this._properties = {
            aspectRatio: this._createRangeProperty("aspectRatio", capabilities, settings),
            brightness: this._createRangeProperty("brightness", capabilities, settings),
            colorTemperature: this._createRangeProperty("colorTemperature", capabilities, settings),
            contrast: this._createRangeProperty("contrast", capabilities, settings),
            frameRate: this._createRangeProperty("frameRate", capabilities, settings),
            height: this._createRangeProperty("height", capabilities, settings),
            saturation: this._createRangeProperty("saturation", capabilities, settings),
            sharpness: this._createRangeProperty("sharpness", capabilities, settings),
            width: this._createRangeProperty("width", capabilities, settings),
        };
    }
    
    private _getVideoTrack(): MediaStreamTrack {
        return this._mediaStream.getTracks().filter(x => x.kind == "video")[0];
    }
    
    private _createRangeProperty(propertyName: PropertyName, capabilities: MediaTrackCapabilitiesEx, settings: MediaTrackSettingsEx): RangeProperty {
        let canChange = typeof(capabilities[propertyName]) == "object";
        let min: number | null = null;
        let max: number | null = null;
        let step: number | null = null;
        let initialValue: number | null = null;
        let currentValue: number | null = null;
        if (canChange) {
            const constrain = capabilities[propertyName] as ((_ConstrainULongRange | ConstrainDoubleRange) & { step?: number });
            min = constrain.min;
            max = constrain.max;
            step = "step" in constrain ? constrain.step : null;
            initialValue = settings[propertyName];
            currentValue = settings[propertyName];
        }
        return {
            type: "range",
            canChange: canChange,
            min: min,
            max: max,
            step: step,
            initialValue: initialValue,
            currentValue: currentValue,
        };
    }
    
    private _applyMinMaxStepConstraintsToValue(value: number, min: number, max: number, step: number | null): number {
        if (step) {
            let diffFromMin = value - min;
            let stepsFromMin = Math.round(diffFromMin / step);
            value = min + stepsFromMin * step;
        }
        value = Math.min(Math.max(value, min), max);
        return value;
    }
    
    private async _applyPropertyValueToVideoTrack(propertyName: PropertyName, propertyValue: number): Promise<void> {
        await this._applyPropertyValuesToVideoTrack({
            [propertyName]: propertyValue,
        });
    }
    
    private async _applyPropertyValuesToVideoTrack(properties: { [key: string]: number }): Promise<void> {
        let track = this._getVideoTrack();
        await track.applyConstraints({
            advanced: [properties],
        });
    }
    
    async resetConstraints(): Promise<void> {
        await this.resetSaturation();
        await this.resetResolution();
    }
    
    
    
    
    
    /*************************************************
    ******************* saturation *******************
    *************************************************/
    canChangeSaturation(): boolean {
        return this._properties && this._properties.saturation && this._properties.saturation.canChange;
    }
    async setSaturation(value: number): Promise<void> {
        if (this._properties && this._properties.saturation && this._properties.saturation.canChange) {
            const prop = this._properties.saturation;
            value = this._applyMinMaxStepConstraintsToValue(value, prop.min, prop.max, prop.step);
            prop.currentValue = value;
            await this._applyPropertyValueToVideoTrack("saturation", value);
        }
    }
    getSaturation(): number | null {
        if (this._properties && this._properties.saturation) {
            return this._properties.saturation.currentValue;
        }
        return null;
    }
    getInitialSaturation(): number | null {
        if (this._properties && this._properties.saturation) {
            return this._properties.saturation.initialValue;
        }
        return null;
    }
    async resetSaturation(): Promise<void> {
        if (this.getSaturation() != this.getInitialSaturation()) {
            await this.setSaturation(this.getInitialSaturation());
        }
    }
    
    
    
    
    
    /*************************************************
    ******************* resolution *******************
    *************************************************/
    canChangeResolution(): boolean {
        return this._properties
            && this._properties.width && this._properties.width.canChange
            && this._properties.height && this._properties.height.canChange
            && this._properties.aspectRatio && this._properties.aspectRatio.canChange;
    }
    async setResolution(value: VideoResolution): Promise<void> {
        if (this.canChangeResolution()) {
            const propWidth = this._properties.width;
            const propHeight = this._properties.height;
            if (propWidth.currentValue == value.width && propHeight.currentValue == value.height) {
                return;
            }
            value.width = this._applyMinMaxStepConstraintsToValue(value.width, propWidth.min, propWidth.max, propWidth.step);
            value.height = this._applyMinMaxStepConstraintsToValue(value.height, propHeight.min, propHeight.max, propHeight.step);
            propWidth.currentValue = value.width;
            propHeight.currentValue = value.height;
            await this._applyPropertyValuesToVideoTrack({
                width: value.width,
                height: value.height,
                aspectRatio: value.width / value.height,
            });
        }
    }
    getResolution(): VideoResolution | null {
        if (this._properties && this._properties.width && this._properties.height) {
            return {
                width: this._properties.width.currentValue,
                height: this._properties.height.currentValue,
            };
        }
        return null;
    }
    getInitialResolution(): VideoResolution | null {
        if (this._properties && this._properties.width && this._properties.height) {
            return {
                width: this._properties.width.initialValue,
                height: this._properties.height.initialValue,
            };
        }
        return null;
    }
    async resetResolution(): Promise<void> {
        if (this.getResolution().width != this.getInitialResolution().width || this.getResolution().height != this.getInitialResolution().height) {
            await this.setResolution(this.getInitialResolution());
        }
    }
    getAvailableResolutions(): VideoResolution[] {
        const aspectRatioProp = this._properties.aspectRatio;
        const heightProp = this._properties.height;
        const widthProp = this._properties.width;
        
        return this._knownResolutions
            .filter(resolution => {
                if (resolution.width < widthProp.min || resolution.width > widthProp.max) {
                    return false;
                }
                if (resolution.height < heightProp.min || resolution.height > heightProp.max) {
                    return false;
                }
                
                const aspectRatio = resolution.width / resolution.height;
                if (aspectRatio < aspectRatioProp.min || aspectRatio > aspectRatioProp.max) {
                    return false;
                }
                
                return true;
            })
            .map(resolution => {
                return {
                    height: resolution.height,
                    width: resolution.width,
                    isCurrent: heightProp.currentValue == resolution.height && widthProp.currentValue == resolution.width,
                };
            });
    }
    
    
    
    
    
    /*************************************************
    ********************** Misc **********************
    *************************************************/
    private _getDefaultTrackCapabilities(): MediaTrackCapabilitiesEx {
        return {
            "aspectRatio": {
                "max": 1280,
                "min": 0.001388888888888889,
            },
            "brightness": {
                "max": 64,
                "min": -64,
                "step": 1,
            },
            "colorTemperature": {
                "max": 6500,
                "min": 2800,
                "step": 10,
            },
            "contrast": {
                "max": 50,
                "min": 0,
                "step": 1,
            },
            "facingMode": [],
            "frameRate": {
                "max": 30,
                "min": 0,
            },
            "height": {
                "max": 720,
                "min": 1,
            },
            "resizeMode": [
                "none",
                "crop-and-scale",
            ],
            "saturation": {
                "max": 100,
                "min": 0,
                "step": 1,
            },
            "sharpness": {
                "max": 10,
                "min": 0,
                "step": 1,
            },
            "width": {
                "max": 1280,
                "min": 1,
            }
        } as any;
    }
}
