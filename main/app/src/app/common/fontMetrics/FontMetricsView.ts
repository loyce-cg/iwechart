import { WidthsData } from "./FontMetricsController";
import { FontMetricsBase } from "./FontMetricsBase";

export class FontParameters {
    family: string;
    sizePx: number;
    weight: string;
}

export class FontMetricsView extends FontMetricsBase {
    
    static readonly FONT_FAMILY: string = "source_sans_pro, arial, sans-serif";
    static readonly FONT_FAMILY_MONOSPACE: string = "source_code_pro, arial, sans-serif";
    static readonly FONT_WEIGHT_NORMAL: string = "400";
    static readonly FONT_WEIGHT_BOLD: string = "700";
    static readonly FONT_SIZE_DEFAULT: number = 13;
    
    cnv: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    
    chars: { [chr: number]: boolean } = {};
    widths: { [chr: number]: number } = {};
    boldWidths: { [chr: number]: number } = {};
    allowBreakAfterChars: number[] = null;
    private currentFontParameters: FontParameters = {
        family: FontMetricsView.FONT_FAMILY,
        sizePx: FontMetricsView.FONT_SIZE_DEFAULT,
        weight: FontMetricsView.FONT_WEIGHT_NORMAL,
    };
    
    constructor() {
        super();
        this.cnv = document.createElement("canvas");
        this.ctx = this.cnv.getContext("2d");
        this.setFont({});
    }
    
    onControllerMeasureCharacters(charsStr: string): string {
        let chars: number[] = JSON.parse(charsStr);
        return JSON.stringify(this.measureCharacters(chars));
    }
    
    measureCharacters(chars: number[]): WidthsData {
        let data: WidthsData = { widths: {}, boldWidths: {} };
        for (let i = 0, l = chars.length; i < l; ++i) {
            let charCode = chars[i];
            let val = this.measureCharacter(charCode);
            data.widths[charCode] = val;
            this.widths[charCode] = val;
        }
        this.setFont({ weight: FontMetricsView.FONT_WEIGHT_BOLD });
        for (let i = 0, l = chars.length; i < l; ++i) {
            let charCode = chars[i];
            let val = this.measureCharacter(charCode);
            data.boldWidths[charCode] = val;
            this.boldWidths[charCode] = val;
        }
        this.setFont({ weight: FontMetricsView.FONT_WEIGHT_NORMAL });
        return data;
    }
    
    measureCharacter(charCode: number): number {
        let str = String.fromCharCode(charCode);
        return this.ctx.measureText(str).width;
    }
    
    setFontFromElement(element: HTMLElement): void {
        const style = window.getComputedStyle(element);
        this.setFontFromComputedStyle(style);
    }
    
    setFontFromComputedStyle(style: CSSStyleDeclaration): void {
        this.setFont({
            family: style.fontFamily,
            sizePx: style.fontSize.endsWith("px") ? parseInt(style.fontSize) : FontMetricsView.FONT_SIZE_DEFAULT,
            weight: style.fontWeight,
        });
    }
    
    setFont(fontParameters: Partial<FontParameters>): void {
        this.currentFontParameters = {
            family: fontParameters.family || this.currentFontParameters.family,
            sizePx: fontParameters.sizePx || this.currentFontParameters.sizePx,
            weight: fontParameters.weight || this.currentFontParameters.weight,
        };
        this.ctx.font = `${this.currentFontParameters.weight} ${this.currentFontParameters.sizePx}px ${this.currentFontParameters.family}`;
    }
    
    getAllowBreakAfterChars(): string {
        let res: string[] = [];
        let ua = navigator.userAgent.toLowerCase();
        if (ua.indexOf("firefox") >= 0) {
            res = ["-", "?"];
        }
        else {
            res = ["-"];
        }
        this.allowBreakAfterChars = res.map(x => x.charCodeAt(0));
        return JSON.stringify(this.allowBreakAfterChars);
    }
    
    measure(): void {
        if (!this.hasSthToMeasure) {
            return;
        }
        let charCodesToMeasure: number[] = [];
        for (let charCode in this.chars) {
            if (!(charCode in this.widths)) {
                charCodesToMeasure.push(Number(charCode));
            }
        }
        
        if (charCodesToMeasure.length == 0) {
            return;
        }
        
        if (this.allowBreakAfterChars == null) {
            this.getAllowBreakAfterChars();
        }
        this.measureCharacters(charCodesToMeasure);
    }
    
}
