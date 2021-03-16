export class NonReportableError extends Error {
    
    static MARK = "NonReportableError";
    
    constructor(message: string) {
        super("[" + NonReportableError.MARK + "] " + message);
    }
}