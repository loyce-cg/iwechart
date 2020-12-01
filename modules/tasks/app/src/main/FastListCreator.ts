import { FastList } from "./FastList";

export class FastListCreator {

    constructor() {
    }
    
    create<T>(container: HTMLElement, paddingContainer: HTMLElement, entriesContainer: HTMLElement): FastList<T> {
        return new FastList(container, paddingContainer, entriesContainer);
    }
    
}
