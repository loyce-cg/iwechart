import * as childProcess from "child_process";
import * as os from "os";
import * as nodePath from "path";
import {filesimporter} from "../../../Types";
import { RunMessage, StopMessage } from "./FilesBrowserWorker";

export interface WorkerTask {
    onProgress?: (progress: filesimporter.ScanResult) => void;
    dir: string;
    status: WorkerTaskStatus;
}

export type WorkerTaskStatus = "active" | "done" | "pending";

export class TasksExecutor {
    private static readonly EXECUTOR_DELAY: number = 100;
    private tasks: {[id: string]: WorkerTask};
    private tasksExecutorInterval: NodeJS.Timer;

    private process: childProcess.ChildProcess;

    constructor() {
        this.tasks = {};
    }

    public cancelTask(dir: string): void {
        this.removeTaskFromList(dir);
        this.updateTasksChecker();
    }

    public addTask(dir: string, progressListener: (progress: filesimporter.ScanResult) => void): void {
        if (this.taskExists(dir)) {
            return;
        }
        this.addTaskToList(dir, progressListener);
        this.updateTasksChecker();
    }

    private updateTasksChecker(): void {
        if (! this.hasWaitingTasks() && ! this.hasTasksInProgress() && !this.process) {
            clearInterval(this.tasksExecutorInterval);
            this.tasksExecutorInterval = null;
            return;
        }

        if ( ! this.tasksExecutorInterval) {
            this.tasksExecutorInterval = setInterval(() => this.processTasks(), TasksExecutor.EXECUTOR_DELAY);
        }
    }

    private createWorker(): void {
        const scriptPath = nodePath.resolve(__dirname, "FilesBrowserWorker.js");
        this.process = this.createProcess(scriptPath, this.onWorkerMessageCallback.bind(this));            
    }

    private destroyWorker(): void {
        if (!this.process) {
            return;
        }
        this.process.kill();
        this.process = null;
    }

    private onWorkerMessageCallback(callback: filesimporter.ProcessResult): void {
        const activeTask = this.getActiveTask();
        if (! activeTask) {
            return;
        }

        if (activeTask.onProgress && callback.hasError) {
            activeTask.onProgress({
                path: activeTask.dir,
                files: [], 
                err: callback.err, 
                hasError: callback.hasError, 
                finished: true
            });
        }
        else if (activeTask.onProgress && !callback.hasError){
            activeTask.onProgress({
                path: activeTask.dir,
                files: [], 
                err: null, 
                hasError: callback.hasError, 
                finished: true
            });
        }

        this.removeTaskFromList(activeTask.dir);
        this.destroyWorker();        

    }

    private processTasks(): void {
        if (this.hasTasksInProgress()) {
            return;
        }
        if (! this.hasWaitingTasks()) {
            this.updateTasksChecker();
            this.destroyWorker();
            return;
        }

        if (! this.process) {
            this.createWorker()
        }
        this.processNextTask();
    }

    private hasWaitingTasks(): boolean {
        let hasWaiting: boolean = false;
        if (this.tasks) {
            for (let taskId in this.tasks) {
                if (this.tasks[taskId].status == "pending") {
                    hasWaiting = true;
                    break;
                }
            }
        }
        return hasWaiting;
    }

    private hasTasksInProgress(): boolean {
        let inProgress: boolean = false;
        if (this.tasks) {
            for (let taskId in this.tasks) {
                if (this.tasks[taskId].status == "active") {
                    inProgress = true;
                    break;
                }
            }
        }
        return inProgress;
    }

    private getActiveTask(): WorkerTask {
        let activeTaskId: string;
        if (this.tasks) {
            for (let taskId in this.tasks) {
                if (this.tasks[taskId].status == "active") {
                    activeTaskId = taskId;
                    break;
                }
            }
        }
        return activeTaskId ? this.tasks[activeTaskId]: null;
    }


    private processNextTask(): void {
        let nextTaskId: string;
        if (this.tasks) {
            for (let taskId in this.tasks) {
                if (this.tasks[taskId].status == "pending") {
                    nextTaskId = taskId;
                    break;
                }
            }

            if (nextTaskId) {
                const task = this.tasks[nextTaskId];
                task.status = "active";
                const processMessage: RunMessage = new RunMessage(task.dir);
                this.process.send(processMessage);
            }
            else {
                this.destroyWorker();
            }
        }
    }

    private createProcess(dir: string, onProcessMsgCallback: (callback: filesimporter.ProcessResult) => void): childProcess.ChildProcess {
        const process = childProcess.fork(dir);
        os.setPriority(process.pid, (<any>os.constants).priority.PRIORITY_LOW);

        process.on('error', (err) => {
            onProcessMsgCallback({
                err: err, 
                hasError: true
            });
        });

        process.on("message", msg => {
            const workerTask = this.getActiveTask();
            if (workerTask.onProgress) {
                workerTask.onProgress(msg);
            }
        })

        process.on('exit', (code) => {
            if (code > 0) {
                onProcessMsgCallback({
                    err: new Error("exit code " + code),
                    hasError: true
                })
            }
            else {
                onProcessMsgCallback({
                    hasError: false,
                    err: null
                })
            }
        });

        return process;
    }

    private taskExists(dir: string): boolean {
        if (this.tasks && dir in this.tasks) {
            return true;
        }
        return false;
    }

    private addTaskToList(dir: string, progressListener: (progress: filesimporter.ScanResult) => void): void {
        const task: WorkerTask = {
            dir: dir,
            onProgress: progressListener,
            status: "pending"
        };
        this.tasks[dir] = task;
    }

    private removeTaskFromList(dir: string): void {
        if (!(dir in this.tasks)) {
            return;
        }
        const task = this.tasks[dir];
        if (task.status == "active") {
            this.destroyWorker();
        }
        delete this.tasks[dir];       
    }

    private printTasks() {
        for (let taskId in this.tasks) {
            console.log("Task: ", taskId, " on tasks list with status", this.tasks[taskId].status)
        }
    }
}