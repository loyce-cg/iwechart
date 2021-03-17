import { window } from "pmc-web";

export class VideoResolutions {
    
    static readonly AVAILABLE_RESOLUTIONS: window.videorecorder.VideoResolution[] = [
        { width: 640, height: 480 },
        { width: 640, height: 360 },
        { width: 320, height: 240 },
        { width: 320, height: 180 },
        { width: 240, height: 180 },
        { width: 160, height: 120 },
        { width: 480, height: 640 },
        { width: 360, height: 640 },
        { width: 240, height: 320 },
        { width: 180, height: 320 },
        { width: 180, height: 240 },
        { width: 120, height: 160 },
    ];
    
    static readonly MIN_RESOLUTION: window.videorecorder.VideoResolution = VideoResolutions._getMinResolution();
    
    static readonly MAX_RESOLUTION: window.videorecorder.VideoResolution = VideoResolutions._getMaxResolution();
    
    static readonly DEFAULT_RESOLUTION: window.videorecorder.VideoResolution = VideoResolutions._getDefaultResolution();
    
    private static _getMinResolution(): window.videorecorder.VideoResolution {
        return this.AVAILABLE_RESOLUTIONS
            .map(resolution => ({ area: resolution.width * resolution.height, resolution: resolution }))
            .sort((a, b) => a.area - b.area)[0].resolution;
    }
    
    private static _getMaxResolution(): window.videorecorder.VideoResolution {
        return this.AVAILABLE_RESOLUTIONS
            .map(resolution => ({ area: resolution.width * resolution.height, resolution: resolution }))
            .sort((a, b) => b.area - a.area)[0].resolution;
    }
    
    private static _getDefaultResolution(): window.videorecorder.VideoResolution {
        return this.AVAILABLE_RESOLUTIONS
            .filter(resolution => resolution.width == 320 && resolution.height == 180)[0];
    }
    
}
