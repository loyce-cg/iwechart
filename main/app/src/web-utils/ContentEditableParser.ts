export interface Token {
    type: "tag" | "string";
    value: string;
}

export class ContentEditableParser {
    
    static tokenize(data: string, preNewLines: boolean): Token[] {
        let preSpaces: boolean = true;
        let tokens: Token[] = [];
        let currStr: string = "";
        let prevTokenIsDiv: boolean = false;
        for (let i = 0; i < data.length; ++i) {
            if (data[i] == "<") {
                if (currStr) {
                    tokens.push({ type: "string", value: currStr });
                    prevTokenIsDiv = false;
                    currStr = "";
                }
                let tag: string = null;
                for (let j = i + 1; j < data.length; ++j) {
                    if (data[j] == ">") {
                        tag = data.substr(i, j - i + 1);
                        i = j;
                        break;
                    }
                }
                if (tag !== null) {
                    tokens.push({ type: "tag", value: tag });
                    prevTokenIsDiv = tag == "<div>" || tag == "</div>";
                }
                else {
                    tokens.push({ type: "string", value: data.substr(i) });
                    prevTokenIsDiv = false;
                }
            }
            else if (prevTokenIsDiv && data[i] == "\n") {
                // Ignore
            }
            else if (!preNewLines && data[i] == "\n") {
                if (!(<any>currStr).endsWith(" ")) {
                    currStr += " ";
                }
            }
            else if (!preSpaces && data[i] == " ") {
                if (!(<any>currStr).endsWith(" ")) {
                    currStr += " ";
                }
            }
            else if (data[i] == "\r") {
                // Ignore
            }
            else {
                currStr += data[i];
            }
        }
        if (currStr) {
            tokens.push({ type: "string", value: currStr });
            prevTokenIsDiv = false;
            currStr = "";
        }
        return tokens;
    }
    
    static convertDivsToBrs(data: string, preNewLines: boolean): string {
        let res: string = "";
        let tokens: Token[] = this.tokenize(data, preNewLines);

        let isAfterText: boolean = false;
        for (let i = 0; i < tokens.length; ++i) {
            let token: Token = tokens[i];
            if (token.type == "string") {
                res += token.value;
                isAfterText = true;
            }
            else if (token.type == "tag") {
                if (token.value == "<div>") {
                    continue;
                }
                if (token.value == "</div>") {
                    if (isAfterText) {
                        isAfterText = false;
                        res += "<brx>";
                    }
                }
                else {
                    res += token.value;
                }
            }
        }
        while ((<any>res).endsWith("<brx>")) {
            res = res.substr(0, res.length - 5);
        }
        return res.replace(/<brx>/g, "<br>");
    }
    
    static extractBody(data: string): string {
        let bodyStartTagStartIndex: number = data.indexOf("<body");
        let bodyEndTagStartIndex: number = data.lastIndexOf("</body>");
        if (bodyStartTagStartIndex >= 0 && bodyEndTagStartIndex >= 0) {
            let bodyStartTagEndIndex: number = this.indexOfChar(data, ">", bodyStartTagStartIndex + 1) + 1;
            if (bodyStartTagEndIndex >= 0) {
                return data.substring(bodyStartTagEndIndex, bodyEndTagStartIndex).trim();
            }
        }
        
        return data;
    }
    
    protected static indexOfChar(data: string, char: string, startIndex: number): number {
        for (let i = startIndex; i < data.length; ++i) {
            if (data[i] == char) {
                return i;
            }
        }
        return -1;
    }
    
}
