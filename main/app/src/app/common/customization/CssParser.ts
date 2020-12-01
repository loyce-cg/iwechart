export type CssVariables = { [name: string]: string };

export enum CustomizationVariableType {
    HSLA_BASIC,
    HSLA_DELTA,
    OPACITY,
    FONT_FAMILY_CUSTOM,
    FONT_FAMILY_ONEOF,
    FONT_SIZE,
    HSLA_DARKEN,
    HSLA_LIGHTEN,
}

export interface CustomizationVariable {
    name: string;
    value: string;
    type: CustomizationVariableType;
}

export interface CustomizationParsingResult {
    cssVars: CssVariables;
    customizationVars: CustomizationVariable[];
}

export class CssParser {
    
    private static _parseBasicVariables(css: string): CssVariables {
        let vars: CssVariables = {};
        let re = /  (\-\-[a-zA-Z0-9_\-]+):([a-zA-Z0-9\%\(\)\s\,\-_\.\+\*\/]+);/g;
        let m: RegExpExecArray = null;
        do {
            m = re.exec(css);
            if (m) {
                vars[m[1].trim()] = m[2].trim();
            }
        } while (m);
        return vars;
    }
    
    static parseVariables(css: string): CustomizationParsingResult {
        let basicVars = this._parseBasicVariables(css);
        let vars: CustomizationVariable[] = [];
        for (let varName in basicVars) {
            let lastTwo = varName.substr(-2);
            if (lastTwo != "-h" && lastTwo != "-s" && lastTwo != "-l" && lastTwo != "-a" && varName.substr(-6) != "-delta") {
                let type: CustomizationVariableType = null;
                if (varName.substr(-8) == "-opacity") {
                    type = CustomizationVariableType.OPACITY;
                }
                else if ((varName + "-h") in basicVars) {
                    type = CustomizationVariableType.HSLA_BASIC;
                }
                else if ((varName + "-delta") in basicVars) {
                    type = CustomizationVariableType.HSLA_DELTA;
                }
                else if (varName.substr(-12) == "-transparent") {
                    type = CustomizationVariableType.HSLA_DELTA;
                }
                else if (varName.substr(0, 5) == "--ff-") {
                    type = CustomizationVariableType.FONT_FAMILY_CUSTOM;
                }
                else if (varName.substr(-12) == "-font-family") {
                    type = CustomizationVariableType.FONT_FAMILY_ONEOF;
                }
                else if (varName.substr(0, 11) == "--font-size") {
                    type = CustomizationVariableType.FONT_SIZE;
                }
                else if (varName.substr(-7) == "-darken") {
                    type = CustomizationVariableType.HSLA_DARKEN;
                }
                else if (varName.substr(-8) == "-lighten") {
                    type = CustomizationVariableType.HSLA_LIGHTEN;
                }
                if (type !== null) {
                    vars.push({
                        name: varName,
                        value: basicVars[varName],
                        type: type,
                    });
                }
                else {
                    console.log("CssParser: unable to determine variable type - " + varName);
                }
            }
        }
        return {
            cssVars: basicVars,
            customizationVars: vars,
        };
    }
    
}
