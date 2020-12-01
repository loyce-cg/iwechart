import {Sanitize} from "./Sanitize";
import {webUtils} from "../Types";

export type StyleElement = {node_name: string, node: HTMLElement};

export class HtmlSanitizer {
    
    s: Sanitize;
    
    constructor(options: webUtils.SanitizeOptions) {
        this.s = new Sanitize(options);
    }
    
    clean(html: string): string {
        let d = document.createElement('div');
        d.innerHTML = html;
        let c = this.s.clean_node(d);
        let r = document.createElement('div');
        r.appendChild(c);
        return r.innerHTML;
    }
    
    static createStyleTransformer(tag: string, allowed: string[]): (input: StyleElement) => StyleElement {
        return (input: StyleElement) => {
            let i, len, s, toRemove, name;
            if (input.node_name !== tag) {
                return;
            }
            s = input.node.style;
            if (s.length > 0) {
                toRemove = [];
                for (i = 0, len = s.length; i < len; i++) {
                    name = s[i];
                    if (allowed.indexOf(name) === -1) {
                        toRemove.push(name);
                    }
                }
                for (i = 0, len = toRemove.length; i < len; i++) {
                    s.removeProperty(toRemove[i]);
                }
            }
            if (s.length == 0) {
                input.node.removeAttribute("style");
            }
            return input;
        };
    }
}

