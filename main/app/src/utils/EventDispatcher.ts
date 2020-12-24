import * as RootLogger from "simplito-logger";
import * as Types from "../Types";
let Logger = RootLogger.get("privfs-mail-client.utils.EventDispatcher");

export class BatchListener<T extends Types.event.Event = Types.event.Event> {
    
    listener: Types.event.EventsListener<T>;
    events: T[];
    constructor(listener: Types.event.EventsListener<T>) {
        this.listener = listener;
    }
    
    static create<T extends Types.event.Event>(listener: Types.event.EventsListener<T>): Types.event.EventListener<T> {
        let batch = new BatchListener(listener);
        return batch.onEvent.bind(batch);
    }
    
    onEvent(event: T) {
        if (event.type == "batchstart") {
            if (this.events == null) {
                this.events = [];
            }
        }
        else if (event.type == "batchend") {
            if (this.events != null) {
                let events = this.events;
                try {
                    this.listener(events);
                }
                catch (e) {
                    Logger.error({
                        message: "Uncaught exception during dispatching batched events",
                        batchListener: this,
                        eventListener: this.listener,
                        events: events,
                        cause: e
                    });
                }
                this.events = null;
            }
        }
        else {
            if (this.events == null) {
                try {
                    this.listener([event]);
                }
                catch (e) {
                    Logger.error({
                        message: "Uncaught exception during dispatching event",
                        batchListener: this,
                        eventListener: this.listener,
                        event: event,
                        cause: e
                    });
                }
            }
            else {
                this.events.push(event);
            }
        }
    }
}

export class EventDispatcherSimple {
    
    eventListeners: Types.event.EventListener<Types.event.Event>[];
    
    constructor() {
        this.eventListeners = [];
    }
    
    addEventListener<T extends Types.event.Event = Types.event.Event>(eventListener: Types.event.EventListener<T>) {
        this.eventListeners.push(eventListener);
    }
    
    removeEventListener<T extends Types.event.Event = Types.event.Event>(eventListener: Types.event.EventListener<T>) {
        let index = this.eventListeners.indexOf(eventListener);
        if (index != -1) {
            this.eventListeners.splice(index, 1);
        }
    }
    
    dispatchEvent<T extends Types.event.Event>(event: T) {
        this.eventListeners.forEach(eventListener => {
            try {
                eventListener(event);
            }
            catch (e) {
                Logger.error({
                    message: "Uncaught exception during dispatching event",
                    eventListener: eventListener,
                    event: event,
                    cause: e
                });
            }
        });
    }
}

export type EventLifeTime = "normal" | "ethernal";
export interface EventListenerObject {
    listener: Types.event.EventListener<Types.event.Event>;
    referrer: string;
    lifeTime?: EventLifeTime
}

export class EventDispatcher {
    
    eventListeners: {[type: string]: EventListenerObject[]};
    parent: EventDispatcher;
    bubbleEventsToParent: boolean;

    constructor(parent?: EventDispatcher) {
        this.parent = parent;
        this.eventListeners = {};
        this.bubbleEventsToParent = true;
    }
    
    addEventListener<T extends Types.event.Event = Types.event.Event>(type: string, eventListener: Types.event.EventListener<T>, referrer?: string, lifeTime?: EventLifeTime) {
        if (!(type in this.eventListeners)) {
            this.eventListeners[type] = [];
        }
        this.eventListeners[type].push({listener: eventListener, referrer: referrer, lifeTime: lifeTime});
    }
    
    removeEventListener<T extends Types.event.Event = Types.event.Event>(type: string, eventListener: Types.event.EventListener<T>, referrer?: string) {
        if (!(type in this.eventListeners)) {
            return;
        }
        let index = this.eventListeners[type].indexOf({listener: eventListener, referrer: referrer});
        if (index != -1) {
            this.eventListeners[type].splice(index, 1);
        }
    }
    
    getRegisteredListenersCount(): number {
        let count: number = 0;
        for (let type in this.eventListeners) {
            count += this.eventListeners[type].length;
        }
        return count;
    }
    
    removeEventListenerByReferrer(referrer: string): void {
        let removed: number = 0;
        for (let type in this.eventListeners) {
            let typeListeners = this.eventListeners[type];
            let filteredList = typeListeners.filter(obj => obj.referrer != referrer);
            removed += Math.abs(typeListeners.length - filteredList.length);
            this.eventListeners[type] = filteredList;
        }
    }

    removeListenersOnLogout(): void {
        let removed: number = 0;
        for (let type in this.eventListeners) {
            let typeListeners = this.eventListeners[type];
            let filteredList = typeListeners.filter(obj => obj.lifeTime == "ethernal" && obj.referrer != null);
            removed += Math.abs(typeListeners.length - filteredList.length);
            this.eventListeners[type] = filteredList;
        }
        // console.log("removed on logout", removed);
        // console.log("left listeners: ", this.getRegisteredListenersCount());
    }

    
    dispatchEventToListener<T extends Types.event.Event>(event: T, eventListener: Types.event.EventListener<T>) {
        try {
            eventListener(event);
        }
        catch (e) {
            Logger.error({
                message: "Uncaught exception during dispatching event",
                eventListener: eventListener,
                event: event,
                cause: e
            });
        }
    }
    
    dispatchEvent<T extends Types.event.Event>(event: T) {
        if (event.type in this.eventListeners) {
            this.eventListeners[event.type].forEach(eventListenerObject => {
                this.dispatchEventToListener(event, eventListenerObject.listener);
            });
        }
        if ("*" in this.eventListeners) {
            this.eventListeners["*"].forEach(eventListenerObject => {
                this.dispatchEventToListener(event, eventListenerObject.listener);
            });
        }
        if (this.parent != null && this.bubbleEventsToParent && event.bubbleable !== false) {
            this.parent.dispatchEvent(event);
        }
    }
    
    dispatchEventResult<T = any>(event: Types.event.Event<T>): T {
        if (event.type in this.eventListeners) {
            let listenersObjs = this.eventListeners[event.type];
            for (let i = 0; i < listenersObjs.length; i++) {
                this.dispatchEventToListener(event, listenersObjs[i].listener);
                if ("result" in event) {
                    return event.result;
                }
            }
        }
        if ("*" in this.eventListeners) {
            let listenersObjs = this.eventListeners["*"];
            for (let i = 0; i < listenersObjs.length; i++) {
                this.dispatchEventToListener(event, listenersObjs[i].listener);
                if ("result" in event) {
                    return event.result;
                }
            }
        }
        if (this.parent != null && this.bubbleEventsToParent && event.bubbleable !== false) {
            return this.parent.dispatchEventResult(event);
        }
    }
    
    dispatchEventGather<T = any>(event: Types.event.Event<T>): T[] {
        let result: T[] = [];
        if (event.type in this.eventListeners) {
            this.eventListeners[event.type].forEach(eventListenerObj => {
                event.result = null;
                this.dispatchEventToListener(event, eventListenerObj.listener);
                result.push(event.result);
            });
        }
        if ("*" in this.eventListeners) {
            this.eventListeners["*"].forEach(eventListenerObj => {
                event.result = null;
                this.dispatchEventToListener(event, eventListenerObj.listener);
                result.push(event.result);
            });
        }
        if (this.parent != null && this.bubbleEventsToParent && event.bubbleable !== false) {
            let parentResult = this.parent.dispatchEventGather(event);
            result = result.concat(parentResult);
        }
        return result;
    }
}