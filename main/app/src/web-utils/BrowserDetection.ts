import bowser = require("bowser");
import platform = require("platform");

export class BrowserDetection {
    
    static Requirements = {
        firefox: "38.0",
        chrome: "40.0",
        safari: "9.0"
    };
    
    bowser: bowser.IBowserDetection;
    platform: platform.Platform;
    
    constructor(userAgent?: string) {
        this.bowser = userAgent ? bowser._detect(userAgent) : bowser;
        this.platform = userAgent ? platform.parse(userAgent) : platform;
    }
    
    meetsMinimalRequirements() {
        return this.isDesktop() && (this.isValidChrome() || this.isValidFirefox() || this.isValidSafari());
    }
    
    isValidChrome(): boolean {
        return this.isChrome() && parseFloat(this.version()) >= parseFloat(BrowserDetection.Requirements.chrome);
    }
    
    isValidFirefox(): boolean {
        return this.isFirefox() && parseFloat(this.version()) >= parseFloat(BrowserDetection.Requirements.firefox);
    }
    
    isValidSafari(): boolean {
        return this.isSafari() && parseFloat(this.version()) >= parseFloat(BrowserDetection.Requirements.safari);
    }
    
    isMobile(): boolean {
        return !!this.bowser.mobile;
    }
    
    isTablet(): boolean {
        return !!this.bowser.tablet;
    }
    
    isDesktop(): boolean {
        return !(this.isMobile() || this.isTablet());
    }
    
    isChrome(): boolean {
        return !!(this.bowser.chrome || this.bowser.chromium);
    }
    
    isFirefox(): boolean {
        return !!this.bowser.firefox;
    }
    
    isSafari(): boolean {
        return !!this.bowser.safari;
    }
    
    isIE(): boolean {
        return !!this.bowser.msie;
    }
    
    isEdge(): boolean {
        return !!this.bowser.msedge;
    }
    
    isOpera(): boolean {
        return !!this.bowser.opera;
    }
    
    isNode(): boolean {
        return this.platform.name == "Node.js";
    }
    
    isWebkit(): boolean {
        return !!(this.bowser.webkit || this.bowser.blink);
    }
    
    isGecko(): boolean {
        return !!this.bowser.gecko;
    }
    
    isMac(): boolean {
        return !!this.bowser.mac || navigator.platform.toLowerCase().indexOf("mac") >= 0 || this.platform.os.family == "OS X";
    }
    
    isWindows(): boolean {
        return !!this.bowser.windows || navigator.platform.toLowerCase().indexOf("win") >= 0 || this.platform.os.family == "Windows";
    }
    
    isLinux(): boolean {
        return !!this.bowser.linux || navigator.platform.toLowerCase().indexOf("linux") >= 0 || this.platform.os.family == "Linux";
    }
    
    version(longVersion?: boolean): string {
        return longVersion ? this.platform.version : typeof(this.bowser.version) == "string" ? this.bowser.version : "" + this.bowser.version;
    }
    
    name(): string {
        return this.platform.name;
    }
    
    nameWithVersion(longVersion?: boolean): string {
        return this.name() + " " + this.version(longVersion);
    }
    
    os(): platform.OS {
        return this.platform.os;
    }
}

