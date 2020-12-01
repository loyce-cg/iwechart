export class PluginManager {
    
    plugins: {[name: string]: any};
    
    constructor() {
        this.plugins = {};
    }
    
    registerPlugin(name: string, obj: any): void {
        this.plugins[name] = obj;
    }
}

export let Instance: PluginManager;