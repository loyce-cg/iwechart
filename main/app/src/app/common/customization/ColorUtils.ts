export class ColorUtils {

    static hsla2rgba(hsla: number[]) : number[] {
        let r, g, b;
        let h = hsla[0] / 360;
        let s = hsla[1] / 100;
        let l = hsla[2] / 100;
        let a = hsla[3];
        
        if (s == 0) {
            r = g = b = l;
        }
        else {
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
            r = this.hue2rgb(p, q, h + 1 / 3);
            g = this.hue2rgb(p, q, h);
            b = this.hue2rgb(p, q, h - 1 / 3);
        }
        
        return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255), a];
    }
    
    static rgba2hsla(rgba: number[]) : number[] {
        let r = rgba[0] / 255;
        let g = rgba[1] / 255;
        let b = rgba[2] / 255;
        let a = rgba[3];
        let min = Math.min(r, g, b);
        let max = Math.max(r, g, b);
        let h, s, l;

        l = (min + max) / 2;
        if (max == min){
            h = s = 0;
        }
        else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [Math.floor(h * 360), Math.floor(s * 100), Math.floor(l * 100), a];
    }
    
    static hue2rgb(p: number, q: number, t: number): number {
        if (t < 0) {
            t += 1;
        }
        if (t > 1) {
            t -= 1;
        }
        if (t < 1 / 6) {
            return p + (q - p) * 6 * t;
        }
        if (t < 1 / 2) {
            return q;
        }
        if (t < 2 / 3) {
            return p + (q - p) * (2 / 3 - t) * 6;
        }
        return p;
    }
    
    static mixColors(hsla1: number[], hsla2: number[]) {
        let rgba1 = this.hsla2rgba(hsla1);
        let rgba2 = this.hsla2rgba(hsla2);
        let rgba3 = [];
        for (let i = 0; i <= 3; ++i) {
            rgba3[i] = Math.floor((rgba1[i] + rgba2[i]) / 2);
        }
        let hsla3 = this.rgba2hsla(rgba3);
        return hsla3;
    }
    
}
