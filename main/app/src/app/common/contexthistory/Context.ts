
export interface ICreatorContext {
    moduleName: string;
    contextType: ContextType;
    contextId: string;
    hostHash: string;
    historyKey?: string;
}

export interface IContext extends ICreatorContext {
    getType(): ContextType;
    getModuleName(): string;
    getContextId(): string;
    getSectionIdFromContextId(): string;
    getHostHash(): string;
    getHistoryKey(): string;
    setHistoryKey(key: string): void;
}

export class Context implements IContext {
    readonly moduleName: string;
    readonly contextType: ContextType;
    readonly contextId: string;
    readonly hostHash: string;
    historyKey: string;

    static create(context: ICreatorContext) {
        return new Context(context);
    }

    private constructor(context: ICreatorContext) {
        this.contextType = context.contextType;
        this.contextId = context.contextId;
        this.hostHash = context.hostHash;
        this.moduleName = context.moduleName;
    }

    static clone(context: IContext) {
        let copy = new Context(context);
        copy.historyKey = context.historyKey;
        return copy;
    }

    getType(): ContextType {
        return this.contextType;
    }
    
    getModuleName(): string {
        return this.moduleName;
    }

    getContextId(): string {
        return this.contextId;
    }

    getSectionIdFromContextId(): string {
        if (this.contextId.includes(":")) {
            return this.contextId.split(":")[1];
        }
        else {
            return this.contextId;
        }
    }

    getHostHash(): string {
        return this.hostHash;
    }

    getHistoryKey(): string {
        return this.historyKey;
    }

    setHistoryKey(key: string): void {
        this.historyKey = key;
    }
}

export type ContextType = "section" | "remote-section" | "conversation" | "remote-conversation" | "private" | "custom" | "path";

