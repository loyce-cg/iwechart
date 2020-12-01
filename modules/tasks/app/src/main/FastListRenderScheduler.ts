import { FastList } from "./FastList";

export class FastListRenderScheduler {
    
    static readonly MAX_ATTEMPTS = 5;
    static readonly ATTEMPT_DELAY = 25;
    
    fastList: FastList<any>;
    timeout: number = null;
    
    constructor(fastList: FastList<any>) {
        this.fastList = fastList;
    }
    
    scheduleRender(attemptId: number = 1, causedByContainerEvent: boolean = false): void {
        if (this.timeout != null) {
            // Already scheduled
            return;
        }
        
        if (attemptId == 1) {
            // Render immediately on first attempt
            this.fire(attemptId, causedByContainerEvent);
        }
        else if (attemptId <= FastListRenderScheduler.MAX_ATTEMPTS) {
            // Wait before trying again
            this.timeout = <any>setTimeout(() => {
                this.fire(attemptId, causedByContainerEvent);
            }, FastListRenderScheduler.ATTEMPT_DELAY);
        }
        else {
            // Too many attempts, cancel rendering
        }
    }
    
    fire(attemptId: number, causedByContainerEvent: boolean): void {
        this.timeout = null;
        this.fastList._render(attemptId, causedByContainerEvent);
    }
    
}
