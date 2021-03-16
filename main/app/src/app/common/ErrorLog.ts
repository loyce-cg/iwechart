import * as RootLoger from "simplito-logger";
import * as privfs from "privfs-client";
import * as Q from "q";
import {CommonApplication} from "./CommonApplication";
import {DemoException} from "../../mail";
import {Formatter, Lang} from "../../utils";
import {LocaleService} from "../../mail/LocaleService";
import {MsgBoxResult} from "../../window/msgbox/MsgBoxWindowController";
export type SimplitoLogger = typeof RootLoger;

export class ErrorLog {
    
    localeService: LocaleService;
    errorCallback: (e: any) => void;
    logErrorCallback: (e: any) => void;
    
    constructor(
        public logger: SimplitoLogger,
        public app: CommonApplication,
        public msgBox: {alert(msg: string): Q.Promise<MsgBoxResult>}
    ) {
        this.localeService = this.app.localeService;
        this.errorCallback = this.onError.bind(this);
        this.logErrorCallback = this.logError.bind(this);
    }
    
    checkConnectionLost(e: any): boolean {
        if (privfs.core.ApiErrorCodes.isConnectionError(e)) {
            this.app.connectionStatusChecker.onConnectionLost();
            return false;
        }
        return true;
    }
    
    prepareErrorMessage(e: any, preFn?: (error: {code: number, message: string}) => {code: number, message: string}): string {
        if (!e) {
            return this.localeService.i18n("core.error.unknwon");
        }
        let error = {
            code: 0,
            message: ""
        };
        if (typeof(preFn) == "function") {
            let preResult = preFn(error);
            if (preResult) {
                return this.localeService.i18n("core.error", [preResult.code, preResult.message]);
            }
        }
        if (privfs.core.ApiErrorCodes.isConnectionError(e)) {
            if (privfs.core.ApiErrorCodes.isError(e)) {
                error.code = e.data.error.code;
            }
            else {
                error.code = 0x5000;
            }
            error.message = this.localeService.i18n("core.error.serverNotResponding");
        }
        else if (privfs.core.ApiErrorCodes.isOrCouse(e, "MAX_COUNT_OF_BLOCKS_EXCEEDED")) {
            error.code = privfs.core.ApiErrorCodes.codes.MAX_COUNT_OF_BLOCKS_EXCEEDED.code;
            error.message = this.localeService.i18n("core.error.maxFileSizeExceeded");
        }
        else if (privfs.core.ApiErrorCodes.isError(e)) {
            error.code = e.data.error.code;
            error.message = e.data.error.message || e.msg;
        }
        else if (DemoException.is(e, "HASHMAIL_NOT_SUPPORTED")) {
            error.code = (<DemoException>e).errorObject.code;
            error.message = this.localeService.i18n("core.demo.hashmailNotSupported", (<DemoException>e).data);
        }
        else if (DemoException.is(e, "MAX_FILE_SIZE_EXCEEDED")) {
            error.code = (<DemoException>e).errorObject.code;
            let limit = this.app.getMaxFileSizeLimit();
            if (limit) {
                let formatter = new Formatter();
                return this.localeService.i18n("core.error.maxFileSizeExceeded.detailed", formatter.bytesSize(limit));
            }
            else {
                return this.localeService.i18n("core.error.maxFileSizeExceeded");
            }
        }
        else {
            if (e.errorObject) {
                error.code = e.errorObject.code;
                error.message = e.errorObject.message;
            }
            else if (e.data && e.data.error) {
                error.code = e.data.error.code;
                error.message = e.data.error.message || e.msg;
            }
            else if (e && typeof(e.message) == "string" && Lang.startsWith(e.message, "Invalid config for host ")) {
                return this.localeService.i18n("core.error.cannotConnect", (<string>e.message).substr("Invalid config for host ".length));
            }
            else if (e && typeof(e.message) == "string" && Lang.startsWith(e.message, "Config not found")) {
                return this.localeService.i18n("core.error.cannotConnect", this.app.getDefaultHost());
            }
            else {
                error.code = 0x5001;
                error.message = e.message || e.msg || e || "";
            }
        }
        return this.localeService.i18n("core.error", [error.code, error.message]);
    }
    
    logError(e: any): void {
        this.logger.error(e, e == null ? null : e.stack);
    }
    
    onError(e: any): Q.IWhenable<any> {
        this.logError(e);
        if (this.checkConnectionLost(e)) {
            this.app.reportToSentry(e);
        }
    }
    
    onErrorCustom(text: string, e: any, noConnectionLostCheck?: boolean): Q.IWhenable<any> {
        this.logError(e);
        if (noConnectionLostCheck || this.checkConnectionLost(e)) {
            this.app.reportToSentry(e);
        }
    }
    
    errorAlert(text: string, e: any): Q.Promise<MsgBoxResult> {
        if (this.checkConnectionLost(e)) {
            return this.msgBox.alert(text);
        }
        return Q({result: "ok"});
    }
}