export interface SpecLog {
    time: string;
    key: string;
    args: any[];
}


export class SpecLogger {
    
    static logs: SpecLog[] = [];
    
    static init(): void {
        let w: any = window;
        if (w.SpecLogger) {
            return;
        }
        w.SpecLogger = this;
    }
    
    static dump(): void {
        console.log(this.logs);
    }
    
    static log(key: string, ...args: any[]): void {
        this.init();
        let dt = new Date();
        let f = (n: number, l: number) => (<any>n.toString()).padStart(l, "0");
        let time = `${f(dt.getMinutes(), 2)}:${f(dt.getSeconds(), 2)}.${f(dt.getMilliseconds(), 3)}`;
        if (key == "conference.participant_property_changed") {
            key += " / " + args[1] + " / " + args[0]._id;
        }
        if (key == "conference.endpoint_message_received") {
            try {
                key += " / " + args[1].type + " / " + args[0]._id + " / " + JSON.stringify(args[1]);
            }catch{}
        }
        let log: SpecLog = {
            time,
            key,
            args,
        };
        this.logs.push(log);
    }
    
}
