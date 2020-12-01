import { JQuery as $, Q } from "pmc-web";
import { CalendarPanelView } from "../CalendarPanelView";
import { FastList, FastListEntry } from "privfs-mail-client-tasks-plugin/src/main/FastList";
import { FastListCreator } from "privfs-mail-client-tasks-plugin/src/main/FastListCreator";
import { Renderer } from "./Renderer";

export interface RendererSettings {
    zoom: number;
}

export enum ZoomMode {
    DEFAULT = 1,
    FIXED = 2,
};

export abstract class FastListRenderer<T> extends Renderer<T> {
    
    static ELLIPSIS_LENGTH = -1;
    
    zoomMode: ZoomMode = ZoomMode.DEFAULT;
    fixedZoom: number = 1.0;
    
    zoom: number = 1.0;
    emptyEntryTemplate: HTMLElement = null;
    
    constructor(view: CalendarPanelView, public fastListCreator: FastListCreator) {
        super(view);
    }
    
    fastList: FastList<T>;
    
    getEllipsisLength(): number {
        if (FastListRenderer.ELLIPSIS_LENGTH < 0) {
            this.view.parent.fontMetrics.add(".");
            this.view.parent.fontMetrics.measure();
            FastListRenderer.ELLIPSIS_LENGTH = this.view.parent.fontMetrics.getTextWidth("...");
        }
        return FastListRenderer.ELLIPSIS_LENGTH;
    }
        
    abstract init(): Q.Promise<void>;
    
    abstract getRendererName(): string;
    
    repaint(causedByContainerEvent: boolean = false): void {
        try {
            this.view.updateClasses();
            this.updateFastListEntries();
            this.renderFastList(causedByContainerEvent);
        }
        catch (e) {
            console.error("REPAINT ERROR", e);
        }
    }
    
    abstract renderFastList(causedByContainerEvent: boolean): void;
    
    abstract afterFastListRender(range: [number, number], causedByContainerEvent: boolean): void;
    
    afterFastListResize() {
        this.repaint(true);
    }
    
    createFastListEmptyElement(): HTMLElement {
        return <HTMLElement>this.emptyEntryTemplate.cloneNode(true);
    }
    
    centerFastList(): void {
        this.fastList.center();
    }
    
    abstract onMouseWheel(e: MouseWheelEvent): void;
    
    updateZoom(): void {
        this.saveSettings();
    }
    
    abstract goToDate(d: number, m: number, y: number): void;
    
    abstract getActiveDate(): Date;
    
    abstract updateFastListEntries(): void;
    
    abstract fillFastListElement(element: HTMLElement, entry: FastListEntry<T>, entryId: number): void;
    
    applySettings(repaint: boolean = true): void {
        let settings: RendererSettings = JSON.parse(<string>this.view.getSetting("renderer-settings-" + this.getRendererName()));
        if (!settings) {
            settings = {
                zoom: 1.0,
            };
        }
        if (this.zoomMode == ZoomMode.FIXED) {
            this.zoom = this.fixedZoom;
        }
        else {
            this.zoom = settings.zoom;
        }
        if (repaint) {
            this.repaint();
        }
    }
    
    saveSettings(): void {
        let settings: RendererSettings = {
            zoom: this.zoom,
        };
        this.view.settingChanged("renderer-settings-" + this.getRendererName(), JSON.stringify(settings));
    }
    
}
