import { WidthsData } from "./FontMetricsController";
import { FontMetricsBase } from "./FontMetricsBase";

export class FontMetricsView extends FontMetricsBase {
    
    cnv: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    
    chars: { [chr: number]: boolean } = {};
    widths: { [chr: number]: number } = {};
    boldWidths: { [chr: number]: number } = {};
    allowBreakAfterChars: number[] = null;
    
    constructor() {
        super();
        this.cnv = document.createElement("canvas");
        this.ctx = this.cnv.getContext("2d");
        this.setFont();
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
        this.setFont(null, true, null);
        for (let i = 0, l = chars.length; i < l; ++i) {
            let charCode = chars[i];
            let val = this.measureCharacter(charCode);
            data.boldWidths[charCode] = val;
            this.boldWidths[charCode] = val;
        }
        this.setFont(null, false, null);
        return data;
    }
    
    measureCharacter(charCode: number): number {
        let str = String.fromCharCode(charCode);
        return this.ctx.measureText(str).width;
    }
    
    setFont(sizePx: number = null, bold: boolean = null, monospace: boolean = null): void {
        if (sizePx === null) {
            sizePx = 13;
        }
        if (bold === null) {
            bold = false;
        }
        if (monospace === null) {
            monospace = false;
        }
        
        let font = "";
        if (bold) {
            font += "bold ";
        }
        font += sizePx + "px ";
        if (monospace) {
            font += "source_code_pro, arial, sans-serif";
        }
        else {
            font += "source_sans_pro, arial, sans-serif";
        }
        
        this.ctx.font = font;
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
