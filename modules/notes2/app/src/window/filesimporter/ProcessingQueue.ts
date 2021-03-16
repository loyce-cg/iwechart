export interface QueueTask {
//     action: Promise<void>;
//     id: string;
//     aborted: boolean;
}

export class ProcessingQueue {
//     tasksList: QueueTask[] = [];

//     processPromise: Promise<void>;

//     add(id: string, action: Promise<void>): void {
//         const task: QueueTask = {
//             action: action,
//             id: id,
//             aborted: false
//         };

//         if (! this.processPromise) {
//             this.processPromise = this.createQueueObject(action);
//         }
//         else {
//             this.processPromise = this.processPromise.then(() => this.createQueueObject(action));
//         }
//     }

//     abort(id: string): void {
//         for (let task of this.tasksList) {
//             if (task.id == id) {
//                 task.aborted = true;
//             }
//         }
//     }

//     getProcess(): Promise<void> {
//         return this.processPromise;
//     }

//     async createQueueObject(id: string, action: Promise<void>): Promise<void> {
//         console.log("createQueueObject")
//         return new Promise<void>((resolve, reject) => {
//             if (this.isAborted) {
//                 return reject();
//             }
//             else {
//                 return resolve(action);
//             }
//         })
//     }
}