import is = require("is_js");
import {Lang} from "../utils/Lang";
import {window} from "./Window";

export class UrlOpener {
    
    static open(url: string): void {
        if (Lang.startsWith(url, "mailto:") || is.ie()) {
            let o = window.open(url);
            (<any>o).opener = null;
        }
        else {
            let a = document.createElement("a");
            a.setAttribute("href", url);
            a.setAttribute("rel", "noopener noreferrer");
            a.setAttribute("target", "_blank");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }
}
