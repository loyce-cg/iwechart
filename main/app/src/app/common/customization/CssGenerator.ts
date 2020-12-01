import { CustomizationParsingResult } from "./CssParser";

export class CssGenerator {
    static generate(parsed: CustomizationParsingResult, prefix: string = null): string {
        let vars: string[] = [];
        for (let name in parsed.cssVars) {
            let newName = name;
            if (prefix !== null) {
                newName = "--" + prefix + "-" + name.substr(2);
            }
            vars.push("  " + newName + ": " + parsed.cssVars[name] + ";\n");
        }
        return ":root {\n" + vars.join("") + "}\n";
    }
}
