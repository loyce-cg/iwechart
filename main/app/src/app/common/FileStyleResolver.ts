import * as privfs from "privfs-client";
import { CommonApplication } from "./CommonApplication";
import { Entry } from "../../mail/filetree/NewTree";
import Q = require("q");
import { Mindmap } from "../../component/mindmapeditor/Mindmap";

export interface FileStyle {
    styleName: string;
    fontSize: string;
    margin: string;
}

export class FileStyleResolver {
    
    static STORAGE_PREFIX_STYLENAME = "filestyle-";
    static STORAGE_PREFIX = "filestylestr-";
    
    constructor(public app: CommonApplication) {
    }
    
    getDefaultStyle(): FileStyle {
        return {
            styleName: Mindmap.DEFAULT_STYLE_NAME,
            fontSize: Mindmap.DEFAULT_FONT_SIZE,
            margin: Mindmap.DEFAULT_MARGIN,
        };
    }
    
    getStyle(file: Entry): Q.Promise<FileStyle> {
        if (!file) {
            return Q(this.getDefaultStyle());
        }
        return Q().then(() => {
            if (file.meta && file.meta.styleStr) {
                let style: FileStyle;
                try {
                    style = JSON.parse(file.meta.styleStr);
                }
                catch (e) {
                    style = null;
                }
                return style;
            }
            else if (file.meta && file.meta.styleName) {
                return {
                    styleName: file.meta.styleName,
                    fontSize: Mindmap.DEFAULT_FONT_SIZE,
                    margin: Mindmap.DEFAULT_MARGIN,
                };
            }
            else {
                return Q().then(() => {
                    return this.app.storage.getItem(`${FileStyleResolver.STORAGE_PREFIX}${file.id}`);
                })
                .then(str => {
                    let style: FileStyle = null;
                    if (str) {
                        try {
                            style = JSON.parse(str);
                        }
                        catch (E) {
                            style = null;
                        }
                    }
                    if (style) {
                        return style;
                    }
                    return Q().then(() => {
                        return this.app.storage.getItem(`${FileStyleResolver.STORAGE_PREFIX_STYLENAME}${file.id}`);
                    })
                    .then(styleName => {
                        if (styleName) {
                            return {
                                styleName: styleName,
                                fontSize: Mindmap.DEFAULT_FONT_SIZE,
                                margin: Mindmap.DEFAULT_MARGIN,
                            };
                        }
                        return null;
                    });
                });
            }
        })
        .then(style => {
            if (!style) {
                style = this.getDefaultStyle();
            }
            return style;
        });
    }
    
    setStyle(file: Entry, handle: privfs.fs.descriptor.Handle, style: FileStyle): Q.Promise<void> {
        let styleStr = JSON.stringify(style);
        if (!file || (file.meta && file.meta.styleStr == styleStr)) {
            return Q();
        }
        return this.updateMeta(file, handle, styleStr);
    }
    
    cacheStyle(fileId: string, style: FileStyle): Q.Promise<void> {
        let styleStr = JSON.stringify(style);
        return Q().then(() => {
            return this.app.storage.setItem(`${FileStyleResolver.STORAGE_PREFIX}${fileId}`, styleStr);
        });
    }
    
    clearCachedStyle(fileId: string): Q.Promise<void> {
        return Q().then(() => {
            return this.app.storage.removeItem(`${FileStyleResolver.STORAGE_PREFIX}${fileId}`);
        });
    }
    
    protected updateMeta(file: Entry, handle: privfs.fs.descriptor.Handle, styleStr: string): Q.Promise<void> {
        if (handle && handle.canWrite) {
            return handle.updateMeta({
                metaUpdater: this.getMetaStyleStrUpdater(styleStr),
            }).thenResolve(null);
        }
        else {
            return file.tree.fileSystem.updateMeta(file.path, this.getMetaStyleStrUpdater(styleStr)).thenResolve(null);
        }
    }
    
    protected getMetaStyleStrUpdater(styleStr: string): (meta: privfs.types.descriptor.Meta) => void {
        return (meta: privfs.types.descriptor.Meta) => {
            (<any>meta).styleStr = styleStr;
        };
    }
    
    static resolveStyleStrFromContentString(content: string): string {
        let styleName: string = Mindmap.DEFAULT_STYLE_NAME;
        let fontSize: string = Mindmap.DEFAULT_FONT_SIZE;
        let margin: string = Mindmap.DEFAULT_MARGIN;
        try {
            let obj = JSON.parse(content);
            if (obj && obj.style) {
                if (obj.style.name && obj.style.name in Mindmap.AVAILABLE_STYLES) {
                    styleName = obj.style.name;
                }
                if (obj.style.fontSize && obj.style.fontSize in Mindmap.AVAILABLE_FONT_SIZES) {
                    fontSize = obj.style.fontSize;
                }
                if (obj.style.margin && obj.style.margin in Mindmap.AVAILABLE_MARGINS) {
                    margin = obj.style.margin;
                }
            }
        }
        catch(e) {
        }
        return JSON.stringify(<FileStyle>{
            styleName,
            fontSize,
            margin,
        });
    }
    
}
