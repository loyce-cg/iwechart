export type MindmapRendererSchedulerRenderFunction = () => void;
export type MindmapRendererSchedulerCanRenderFunction = () => boolean;

export interface MindmapRendererSchedulerOptions {
    renderFunction: MindmapRendererSchedulerRenderFunction;
    canRenderFunction: MindmapRendererSchedulerCanRenderFunction;
    maxNumberOfAttempts: number;
    delayBetweenAttempts: number;
}

export class MindmapRendererScheduler {
    private timeoutId: number = null;
    
    constructor(private options: MindmapRendererSchedulerOptions) {
    }
    
    schedule(): void {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.tryRender();
    }
    
    private tryRender(attemptId: number = 1): void {
        if (attemptId > this.options.maxNumberOfAttempts) {
            return;
        }
        if (this.options.canRenderFunction()) {
            this.options.renderFunction();
            return;
        }
        this.timeoutId = <any>setTimeout(() => {
            this.tryRender(attemptId + 1);
        }, this.options.delayBetweenAttempts);
    }
}
