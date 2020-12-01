export interface FilePickerData {
    userFriendlyId: string;
    did: string;
    elementId: string;
    icon: string;
    sessionHost: string;
}

interface ContentEditableEditorRawMetaData {
    filePickerData?: FilePickerData[];
}

export class ContentEditableEditorMetaData {
    
    static META_DATA_TAG_NAME = "privmx-ced-meta-data";
    static FILE_PICKER_TRIGGER_CHARACTER = "/";
    filePickerData?: FilePickerData[];
    
    constructor() {
    }
    
    attach(html: string): string {
        //let matches = html.match(/\B:[^\s<]+/g) || [];
        let matches = ContentEditableEditorMetaData.parseFileTags(html);
        let metaDataObj: ContentEditableEditorRawMetaData = {
            filePickerData: (this.filePickerData || []).filter(x => matches.filter(y => x.userFriendlyId == y.text).length > 0),
        };
        
        if (metaDataObj.filePickerData.length == 0) {
            return html;
        }
        
        const tagName = ContentEditableEditorMetaData.META_DATA_TAG_NAME;
        let metaDataTag = `<${tagName} value="${encodeURIComponent(JSON.stringify(metaDataObj))}"></${tagName}>`;
        return metaDataTag + html;
    }
    
    addFilePickerData(filePickerData: FilePickerData): void {
        if (!this.filePickerData) {
            this.filePickerData = [];
        }
        this.filePickerData.push(filePickerData);
    }
    
    static fromString(str: string): ContentEditableEditorMetaData {
        let inst = new ContentEditableEditorMetaData();
        
        try {
            let obj = JSON.parse(str);
            if (obj) {
                inst.filePickerData = obj.filePickerData || [];
            }
        }
        catch (e) {
        }
        
        return inst;
    }
    
    static extractMetaFromHtml(htmlWithMeta: string): { metaData: ContentEditableEditorMetaData, html: string } {
        let metaData = new ContentEditableEditorMetaData();
        const tagName = ContentEditableEditorMetaData.META_DATA_TAG_NAME;
        if ((<any>htmlWithMeta).startsWith(`<${tagName} `)) {
            let parts = htmlWithMeta.split(`</${tagName}>`);
            let html = parts[1];
            let metaStr = decodeURIComponent(parts[0].replace(/.*"(.*)".*/, "$1") || "");
            let metaObj: ContentEditableEditorRawMetaData = null;
            try {
                metaObj = JSON.parse(metaStr) || {};
            }
            catch (e) {
            }
            metaData.filePickerData = metaObj && metaObj.filePickerData ? metaObj.filePickerData : [];
            return { metaData, html };
        }
        return { metaData, html: htmlWithMeta };
    }
    
    static parseFileTags(str: string): { start: number, end: number, text: string }[] {
        let res: { start: number, end: number, text: string }[] = [];
        for (let i = 0; i < str.length; ++i) {
            let c = str[i];
            if (c == ContentEditableEditorMetaData.FILE_PICKER_TRIGGER_CHARACTER && str[i + 1] == "{") {
                let start = i;
                i += 1;
                let esc: boolean = false;
                for (let j = i + 1; j < str.length; ++j) {
                    let cc = str[j];
                    if (cc == "}") {
                        if (!esc) {
                            let text = str.substr(start, j - start + 1);
                            res.push({
                                start: start,
                                end: j,
                                text: text,
                            });
                            j = i;
                            break;
                        }
                    }
                    else if (cc == "{") {
                        if (!esc) {
                            i = j - 1;
                            break;
                        }
                    }
                    else if (cc == "\\") {
                        esc = !esc;
                    }
                    
                    if (cc != "\\") {
                        esc = false;
                    }
                }
            }
        }
        return res;
    }
    
    static parseFileTag(str: string): { fullSectionName: string, path: string } {
        // Remove leading %{ and trailing }
        str = str.substr(2, str.length - 3);
        
        // Find first not escaped ':'
        let idx = this.indexOfNotEscaped(str, ":");
        if (idx < 0) {
            return null;
        }
        
        // Split by the ':'
        let fullSectionName = str.substr(0, idx);
        let path = str.substr(idx + 1);
        
        // Unescape
        fullSectionName = this.unescapeSectionName(fullSectionName);
        path = this.unescapeFilePath(path);
        
        return {
            fullSectionName: fullSectionName,
            path: path,
        };
    }
    
    static indexOfNotEscaped(haystack: string, needleChr: string, last: boolean = false): number {
        let esc = false;
        let idx = -1;
        for (let i = 0; i < haystack.length; ++i) {
            let c = haystack[i];
            if (c == "\\") {
                esc = !esc;
            }
            else if (c == needleChr && !esc) {
                idx = i;
                esc = false;
                if (!last) {
                    break;
                }
            }
            else {
                esc = false;
            }
        }
        return idx;
    }
    
    static escapeSectionName(str: string): string {
        return str.replace(/({|}|:)/g, "\\$1");
    }
    
    static unescapeSectionName(str: string): string {
        return str.replace(/\\({|}|:)/g, "$1");
    }
    
    static escapeFilePath(str: string): string {
        return str.substr(1).replace(/({|})/g, "\\$1");
    }
    
    static unescapeFilePath(str: string): string {
        return "/" + str.replace(/\\({|})/g, "$1");
    }
    
}
