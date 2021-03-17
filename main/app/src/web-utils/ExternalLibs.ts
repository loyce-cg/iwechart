import highlightModule = require("highlight.js");
import zxcvbnModule = require("zxcvbn-mod");
import agGridModule = require("@ag-grid-community/all-modules");

export type highlight = typeof highlightModule;
export type zxcvbn = typeof zxcvbnModule;
export type agGrid = typeof agGridModule;

declare function privmxLibHighlightRequire(module: "highlight.js"): highlight;
declare function privmxLibZxcvbRequire(module: "zxcvbn-mod"): zxcvbn;
declare function privmxLibAgGridRequire(module: "ag-grid"): agGrid;

export class ExternalLibs {
    
    static getHighlight(): highlight {
        return privmxLibHighlightRequire("highlight.js");
    }
    
    static getZxcvbn(): zxcvbn {
        return privmxLibZxcvbRequire("zxcvbn-mod");
    }
    
    static getAgGrid(): agGrid {
        return privmxLibAgGridRequire("ag-grid");
    }
}
