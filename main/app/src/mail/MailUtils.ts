import {LocaleService} from "./LocaleService";
import * as privfs from "privfs-client";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.mail.MailUtils");

export class MailUtils {
    
    static getMessagePostError(localeService: LocaleService, e: any): {savedToOutbox: boolean, msg: string} {
        let resolveError = (e: any): string => {
            Logger.error("Message post error", e, e.stack);
            if (privfs.core.ApiErrorCodes.isError(e)) {
                if (privfs.core.ApiErrorCodes.is(e, "HOST_BLACKLISTED")) {
                    return localeService.i18n("api.messagePostError.blacklist");
                }
                return localeService.i18n("api.messagePostError.rpc", [e.data.error.code]);
            }
            if (privfs.core.ApiErrorCodes.isConnectionError(e)) {
                if (e.data.status === 0) {
                    return localeService.i18n("api.messagePostError.connection");
                }
                else if (e.data.status == 400 && typeof(e.data.response) == "object") {
                    return e.data.response.msg;
                }
            }
            return localeService.i18n("api.messagePostError.unknown");
        };
        if (e.message == "sendMessageError") {
            let msg = "";
            if (e.data.errors == 0) {
                msg += localeService.i18n("api.messagePostError.validPost");
            }
            if (e.data.info.length == 1) {
                if (e.data.errors > 0) {
                    let info = e.data.info[0];
                    msg = localeService.i18n("api.messagePostError.send", [info.receiver.user, resolveError(info.couse)]);
                }
            }
            else {
                msg = e.data.nooneGetMsg ? localeService.i18n("api.messagePostError.sendMany.noone") : localeService.i18n("api.messagePostError.sendMany.some");
                for (var i in e.data.info) {
                    let info = e.data.info[i];
                    if (!info.success) {
                        msg += "\n" + info.receiver.user + " (" + resolveError(info.couse) + ")";
                    }
                }
            }
            if (e.data.full.outboxError) {
                msg += "\n" + localeService.i18n("api.messagePostError.outboxError");
            }
            return {
                savedToOutbox: !e.data.nooneGetMsg,
                msg: msg
            };
        }
        else {
            return {
                savedToOutbox: false,
                msg: localeService.i18n("api.messagePostError.general", [e])
            };
        }
    }
}