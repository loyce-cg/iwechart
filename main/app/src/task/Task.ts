import * as Q from "q";

export class Task {
    
    id: number;
    name: string;
    data: any;
    finished: boolean;
    startDate: Date;
    createDate: Date;
    currentProgress: any;
    result: boolean;
    resultData: any;
    defered: Q.Deferred<any>;
    
    constructor(id: number, name: string, data: any) {
        this.id = id;
        this.name = name;
        this.data = data;
        this.finished = false;
        this.createDate = new Date();
        this.defered = Q.defer();
    }
    
    getId(): number {
        return this.id;
    }
    
    getName(): string {
        return this.name;
    }
    
    getData(): any {
        return this.data;
    }
    
    getCreateDate(): Date {
        return this.createDate;
    }
    
    getStartDate(): Date {
        return this.startDate;
    }
    
    getCurrentProgress(): any {
        return this.currentProgress;
    }
    
    isFinished(): boolean {
        return this.finished;
    }
    
    getResult(): boolean {
        return this.result;
    }
    
    getResultData(): any {
        return this.resultData;
    }
    
    getPromise(): Q.Promise<void> {
        return this.defered.promise;
    }
}

