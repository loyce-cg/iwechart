export class DateUtils {
    
    static parse(dateStr: string, nullable: boolean = false): Date {
        if (!dateStr) {
            return nullable ? null : new Date(0, 0, 0);
        }
        
        let dmY = dateStr.split(".");
        
        let d = parseInt(dmY[0]);
        let m = parseInt(dmY[1]) - 1;
        let Y = parseInt(dmY[2]);
        
        return new Date(Y, m, d);
    }
    
    static stringFromWebFormat(str: string): string {
        str = str.trim();
        if (str.length == 0) {
            return str;
        }
        
        return str.split("-").reverse().join(".");
    }
    
    static stringToWebFormat(str: string): string {
        str = str.trim();
        if (str.length == 0) {
            return str;
        }
        
        return str.split(".").reverse().join("-");
    }
    
    static nowdmYHi(): string {
        let date = new Date();
        let d = date.getDate().toString();
        let m = (date.getMonth() + 1).toString();
        let Y = date.getFullYear().toString();
        let H = date.getHours().toString();
        let i = date.getMinutes().toString();
        if (d.length == 1) {
            d = "0" + d;
        }
        if (m.length == 1) {
            m = "0" + m;
        }
        if (H.length == 1) {
            H = "0" + H;
        }
        if (i.length == 1) {
            i = "0" + i;
        }
        return `${d}.${m}.${Y} ${H}:${i}`;
    }
    
    static dmYHiToTimestamp(str: string, enhancePrecision: boolean = false): number {
        if (enhancePrecision && this.nowdmYHi() == str) {
            return new Date().getTime();
        }
        let [dmY, Hi] = str.split(" ");
        let [d, m, Y] = dmY.split(".").map(x => parseInt(x));
        let [H, i] = Hi.split(":").map(x => parseInt(x));
        --m;
        return new Date(Y, m, d, H, i).getTime();
    }
    
}
