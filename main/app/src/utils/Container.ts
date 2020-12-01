import {EventDispatcher} from "../utils/EventDispatcher";
import {Event as ChangeEvent} from "../utils/Event";
import {Events as ChangeEvents} from "../utils/Events";
import {Lang} from "../utils/Lang";
import * as Types from "../Types";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";

let Logger = RootLogger.get("privfs-mail-client.utils.Container");

export type IComponent = any;

export class Container extends EventDispatcher {
    
    components: {[id: string]: any};
    bindedEvents: {eventDispatcher: EventDispatcher, eventType: string, originalListener: Types.event.EventListener<Types.event.Event>, bindedListener: Types.event.EventListener<Types.event.Event>}[];
    bindedChangeEvents: {bindedHandler: Function, originalHandler: Function, changeEvent: ChangeEvent<any, any, any>;}[];
    bindedNamedChangeEvents: {bindedHandler: Function, originalHandler: Function, eventName: string, events: ChangeEvents}[];
    bindedPmxEvents: {bindedHandler: Function, originalHandler: Function, event: privfs.crypto.utils.Event}[];

    constructor(parent?: EventDispatcher) {
        super(parent);
        this.components = {};
        this.bindedEvents = [];
        this.bindedChangeEvents = [];
        this.bindedNamedChangeEvents = [];
        this.bindedPmxEvents = [];
    }
    
    registerInstance<T>(instance: T): T {
        if (!(<any>instance).__registered)  {
            (<any>instance).__registered = true;
            this.dispatchEvent<Types.event.InstanceRegisteredEvent>({
                type: "instanceregistered",
                target: this,
                instance: <any>instance
            });
        }
        return instance;
    }
    
    getComponent<T extends IComponent = IComponent>(id: string): T {
        return <T>this.components[id];
    }
    
    getComponentId(component: IComponent): string {
        for (let id in this.components) {
            if (this.components[id] == component) {
                return id;
            }
        }
        return null;
    }
    
    addComponent<T extends IComponent>(id: string, component: T): T {
        if (id in this.components) {
            throw new Error("Component with id '" + id + "' already added");
        }
        if ("parent" in component && component.parent != this) {
            Logger.warn({
                message: "Adding component which has not parent property set at me",
                id: id,
                component: component,
                container: this
            });
        }
        this.registerInstance(component);
        
        this.dispatchEvent<Types.event.ContainerEvent>({type: "beforeadd", target: this, id: id, component: component});
        this.components[id] = component;
        this.dispatchEvent<Types.event.ContainerEvent>({type: "afteradd", target: this, id: id, component: component});
        return component;
    }
    
    removeComponent(idOrComponent: string|IComponent, destroy: boolean = true) {
        let id: string;
        let component: IComponent;
        if (typeof(idOrComponent) == "string") {
            id = idOrComponent;
            component = this.components[id];
        }
        else {
            for (let key in this.components) {
                if (this.components[key] == idOrComponent) {
                    id = key;
                    component = idOrComponent;
                    break;
                }
            }
        }
        if (component == null) {
            return;
        }
        this.dispatchEvent<Types.event.ContainerEvent>({type: "beforeremove", target: this, id: id, component: component});
        if (destroy && typeof(component.destroy) == "function") {
            try {
                component.destroy();
            }
            catch (e) {
                Logger.error({
                    message: "Uncaught exception during removing component",
                    id: id,
                    component: component,
                    container: this,
                    cause: e
                });
            }
        }
        delete this.components[id];
        this.dispatchEvent<Types.event.ContainerEvent>({type: "afterremove", target: this, id: id, component: component});
    }
    
    bindEvent<T extends Types.event.Event>(eventDispatcher: EventDispatcher, eventType: string, listener: Types.event.EventListener<T>) {
        let bindedListener = listener.bind(this);
        eventDispatcher.addEventListener(eventType, bindedListener);
        this.bindedEvents.push({
            eventDispatcher: eventDispatcher,
            eventType: eventType,
            originalListener: listener,
            bindedListener: bindedListener
        });
    }
    
    unbindEvent<T extends Types.event.Event>(eventDispatcher: EventDispatcher, eventType: string, listener: Types.event.EventListener<T>) {
        let index = Lang.indexOf(this.bindedEvents, x => x.eventDispatcher == eventDispatcher && x.eventType == eventType && x.originalListener == listener);
        if (index == -1) {
            return;
        }
        eventDispatcher.removeEventListener(eventType, this.bindedEvents[index].bindedListener);
        this.bindedEvents.splice(index, 1);
    }
    
    registerChangeEvent<T = any, U = any, V = any>(changeEvent: ChangeEvent<T, U, V>, handler: Types.utils.EventCallback<T, U, V>, type?: "single"): void
    registerChangeEvent<T = any, U = any, V = any>(changeEvent: ChangeEvent<T, U, V>, handler: Types.utils.EventsCallback<T, U, V>, type?: "multi"): void
    registerChangeEvent<T = any, U = any, V = any>(changeEvent: ChangeEvent<T, U, V>, handler: Function, type?: "single"|"multi"): void {
        let bindedHandler = handler.bind(this);
        changeEvent.add(bindedHandler, <any>type);
        let entry = {
            bindedHandler: bindedHandler,
            originalHandler: handler,
            changeEvent: changeEvent
        };
        this.bindedChangeEvents.push(entry);
    }
    
    unregisterChangeEvent<T = any, U = any, V = any>(changeEvent: ChangeEvent<T, U, V>, handler: Types.utils.EventCallback<T, U, V>, type?: "single"): void
    unregisterChangeEvent<T = any, U = any, V = any>(changeEvent: ChangeEvent<T, U, V>, handler: Types.utils.EventsCallback<T, U, V>, type?: "multi"): void
    unregisterChangeEvent<T = any, U = any, V = any>(changeEvent: ChangeEvent<T, U, V>, handler: Function, type?: "single"|"multi"): void {
        let index = Lang.indexOf(this.bindedChangeEvents, x => x.originalHandler == handler && x.changeEvent == changeEvent);
        if (index == -1) {
            return;
        }
        changeEvent.remove(<any>this.bindedChangeEvents[index].bindedHandler, <any>type);
        this.bindedChangeEvents.splice(index, 1);
    }
    
    registerNamedEvents(events: ChangeEvents, eventName: string, handler: Function, type?: string): void {
        let bindedHandler = handler.bind(this);
        events.on(eventName, bindedHandler, type);
        let entry = {
            bindedHandler: bindedHandler,
            originalHandler: handler,
            eventName: eventName,
            events: events
        };
        this.bindedNamedChangeEvents.push(entry);
    }
    
    unregisterNamedEvents(events: ChangeEvents, eventName: string, handler: Function, type?: string): void {
        let index = Lang.indexOf(this.bindedNamedChangeEvents, x => x.originalHandler == handler && x.events == events && x.eventName == eventName);
        if (index == -1) {
            return;
        }
        events.off(eventName, <any>this.bindedChangeEvents[index].bindedHandler, type);
        this.bindedNamedChangeEvents.splice(index, 1);
    }
    
    registerPmxEvent(event: privfs.crypto.utils.Event, handler: Function): void {
        let bindedHandler = handler.bind(this);
        event.add(bindedHandler);
        let entry = {
            bindedHandler: bindedHandler,
            originalHandler: handler,
            event: event
        };
        this.bindedPmxEvents.push(entry);
    }
    
    unregisterPmxEvent(event: privfs.crypto.utils.Event, handler: Function): void {
        let index = Lang.indexOf(this.bindedPmxEvents, x => x.originalHandler == handler && x.event == event);
        if (index == -1) {
            return;
        }
        event.remove(<any>this.bindedChangeEvents[index].bindedHandler);
        this.bindedPmxEvents.splice(index, 1);
    }
    
    destroy() {
        Object.keys(this.components).forEach(id => {
            this.removeComponent(id);
        });
        this.bindedEvents.forEach(x => {
            x.eventDispatcher.removeEventListener(x.eventType, x.bindedListener);
        });
        this.bindedEvents = [];
        this.bindedChangeEvents.forEach(x => {
            x.changeEvent.remove(<() => void>x.bindedHandler);
        });
        this.bindedChangeEvents = [];
        this.bindedNamedChangeEvents.forEach(x => {
            x.events.off(x.eventName, <() => void>x.bindedHandler);
        });
        this.bindedNamedChangeEvents = [];
        this.bindedPmxEvents.forEach(x => {
            x.event.remove(<() => void>x.bindedHandler);
        });
        this.bindedPmxEvents = [];
    }
}