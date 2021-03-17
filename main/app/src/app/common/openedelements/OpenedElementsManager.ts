import { OpenableElement } from "../../common/shell/ShellTypes";
import { BaseWindowController } from "../../../window/base/BaseWindowController";

export interface OpenedElement {
    element: OpenableElement;
    window: BaseWindowController;
    externalId?: string;
    windowId: number;
    windowType: string;
}

export class OpenedElementsManager {
    openedElements: OpenedElement[] = [];
    lastWindowId: number = 0;
    
    constructor() {}
    
    getWindowId(): number {
        return (++this.lastWindowId);
    }
    
    indexOf(window: OpenedElement): number {
      let indexOf: number = -1;
      for (let i = 0; i < this.openedElements.length; i++) {
          if (this.openedElements[i].element && this.openedElements[i].element.equals(window.element)) {
              indexOf = i;
              break;
          }
      }
      return indexOf;
    }

    add(window: OpenedElement): void {
        this.openedElements.push(window);
    }
      
    exists(element: OpenableElement, winType: string) {
        for (let i = 0; i < this.openedElements.length; i++) {
            if (this.openedElements[i].element && this.openedElements[i].element.equals(element)
            && this.openedElements[i].windowType == winType ) {
                if (this.openedElements[i].window && this.openedElements[i].window.nwin) {
                    return true;
                } else {
                    this.openedElements.splice(i, 1);
                    return false;
                }
            }
        }
        return false;
    }
  
    getByElement(element: OpenableElement) {
        for (let i = 0; i < this.openedElements.length; i++) {
            if (this.openedElements[i].element && this.openedElements[i].element.equals(element)) {
                return this.openedElements[i];
            }
        }
        throw new Error("getByElement: element doesn't exists");
    }
    
    getByElementAndWindowType(element: OpenableElement, winType: string) {
        for (let i = 0; i < this.openedElements.length; i++) {
            if (this.openedElements[i].element && this.openedElements[i].element.equals(element)
            && this.openedElements[i].windowType == winType) {
                return this.openedElements[i];
            }
        }
        throw new Error("getByElementAndWindowType: element doesn't exists");
    }

    getByWindowId(windowId: number) {
        for (let i = 0; i < this.openedElements.length; i++) {
            if (this.openedElements[i].windowId == windowId) {
                return this.openedElements[i];
            }
        }
        throw new Error("getByWindowId: element doesn't exists");
    }

    remove(windowId: number) {
        let id: number = -1;
        for (let i = 0; i < this.openedElements.length; i++) {
            if (this.openedElements[i].windowId == windowId) {
                id = i;
            }
        }
        if (id > -1) {
            this.openedElements.splice(id, 1);
        }
    }
}