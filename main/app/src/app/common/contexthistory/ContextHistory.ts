import { Context, ICreatorContext, IContext, ContextType } from "./Context";
import { Session } from "../../../mail/session/SessionManager";
import { CommonApplication } from "..";

export interface NewContextAddedToHistoryEvent {
    type: "new-context-added-to-history";
    context: IContext;
}
export interface ContextHistoryChangeEvent {
    type: "context-history-change";
}

export class ContextHistory {
    private list: IContext[] = [];
    private currentIndex: number;

    constructor(public app: CommonApplication) {}

    public getNext(): IContext | never {
        if (! this._hasNext()) {
            throw new Error("There is no next item in context history");
        }
        this.currentIndex++;
        return this._getCurrent();
    }

    public getPrev(): IContext | never {
        if (! this._hasPrev()) {
            throw new Error("There is no prev item in context history");
        }
        this.currentIndex--;
        return this._getCurrent();
    }

    public getCurrent(): IContext {
        return this._getCurrent();
    }

    public setCurrentFromHistory(context: IContext): void {
        if (context == null) {
            return;
        }
        for (let i = 0; i < this.list.length; i++) {
            const item = this.list[i];
            if (item && item.historyKey && context && context.historyKey && item.historyKey == context.historyKey) {
                this.currentIndex = Number(context.historyKey);
                break;
            }
        }
    }

    public hasNext(): boolean {
        return this._hasNext();
    }

    public hasPrev(): boolean {
        return this._hasPrev();
    }

    public createStartPoint(): void {
        let context = Context.create({
            moduleName: "apps",
            contextId: null,
            contextType: "path",
            hostHash: null
        })
        this.appendSilent(context);
    }

    public append(context: IContext): void {
        let modifiedContext = this.appendSilent(context);
        if (! modifiedContext) {
            return;
        }
        this.app.dispatchEvent<NewContextAddedToHistoryEvent>({type: "new-context-added-to-history", context: modifiedContext});
        this.dispatchContextHistoryChangeEvent();
    }

    private appendSilent(context: IContext): Context {
        if (this.isCurrentEntrySameAsNew(context)) {
            return;
        }
        this._trimToCurrentIfNotOnLast();
        if (this.isLastEntrySameAsNew(context)) {
            return;
        }

        this.currentIndex = this.list.length;
        let modifiedContext = Context.clone(context);
        modifiedContext.setHistoryKey(this.currentIndex.toString());  
        this.list.push(modifiedContext);
        return modifiedContext;
    }

    public getContextTypeFromSessionAndSinkId(session: Session, sinkId: string): ContextType {
        const isConversation = sinkId.startsWith("c2:");
        let contextType: ContextType;
        
        if (session.sessionType == "remote") {
            contextType = isConversation ? "remote-conversation" : "remote-section";
        }
        else {
            if (sinkId.startsWith("custom:")) {
                contextType = "custom";
            }
            else {
                contextType = isConversation ? "conversation": "section";
            }
        }
        return contextType;
    }

    private isLastEntrySameAsNew(context: IContext): boolean {
        const last = this._getLast();
        if (
            last && last.getModuleName() == context.getModuleName() 
            && last.getContextId() == context.getContextId() 
            && last.getType() == context.getType() 
            && last.getHostHash() == context.getHostHash()
        ) {
            return true;
        }
        return false;
    }

    private isCurrentEntrySameAsNew(context: IContext): boolean {
        const current = this._getCurrent();
        if (
            current && current.getModuleName() == context.getModuleName() 
            && current.getContextId() == context.getContextId() 
            && current.getType() == context.getType() 
            && current.getHostHash() == context.getHostHash()
        ) {
            return true;
        }
        return false;
    }

    private _getCurrent(): IContext {
        return this.list[this.currentIndex];
    }

    private _getLast(): IContext {
        return this.list[this.list.length - 1];
    }

    private _hasNext(): boolean {
        let hasNext = this.currentIndex < this.list.length - 1;
        return hasNext;
    }

    private _hasPrev(): boolean {
        
        let hasPrev = this.currentIndex > 0;
        return hasPrev;
    }

    private _trimToCurrentIfNotOnLast(): void {
        if (this.currentIndex < this.list.length - 1) {
            this.list.splice(this.currentIndex + 1);
        }
    }

    public dispatchContextHistoryChangeEvent(): void {
        this.app.dispatchEvent<ContextHistoryChangeEvent>({type: "context-history-change"});
    }
}
