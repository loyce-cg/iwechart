import {Exception} from "privmx-exception";

export class DemoException extends Exception {
    
    static codes: {[name: string]: {code: number, message: string}} = {
        HASHMAIL_NOT_SUPPORTED: {
            code: 0x3001,
            message: "Hashmail is not supported"
        },
        MAX_FILE_SIZE_EXCEEDED: {
            code: 0x3002,
            message: "Max file size exceeded"
        }
    };
    
    errorName: string;
    errorObject: {code: number, message: string};
    
    constructor(errorName: string, data?: any, message?: string) {
        super(message || (errorName in DemoException.codes ? DemoException.codes[errorName].message : null), data);
        this.errorName = errorName;
        this.errorObject = DemoException.codes[errorName];
    }
    
    static is(e: any, name: string): boolean {
        return e instanceof DemoException && e.errorName == name;
    }
}
