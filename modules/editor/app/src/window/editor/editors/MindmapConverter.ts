// deprecated code 

import { SerializedElementSpec } from "./Mindmap";

export interface ParentsMap {
    id: number, level: number, childrenObjs: SerializedElementSpec[]
}

export class MindmapConverter {
    static convertTextToMindMap(textElements: string[]): SerializedElementSpec[] | SerializedElementSpec{
        let mindmap: SerializedElementSpec[] = [];
        let parentsMap: ParentsMap[] = [];
        
        if (textElements.length == 0) {
            return null;
        }
        let baseLevel =  MindmapConverter.getTabLevel(textElements[0]);
        let currentLevel = baseLevel;
        
        let currentNodes:any = mindmap;
        
        for ( let i = 0; i < textElements.length; i++) {
            let elementLevel = MindmapConverter.getTabLevel(textElements[i]);
            let parentMapElem = MindmapConverter.getParentElem(i, elementLevel, parentsMap);
            
            currentNodes = parentMapElem ? parentMapElem.childrenObjs : mindmap;
            
            let elemName = MindmapConverter.removeR(textElements[i].trim());
            if (elemName.length > 0) {
                currentNodes.push(<SerializedElementSpec>{label: elemName, nodes: []});
                parentsMap.push({id: i, level: elementLevel, childrenObjs: currentNodes[currentNodes.length-1].nodes});
            }
            
        }
        return mindmap;
    }
    
    static getParentElem(childId: number, childLevel: number, parentsMap: ParentsMap[]):ParentsMap {
        for (let i = parentsMap.length - 1; i >= 0; --i) {
            if (parentsMap[i].id < childId && parentsMap[i].level < childLevel) {
                return parentsMap[i];
            }
        }
        return null;
    }
    
    static removeR(elem: string): string {
        return elem.replace("\r","");
    }
    
    static getTabLevel(text: string): number {
        let level: number = 0;
        for (let i = 0; i < text.length; i++) {
            if (text.charAt(i) == "\t" || text.charAt(i) == " ") {
                level++;
            }
            else {
                break;
            }
        }
        return level;
    }
    
    static reduceTabs(elements: string[]) {
        let reduced: string[] = [];
        if (elements.length == 0) {
            return [];
        }
        let qty = MindmapConverter.getTabLevel(elements[0]);
        let toReduce = "";
        for (let j = 0; j < qty; j++) {
            toReduce += "\t";
        }
        
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].indexOf(toReduce) == 0) {
                reduced.push(elements[i].substr(qty));
            } else {
                break;
            }
        }
        return reduced;
    }
    
    static getChildElements(elements: string[], parentIndex: number):string[] {
        let parentLevel = MindmapConverter.getTabLevel(elements[parentIndex]);
        let children: string[] = [];
        for (let i = parentIndex + 1; i < elements.length; i++) {
            let level = MindmapConverter.getTabLevel(elements[i]);
            if (level > parentLevel) {
                children.push(elements[i]);
            } else {
                break;
            }
        }
        return children;
    }
    
    static getRawAsFlatText(data: SerializedElementSpec): string {
        return MindmapConverter.singleElementAsText(data, 1) + "\n";
    }
    
    static singleElementAsText(element: SerializedElementSpec, level: number): string {
        if (!element) {
            return "";
        }
        let parent: string = element.label;
        let gap = Array(level+1).join("\t");
        if (element.nodes && element.nodes.length > 0) {
            element.nodes.forEach( node => {
                parent += "\n" + gap + MindmapConverter.singleElementAsText(node, level + 1);
            })
        }
        return parent;
    }
}
