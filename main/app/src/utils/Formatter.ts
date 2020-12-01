import linkifyText = require("linkifyjs/html");

export class Formatter {
    
    className: string;
    
    static entityMap: {[name: string]: string} = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    static DECIMAL_POINT = (1.1).toString()[1];
    
    constructor() {
    }
    
    escapeHtml(str: string|number|boolean): string {
        if (str == null) {
            return "";
        }
        let ss = typeof(str) == "string" ? str : str.toString();
        return ss.replace(/[&<>"'`=\/]/g, s => {
            return Formatter.entityMap[s];
        });
    }
    
    escapeHtmlLight(str: string|number|boolean): string {
        if (str == null) {
            return "";
        }
        let ss = typeof(str) == "string" ? str : str.toString();
        return ss.replace(/[&<>"'`=]/g, s => {
            return Formatter.entityMap[s];
        });
    }
    
    text(str: string): string {
        let escapedStr = this.escapeHtml(str);
        return this.nl2br(escapedStr);
    }
    
    pad(strArg: number|string, length: number, char: string, type?: string): string {
        let str = strArg.toString();
        if (str.length >= length) {
            return str;
        }
        char = char || " ";
        let padLength = length - str.length;
        let pad = "";
        for (let i = 0; i < padLength; i++) {
            pad += char;
        }
        return type == "right" ? str + pad : pad + str;
    }
    
    dateDay(dateArg: Date|number|string): string {
        let date = (typeof(dateArg) == "object") ? <Date>dateArg : new Date(parseInt(<string>dateArg));
        return date.getFullYear() + "-" + this.pad(date.getMonth() + 1, 2, "0") + "-" + this.pad(date.getDate(), 2, "0");
    }
    
    dateWithHourLocal(dateArg: Date|number|string, withSeconds: boolean = true): string {
        let date = (typeof(dateArg) == "object") ? <Date>dateArg : new Date(parseInt(<string>dateArg));
        return date.getFullYear() + "-" + this.pad(date.getMonth() + 1, 2, "0") + "-" + this.pad(date.getDate(), 2, "0") + " " + this.pad(date.getHours(), 2, "0") + ":" + this.pad(date.getMinutes(), 2, "0") + (withSeconds ? "." + this.pad(date.getSeconds(), 2, "0") : "");
    }
    
    fill2(n: number): string {
        return n >= 10 ? n.toString() : "0" + n;
    }
    
    standardDate(d: string|number|Date): string {
        let date = d instanceof Date ? d : new Date(parseInt(<string>d));
        return date.getFullYear() + "-" + this.fill2(date.getMonth() + 1) + "-" + this.fill2(date.getDate()) + " " + this.fill2(date.getHours()) + ":" + this.fill2(date.getMinutes()) + ":" + this.fill2(date.getSeconds());
    }

    standardDateWithoutTime(d: string|number|Date): string {
        let date = d instanceof Date ? d : new Date(parseInt(<string>d));
        return date.getFullYear() + "-" + this.fill2(date.getMonth() + 1) + "-" + this.fill2(date.getDate());
    }

    convertServerTotalStorageSizeToPrivMXFormat(storage: string) {    
        return storage.substring(0, storage.length - 1) + " " + storage[storage.length - 1] + "B";
    }

    linkifyTest(text: string) {
        let urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return urlRegex.test(text);
    }
    
    linkify(inputText: string, skipHtmlEscaping?: boolean, defaultLinkTitle?: string, br2nl?: boolean): string {
        let replacedText: string;
        if (br2nl) {
            replacedText = inputText.replace(/<br(\s)*(\/)*(\s)*>/gi, "\n");
        }
        else {
            replacedText = inputText;
        }
        if (!skipHtmlEscaping) {
            replacedText = this.escapeHtml(inputText);
        }
        defaultLinkTitle = defaultLinkTitle || "";
        
        let doLinkify = this.linkifyTest(replacedText);
        if (doLinkify) {
            replacedText = linkifyText(replacedText, {attributes: {
                rel: "noopener noreferrer",
                "data-window-opener": "true",
                title: defaultLinkTitle
            }});
        }
        // let hashmailPattern = /(^|\s+)(\w+#[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*)/gim;
        // replacedText = replacedText.replace(hashmailPattern, '$1<span class="link linkify" data-window-opener="true" title="' + defaultLinkTitle + '" data-url="hashmailto:$2">$2</span>');
        replacedText = this.nl2br(replacedText);
        return replacedText;
    }
    
    nl2br(text: string): string {
        return text.replace(/(\r\n|\n\r|\r|\n)/g, "<br>");
    }
    
    bytesSize2(size: number): string {
        let base = 1024;
        let exp = Math.log(size) / Math.log(base) | 0;
        let result = size / Math.pow(base, exp);
        result = Math.floor(result * 100) / 100;
        return result + ' ' + (exp == 0 ? '' : 'KMGTPEZY'[exp - 1]) + 'B';
    }
    
    bytesSize(size: number): string {
        let base = 1000;
        let exp = Math.log(size) / Math.log(base) | 0;
        if (exp == 0) {
            return "1 KB";
        }
        let result = size / Math.pow(base, exp);
        if (exp == 1) {
            let ceil = Math.ceil(result);
            return (ceil == 1000 ? 999 : ceil) + " KB";
        }
        let integer = Math.floor(result);
        let str = integer + Formatter.DECIMAL_POINT + this.pad(Math.floor((result - integer) * 100), 2, "0");
        return str + ' ' + (exp == 0 ? '' : 'KMGTPEZY'[exp - 1]) + 'B';
    }
    
    truncate(text: string, size: number, suffix?: string): string {
        suffix = suffix || "...";
        if (!text) {
            return;
        }
        if (text.length > size) {
            return text.slice(0, size) + suffix;
        }
        return text;
    }
}
