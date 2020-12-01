import * as $ from "jquery";
import * as Types from "../../Types";
import * as Q from "q";
import { Model } from "./ThumbsController";
import { ComponentView } from "../base/ComponentView";
import { WebUtils } from "../../web-utils";


export enum ThumbState {
    UNINITIALIZED = "uninitialized",
    LOADING = "loading",
    LOADED = "loaded",
    REMOVED = "removed",
}

export interface Thumb {
    did: string;
    sectionId: string;
    state: ThumbState;
    $els: JQuery;
    objectUrl: string;
}

export interface ThumbLoadedEvent {
    type: "thumbLoaded";
    $thumb: JQuery;
}

export interface ThumbRemovedEvent {
    type: "thumbRemoved";
    $thumb: JQuery;
}

export class ThumbsView extends ComponentView {
    
    $container: JQuery;
    protected thumbsByDid: { [did: string]: Thumb } = {};
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
    }
    
    processThumbs(): void {
        let containerRect = this.$container[0].getBoundingClientRect();
        if (containerRect.height == 0) {
            return;
        }
        this.$container.find(`[data-thumb-did][data-thumb-section-id][data-thumb-state="${ThumbState.UNINITIALIZED}"]`).each((_, el) => {
            let $el = $(el);
            if (!this.inElementInContainerViewportY($el, containerRect.top, containerRect.height)) {
                if (!$el.data("thumb-intersection-observer")) {
                    let isFirstCall: boolean = true;
                    let observer = new IntersectionObserver(() => {
                        if (isFirstCall) {
                            isFirstCall = false;
                            return;
                        } 
                        this.processThumbs();
                    }, {});
                    $el.data("thumb-intersection-observer", observer);
                    observer.observe(el);
                }
                return;
            }
            let observer: IntersectionObserver = $el.data("thumb-intersection-observer");
            if (observer) {
                observer.unobserve(el);
                observer.disconnect();
                $el.data("thumb-intersection-observer", null)
            }
            let did = el.getAttribute("data-thumb-did");
            let sectionId = el.getAttribute("data-thumb-section-id");
            if (did in this.thumbsByDid) {
                let thumb = this.thumbsByDid[did];
                thumb.$els = thumb.$els.add(el);
                if (thumb.state == ThumbState.LOADED && thumb.objectUrl) {
                    $(el).attr("src", thumb.objectUrl).attr("data-thumb-state", ThumbState.LOADED);
                    this.emitThumbLoaded($(el));
                }
                else {
                    $(el).attr("data-thumb-state", ThumbState.LOADING);
                }
            }
            else {
                this.thumbsByDid[did] = {
                    did: did,
                    sectionId: sectionId,
                    state: ThumbState.UNINITIALIZED,
                    $els: $(el),
                    objectUrl: null,
                };
                this.initializeThumb(did);
            }
        });
    }
    
    getThumb(did: string): Thumb {
        return this.thumbsByDid[did];
    }
    
    initializeThumb(did: string): void {
        let thumb = this.getThumb(did);
        if (!thumb || thumb.state != ThumbState.UNINITIALIZED) {
            return;
        }
        return this._initializeThumb(thumb);
    }
    
    setThumbImage(did: string, data: Types.app.BlobData, refreshing: boolean = false): void {
        let thumb = this.getThumb(did);
        if (!thumb || (!refreshing && thumb.state != ThumbState.LOADING)) {
            return;
        }
        return this._setThumbImage(thumb, data, refreshing);
    }
    
    removeThumb(did: string): void {
        let thumb = this.getThumb(did);
        if (!thumb || thumb.state == ThumbState.REMOVED) {
            return;
        }
        return this._removeThumb(thumb);
    }
    
    inElementInContainerViewportY($el: JQuery, containerTop: number, containerHeight: number): boolean {
        let containerBottom = containerTop + containerHeight;
        let elementRect = $el[0].getBoundingClientRect();
        let elementTop = elementRect.top;
        let elementBottom = elementTop + elementRect.height;
        if (elementBottom < containerTop || elementTop > containerBottom) {
            return false;
        }
        return true;
    }
    
    protected _setThumbState(thumb: Thumb, state: ThumbState): void {
        thumb.state = state;
        thumb.$els.attr("data-thumb-state", state);
    }
    
    protected _initializeThumb(thumb: Thumb): void {
        this.triggerEvent("requestThumbImage", thumb.did, thumb.sectionId);
        this._setThumbState(thumb, ThumbState.LOADING);
    }
    
    protected _setThumbImage(thumb: Thumb, data: Types.app.BlobData, refreshing: boolean = false): void {
        thumb.objectUrl = WebUtils.createObjectURL(data);
        thumb.$els.filter(`[data-thumb-state=${ThumbState.LOADING}]` + (refreshing ? `, [data-thumb-state=${ThumbState.LOADED}]` : "")).each((_, el) => {
            el.onload = () => {
                el.onload = undefined;
                this.emitThumbLoaded($(el));
            };
            $(el).attr("src", thumb.objectUrl);
        });
        this._setThumbState(thumb, ThumbState.LOADED);
    }
    
    protected _removeThumb(thumb: Thumb): void {
        thumb.state = ThumbState.REMOVED;
        thumb.$els.each((_, el) => {
            let $el = $(el);
            let doEmit = $el.attr("data-thumb-state") != ThumbState.REMOVED;
            let src = $el.attr("src");
            if ($el.data("thumb-in-place")) {
                if (!src || src == thumb.objectUrl) {
                    $el.attr("src", "");
                }
                $el.attr("data-thumb-state", ThumbState.REMOVED);
            }
            else {
                $el.remove();
            }
            
            if (doEmit) {
                this.emitThumbRemoved($el);
            }
        });
        delete this.thumbsByDid[thumb.did];
    }
    
    protected emitThumbLoaded($thumb: JQuery): void {
        this.dispatchEvent<ThumbLoadedEvent>({
            type: "thumbLoaded",
            $thumb: $thumb,
        });
    }
    
    protected emitThumbRemoved($thumb: JQuery): void {
        this.dispatchEvent<ThumbLoadedEvent>({
            type: "thumbLoaded",
            $thumb: $thumb,
        });
    }
    
}
