import * as Sentry from "@sentry/electron";
import { NonReportableError } from "../../../utils/error/NonReportableError";

export class SentryService {
    private static readonly DSN: string = "=== your sentry endpoint url ===";
    public static readonly SENTRY_WINDOW_NAME: string = "sentry-error";
    private static filteredErrorsTimestamps: {[id: number]: boolean} = {};
    private static enabled: boolean = false;


    private static accumulatedErrors: Sentry.Event[] = [];

    private static errorsExcludedFromReporting: string[] = [
        "connection broken".toLocaleLowerCase(),
        "Different M1".toLocaleLowerCase(),
        "Error during polling Kvdb".toLocaleLowerCase(),
        "wrong ticket".toLocaleLowerCase(),
        "no tickets".toLocaleLowerCase(),
        "descriptor already in cache".toLocaleLowerCase(),
        "Poll was interrupted".toLocaleLowerCase(),
        "AjaxChannel error".toLocaleLowerCase(),
        "WebsocketChannel closed".toLocaleLowerCase(),
        "ErrorWindowController".toLocaleLowerCase(),
        "WebSocketChannel closed".toLocaleLowerCase(),
        "WebSocketChannel error".toLocaleLowerCase(),
        "Wrong response status: 502".toLocaleLowerCase(),
        "ResizeObserver loop limit exceeded".toLocaleLowerCase(),
        NonReportableError.MARK.toLocaleLowerCase()
    ];

    private static getWindowResultFunc: (error: Sentry.Event) => Promise<boolean>;
    private static isWindowOpenedFunc: (windowName: string) => boolean;
    
    public static initSentry(devMode: boolean, isErrorLoggingEnabled: boolean): void {
        Sentry.init({
            dsn: SentryService.DSN,
            environment: devMode ? "dev" : "production",
            
            beforeBreadcrumb: (crumb: Sentry.Breadcrumb, hint: any) => {
                if (! SentryService.enabled) {
                    return null;
                }
                if ((crumb.level != "error" && crumb.level != "warning") || SentryService.timestampExists(crumb.timestamp)) {
                    return null;
                }
                return crumb;
            },
            
            beforeSend: async (event) => {
                if (! SentryService.enabled) {
                    return null;
                }

                const eventToReport = SentryService.filterBreadcrumbs(event);
                if (! SentryService.hasErrorMessage(eventToReport)) {
                    return null;
                }
                else
                if (SentryService.filterError(eventToReport)) {
                    SentryService.addTimestampOfReport(event);
                    return null;
                }
                else
                if (typeof SentryService.getWindowResultFunc !== "function") {
                    if (isErrorLoggingEnabled) {
                        SentryService.addTimestampOfReport(eventToReport);
                        return eventToReport;
                    }
                    return null;
                }
                else {
                    // check for window
                    let isOpened = SentryService.isWindowOpenedFunc(SentryService.SENTRY_WINDOW_NAME);
                    if (isOpened) {
                        SentryService.addAccumulatedError(eventToReport);
                        return null;
                    }

                    let result = await SentryService.getWindowResultFunc(eventToReport);
                    if (result) {
                        SentryService.addTimestampOfReport(eventToReport);
                        if (SentryService.hasAccumulatedErrors()) {
                            eventToReport.extra = {followingErrors: SentryService.getAllAccumulatedErrors()};
                            SentryService.clearAccumulatedErrors();
                        }
                        return eventToReport;
                    }
                    SentryService.clearAccumulatedErrors();
                    return null;
                }
            }
        });
    }

    public static setEnabled(enabled: boolean): void {
        SentryService.enabled = enabled;
    }

    private static addAccumulatedError(err: Sentry.Event): void {
        SentryService.accumulatedErrors.push(err);
    }

    private static getAllAccumulatedErrors(): Sentry.Event[] {
        let copy: Sentry.Event[] = [];
        for (let err of SentryService.accumulatedErrors) {
            copy.push(Object.assign({}, err));
        }
        return copy;
    }

    private static clearAccumulatedErrors(): void {
        SentryService.accumulatedErrors = [];
    }

    private static hasAccumulatedErrors(): boolean {
        return SentryService.accumulatedErrors.length > 0;
    }

    public static registerWindowFunction(openFunction: () => Promise<boolean>, checkIfOpenFunction: (windowName: string) => boolean) {
        SentryService.getWindowResultFunc = openFunction;
        SentryService.isWindowOpenedFunc = checkIfOpenFunction;
    }

    public static captureException(args: any): void {
        Sentry.captureException(args);
    }

    private static filterError(event: Sentry.Event): boolean {
        if (event && event.breadcrumbs) {
            const filtered = SentryService.filterBreadcrumbs(event);
            const messages = filtered.breadcrumbs.map(x => x.message).join();
            const messagesLowerCase = messages.toLocaleLowerCase();

            for (let errorDescription of SentryService.errorsExcludedFromReporting) {
                if (messagesLowerCase.includes(errorDescription)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static filterBreadcrumbs(event: Sentry.Event): Sentry.Event {
        let ret = Object.assign({}, event);
        if (ret.breadcrumbs) {
            ret.breadcrumbs = ret.breadcrumbs.filter(x => ! SentryService.timestampExists(x.timestamp));
        }
        return ret;
    }
    private static hasErrorMessage(event: Sentry.Event): boolean {
        if (event.breadcrumbs) {
            return event.breadcrumbs.filter(x => x.level == "error" || x.level == "warning").length > 0;
        }
        return false;
    }

    private static addTimestampOfReport(event: Sentry.Event): void {
        for (let crumb of event.breadcrumbs) {
            if (crumb.timestamp) {
                SentryService.filteredErrorsTimestamps[crumb.timestamp] = true;
            }
        }
    }

    private static timestampExists(timestamp: number): boolean {
        return timestamp in SentryService.filteredErrorsTimestamps;
    }
}
