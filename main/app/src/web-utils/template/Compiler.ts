export class Compiler {
    
    constructor() {
    }
    
    static compile(str: string, asCommonModule?: boolean): string {
        let i = 0;
        let funcAsString = "";
        let pushString = (str: string, isCode: boolean, writeCode: number): string => {
            if (str.length == 0) {
                return;
            }
            if (isCode) {
                if (writeCode == 1) {
                    funcAsString += "write(" + str + ");";
                }
                else if (writeCode == 2) {
                    funcAsString += "write(Helper.escapeHtml(" + str + "));";
                }
                else if (writeCode == 3) {
                    funcAsString += "write(Helper.text(" + str + "));";
                }
                else {
                    funcAsString += str;
                }
            }
            else {
                funcAsString += 'write("' + str.replace(/\"/g, '\\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '");';
            }
        };
        let process = (isCode: boolean, withOpenTag: boolean, writeCode: number) => {
            while (i < str.length) {
                let index = str.indexOf("{{", i);
                let index2 = str.indexOf("}}", i);
                if (index != -1 && index < index2) {
                    pushString(str.substring(i, index), isCode, writeCode);
                    i = index + 2;
                    let writeCodeInChild = 0;
                    if (isCode == false && str.substr(i, 1) == "#") {
                        writeCodeInChild = 1;
                        i++;
                    }
                    else if (isCode == false && str.substr(i, 1) == "@") {
                        writeCodeInChild = 2;
                        i++;
                    }
                    else if (isCode == false && str.substr(i, 1) == "$") {
                        writeCodeInChild = 3;
                        i++;
                    }
                    process(!isCode, true, writeCodeInChild);
                    continue;
                }
                if (withOpenTag) {
                    if (index2 != -1) {
                        pushString(str.substring(i, index2), isCode, writeCode);
                        i = index2 + 2;
                        break;
                    }
                }
                pushString(str.substring(i), isCode, writeCode);
                i = str.length;
            }
        };
        process(false, false, 0);
        return (asCommonModule ? 'module.exports = ' : '') + '(function(model, context, Helper) {\n    var result = "";\n    var write = function(str) { result += str; };\n    ' + funcAsString + '\n    return result;\n})';
    }
    
    static compileWithCheck(str: string, asCommonModule?: boolean): string {
        let code = Compiler.compile(str, asCommonModule);
        eval(code);
        return code;
    }
    
    static eval(str: string): Function {
        return eval(Compiler.compile(str));
    }
}
