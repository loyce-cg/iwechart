import Q = require("q");
import { FontMetricsBase } from "./FontMetricsBase";

export interface WidthsData {
    widths: { [chr: number]: number };
    boldWidths: { [chr: number]: number };
}

export class FontMetricsController extends FontMetricsBase {
    
    chars: { [chr: number]: boolean } = {};
    widths: { [chr: number]: number } = {};
    boldWidths: { [chr: number]: number } = {};
    allowBreakAfterChars: number[] = null;
    jobDeferred: Q.Deferred<void> = null;
    
    constructor(public retrieveFromView: (method: string, ...args: any[]) => Q.Promise<string>) {
        super();
    }
    
    measure(force: boolean = false): Q.Promise<void> {
        if (force) {
            this.widths = {};
        }
        
        let charCodesToMeasure: number[] = [];
        for (let charCode in this.chars) {
            if (!(charCode in this.widths)) {
                charCodesToMeasure.push(Number(charCode));
            }
        }
        
        if (charCodesToMeasure.length == 0) {
            return Q();
        }
        
        return Q().then(() => {
            return this.jobDeferred ? this.jobDeferred.promise : null;
        }).then(() => {
            if (this.allowBreakAfterChars == null) {
                return this.retrieveFromView("getAllowBreakAfterChars").then(allowBreakAfterCharsStr => {
                    this.allowBreakAfterChars = JSON.parse(allowBreakAfterCharsStr);
                });
            }
        }).then(() => {
            this.jobDeferred = Q.defer<void>();
            return this.retrieveFromView("measureCharacters", JSON.stringify(charCodesToMeasure));
        }).then(dataStr => {
            let data: WidthsData = JSON.parse(dataStr);
            for (let charCode in data.widths) {
                this.widths[Number(charCode)] = data.widths[Number(charCode)];
                this.boldWidths[Number(charCode)] = data.boldWidths[Number(charCode)];
            }
        }).fin(() =>{
            this.jobDeferred.resolve();
        });
    }
    
}
