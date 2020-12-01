export interface WidthsData {
    widths: { [chr: number]: number };
    boldWidths: { [chr: number]: number };
}

export abstract class FontMetricsBase {
    
    chars: { [chr: number]: boolean } = {};
    widths: { [chr: number]: number } = {};
    boldWidths: { [chr: number]: number } = {};
    allowBreakAfterChars: number[] = null;
    hasSthToMeasure: boolean = false;
    
    add(s: string): boolean {
        let changed = false;
        for (let i = 0, l = s.length; i < l; ++i) {
            let n = s.charCodeAt(i);
            if (!(n in this.chars)) {
                this.chars[n] = true;
                changed = true;
            }
        }
        if (changed) {
            this.hasSthToMeasure = true;
        }
        return changed;
    }
    
    countLines(str: string, width: number, notBoldFrom: number): number {
        width = Math.max(width, 20);
        
        let widths = this.boldWidths;
        let isBold = true;
        
        let n = 1;
        str = (<any>str).trimEnd();
        let l = str.length;
        
        let lineWidth = 0;
        let prevWhiteSpaceAt = -1;
        let prevBreakableCharAt = -1;
        for (let i = 0; i <= l; ++i) {
            let cc = str.charCodeAt(i);
            if (isBold && i >= notBoldFrom) {
                widths = this.widths;
                isBold = false;
            }
            let lineWidth2 = lineWidth + widths[cc];
            if (cc == 32) {
                prevWhiteSpaceAt = i;
            }
            else if (this.allowBreakAfterChars.indexOf(cc) >= 0) {
                prevBreakableCharAt = i;
            }
            if (lineWidth2 > width) {
                if (cc == 32) {
                    while (str.charCodeAt(i + 1) == 32) {
                        ++i;
                    }
                    prevWhiteSpaceAt = i;
                }
                let breakAt: number = Math.max(prevWhiteSpaceAt, prevBreakableCharAt);
                if (breakAt < 0) {
                    breakAt = i;
                }
                i = breakAt;
                ++n;
                lineWidth = 0;
                prevWhiteSpaceAt = prevBreakableCharAt = -1;
            }
            else {
                lineWidth = lineWidth2;
            }
        }
        
        return n;
    }
    
    getTextWidth(str: string): number {
        let lineWidth = 0;
        str = (<any>str).trimEnd();
        let l = str.length;
        let widths = this.widths;
        for (let i = 0; i < l; ++i) {
            let cc = str.charCodeAt(i);
            lineWidth += widths[cc];
        }
        return lineWidth;
    }
    
    getMaxTextLength(str: string, width: number, fullWords: boolean): number {
        let lineWidth = 0;
        str = (<any>str).trimEnd();
        let l = str.length;
        let widths = this.widths;
        let prevWordBreakAt = -1;
        for (let i = 0; i < l; ++i) {
            let cc = str.charCodeAt(i);
            lineWidth += widths[cc];
            if (cc == 32) {
                prevWordBreakAt = i;
            }
            if (lineWidth > width) {
                return fullWords && prevWordBreakAt > 0 ? prevWordBreakAt : i;
            }
        }
        return l;
    }
    
    allWidths(str: string): { str: string, width: number }[] {
        let res: { str: string, width: number }[] = [];
        let width = 0;
        let currStr = "";
        for (let len = 0; len <= str.length; ++len) {
            let c = len == 0 ? null : str.charCodeAt(len - 1);
            if (c !== null) {
                width += this.widths[c];
            }
            currStr = len == 0 ? "" : (currStr + str[len - 1]);
            res.push({
                str: currStr,
                width: width,
            });
        }
        return res;
    }
    
}
