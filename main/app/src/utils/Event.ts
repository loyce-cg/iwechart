import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.utils.Event");
import {utils} from "../Types";

export class Event<T, U, V> {
    
    locked: boolean;
    lockedEvents: any[];
    callbacks: {
        callback: Function;
        type: string;
        events: any[];
    }[];
    
    constructor () {
        this.locked = false;
        this.lockedEvents = [];
        this.callbacks = [];
    }
    
    add(callback: utils.EventCallback<T, U, V>, type?: "single"): void
    add(callback: utils.EventsCallback<T, U, V>, type?: "multi"): void
    add(callback: utils.EventCallback<T, U, V>|utils.EventsCallback<T, U, V>, type?: string): void {
        type = typeof(type) == "undefined" ? "single" : type;
        if (type != "multi" && type != "single") {
            throw new Error("Invalid type '" + type + "'");
        }
        this.callbacks.push({
            callback: callback,
            type: type,
            events: []
        });
    }
    
    remove(callback: utils.EventCallback<T, U, V>, type?: "single"|"both"): void
    remove(callback: utils.EventsCallback<T, U, V>, type?: "multi"|"both"): void
    remove(callback: utils.EventCallback<T, U, V>|utils.EventsCallback<T, U, V>, type?: string): void {
        type = typeof(type) == "undefined" ? "both" : type;
        for (let i = 0; i < this.callbacks.length; i++) {
            if (this.callbacks[i].callback == callback && (type == "both" || this.callbacks[i].type == type)) {
                this.callbacks.splice(i, 1);
                break;
            }
        }
    }
    
    clear(): void {
        this.callbacks = [];
    }
    
    hold(): void {
        this.locked = true;
    }
    
    release(): void {
        this.locked = false;
        this.callbacks.forEach(x => {
            x.events = x.events.concat(this.lockedEvents);
        });
        this.lockedEvents = [];
        this.flush();
    }
    
    trigger(a1?: T, a2?: U, a3?: V): void {
        let args = arguments;
        if (this.locked) {
            this.lockedEvents.push(args);
        }
        else {
            this.callbacks.forEach(x => {
                x.events.push(args);
            });
            this.flush();
        }
    }
    
    flush(): void {
        if (this.locked) {
            return;
        }
        this.callbacks.forEach(c => {
            if (c.events.length == 0) {
                return;
            }
            if (c.type == "single") {
                while (c.events.length > 0) {
                    let event = c.events.shift();
                    try {
                        c.callback.apply(null, event);
                    }
                    catch (e) {
                        Logger.error(e, e.stack);
                    }
                }
            }
            else if (c.type == "multi") {
                let events = c.events;
                c.events = [];
                try {
                    c.callback.call(null, events);
                }
                catch (e) {
                    Logger.error(e, e.stack);
                }
            }
            else {
                c.events = [];
                Logger.warn("Callback has invalid type '" + c.type + "'");
            }
        });
    }
    
    static applyEvents<T, U, V>(events: [T, U, V][], func: utils.EventCallback<T, U, V>, context?: any): void {
        for (let i = 0; i < events.length; i++) {
            func.apply(context, events[i]);
        }
    }
}

