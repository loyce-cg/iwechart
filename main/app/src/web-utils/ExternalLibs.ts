import highlightModule = require("highlight.js");
import zxcvbnModule = require("zxcvbn-mod");

export type highlight = typeof highlightModule;
export type zxcvbn = typeof zxcvbnModule;

declare function privmxLibHighlightRequire(module: "highlight.js"): highlight;
declare function privmxLibZxcvbRequire(module: "zxcvbn-mod"): zxcvbn;

export class ExternalLibs {
    
    static getHighlight(): highlight {
        return privmxLibHighlightRequire("highlight.js");
    }
    
    static getZxcvbn(): zxcvbn {
        return privmxLibZxcvbRequire("zxcvbn-mod");
    }
    
}