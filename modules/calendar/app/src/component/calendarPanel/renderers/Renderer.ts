import { CalendarPanelView } from "../CalendarPanelView";
import { Filter, TaskStatus } from "../../../main/Types";

export class SearchFilter {
    
    static prepareString(str: string): string {
        return str
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l");
    }
    
    static prepareHaystack(haystack: string): string {
        return this.prepareString(haystack);
    }
    
    static prepareNeedle(needle: string): string {
        return this.prepareString(needle);
    }
    
    static matches(preparedNeedle: string, haystack: string): boolean {
        let preparedHaystack = this.prepareString(haystack);
        return preparedHaystack.indexOf(preparedNeedle) >= 0;
    }
    
}

export abstract class Renderer<T> {
    
    constructor(public view: CalendarPanelView) {
    }
    
    abstract init(): void;
    abstract getRendererName(): string;
    abstract goToDate(d: number, m: number, y: number): void;
    abstract repaint(): void;
    abstract getPrevNextAbsDelta(): number;
    abstract zoomInOut(zoomIn: boolean, midPtY: number, yPos: number): void;
    
    zoomIn(midPtY: number = null, yPos: number = null): void {
        this.zoomInOut(true, midPtY, yPos);
    }
    
    zoomOut(midPtY: number = null, yPos: number = null): void {
        this.zoomInOut(false, midPtY, yPos);
    }
    
    taskMatchesSearchString(taskId: string, str: string): boolean {
        str = SearchFilter.prepareHaystack(str).replace(/<(?:.|\n)*?>/gm, '');
        let searchStr = this.view.searchStr;
        if (searchStr.length > 0 && searchStr[0] == "#") {
            return taskId.indexOf(searchStr.substr(1)) == 0;
        }
        return str.indexOf(searchStr) >= 0;
    }
    
    taskMatchesFilter(taskId: string): boolean {
        let task = this.view.model.tasks[taskId];
        let filter = this.view.model.settings["filter"];
        if (filter == Filter.allTasks) {
            return true;
        }
        if (filter == Filter.onlyIdea) {
            return task.status == TaskStatus.IDEA;
        }
        if (filter == Filter.onlyTodo) {
            return task.status == TaskStatus.TODO;
        }
        if (filter == Filter.onlyInProgress) {
            return task.status == TaskStatus.INPROGRESS;
        }
        if (filter == Filter.onlyDone) {
            return task.status == TaskStatus.DONE;
        }
        if (filter == Filter.onlyNotDone) {
            return task.status != TaskStatus.DONE;
        }
        return true;
    }
    
    fileMatchesSearchString(str: string): boolean {
        str = SearchFilter.prepareHaystack(str).replace(/<(?:.|\n)*?>/gm, '');
        let searchStr = this.view.searchStr;
        return str.indexOf(searchStr) >= 0;
    }
    
    fileMatchesFilter(identifier: string): boolean {
        return true;
        // let filter = this.view.model.settings["filter"];
        // if (filter == Filter.allTasks) {
        //     return true;
        // }
        // return false;
    }
    
}
