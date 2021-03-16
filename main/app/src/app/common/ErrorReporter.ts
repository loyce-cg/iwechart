import { CommonApplication } from ".";
import * as Types from "../../Types";
import * as Q from "q";
import fs = require("fs");
import { ErrorReport } from "./ErrorReport";

import * as zlib from "zlib";
import * as nodePath from "path";
import * as stream from "stream";

import * as request from "request";
export class ErrorReporter {
    
    static readonly DEFAULT_ERROR_LOG_TIMESPAN_MS = 60 * 60 * 1000;
    static readonly DEFAULT_ERROR_LOG_MAX_LENGTH_B = 1024 * 1024;
    
    app: CommonApplication;
    
    constructor(app: CommonApplication) {
        this.app = app;
    }
    
    async sendZippedErrorLog(onProgress: (progressMessage: {msg: string, args?: any[]}) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (! fs.existsSync(this.app.errorLogFile)) {
                onProgress({msg: "no-files"});
                return resolve();
            }
            onProgress({msg: "logFile", args: [this.app.errorLogFile]});
            const outZipFile = nodePath.resolve((<any>this.app).profile.absolutePath, "logs/error_log.gz");
            const readableStream = fs.createReadStream(this.app.errorLogFile, {encoding: "utf8"});
            const writableStream = fs.createWriteStream(outZipFile, {encoding: "utf8"});
            const gzip = zlib.createGzip({level: 9});
            
            stream.pipeline(
                readableStream,
                gzip,
                writableStream,
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        onProgress({msg: "compressed"});
                        writableStream.close();
                        readableStream.close();
                        const uploadUrl = "https://repo.privmx.com/upload/";
                        let req = request.post(uploadUrl, (err, resp, body) => {
                            if (err) {
                              reject(err);
                            } else {
                                // clean up
                                fs.unlinkSync(outZipFile);
                                resolve();
                            }
                        });
                        const form = req.form();
                        form.append('file', fs.createReadStream(outZipFile));
                    }
                  }
            )
    
        })
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
        // errorReport.errorLog = this.getErrorLog(error);
        errorReport.systemInformation = this.getSystemInformation(error);
        return errorReport;
    }
    
}