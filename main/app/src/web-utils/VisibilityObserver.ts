export class VisibilityObserver {
    
    private intersectionObserver: IntersectionObserver | null = null;
    private isVisible: boolean = false;
    private callbacks: ((isVisible: boolean) => void)[] = [];
    private singleShotCallbacks: ((isVisible: boolean) => void)[] = [];
    
    get isTargetVisible(): boolean {
        return this.isVisible;
    }
    
    constructor(private target: HTMLElement) {
        this.intersectionObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    const newIsVisible = entry.intersectionRatio > 0;
                    if (newIsVisible && !this.isVisible) {
                        this.afterShown();
                    }
                    else if (!newIsVisible && this.isVisible) {
                        this.afterHidden();
                    }
                });
            },
            {
                root: null,
            },
        );
        this.intersectionObserver.observe(this.target);
    }
    
    addCallback(callback: (isVisible: boolean) => void): void {
        this.callbacks.push(callback)
    }
    
    addSingleShotCallback(callback: (isVisible: boolean) => void): void {
        this.singleShotCallbacks.push(callback)
    }
    
    destroy(): void {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
        this.target = null;
    }
    
    private afterShown(): void {
        this.isVisible = true;
        this.callCallbacks();
    }
    
    private afterHidden(): void {
        this.isVisible = false;
        this.callCallbacks();
    }
    
    private callCallbacks(): void {
        for (let callback of this.callbacks) {
            callback(this.isVisible);
        }
        for (let callback of this.singleShotCallbacks) {
            callback(this.isVisible);
        }
        this.singleShotCallbacks = [];
    }
    
}
