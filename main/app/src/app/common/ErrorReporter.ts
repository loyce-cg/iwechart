import { CommonApplication } from ".";
import * as Types from "../../Types";
import * as Q from "q";
import fs = require("fs");
import { ErrorReport } from "./ErrorReport";

export class ErrorReporter {
    
    static readonly DEFAULT_ERROR_LOG_TIMESPAN_MS = 60 * 60 * 1000;
    static readonly DEFAULT_ERROR_LOG_MAX_LENGTH_B = 1024 * 1024;
    
    app: CommonApplication;
    
    constructor(app: CommonApplication) {
        this.app = app;
    }
    
    getErrorLog(error: Types.app.Error, timespan: number = null, maxLength: number = null): string {
        if (!timespan) {
            timespan = ErrorReporter.DEFAULT_ERROR_LOG_TIMESPAN_MS;
        }
        if (!maxLength) {
            maxLength = ErrorReporter.DEFAULT_ERROR_LOG_MAX_LENGTH_B;
        }
        // @todo jakiś algo biorący subset error loga, niekoniecznie na parametrach timespan, maxLength
        return fs.readFileSync(this.app.errorLogFile, "utf8");
    }
    
    getSystemInformation(error: Types.app.Error): string {
        // @todo więcej info
        return JSON.stringify({
            os: process.platform,
        });
    }
    
    createReport(error: Types.app.Error): ErrorReport {
        let errorReport = new ErrorReport();
        errorReport.errorData = JSON.stringify(error);
        errorReport.errorLog = this.getErrorLog(error);
        errorReport.systemInformation = this.getSystemInformation(error);
        return errorReport;
    }
    
    send(errorReport: ErrorReport, includeErrorLog: boolean, includeSystemInformation: boolean): Q.Promise<void> {
        return Q()
        .then(() => {
            let data = {
                error: errorReport.errorData,
                errorLog: includeErrorLog ? errorReport.errorLog : false,
                systemInformation: includeSystemInformation ? errorReport.systemInformation : false,
            };
            // @todo wysyłanie
        });
    }
    
}