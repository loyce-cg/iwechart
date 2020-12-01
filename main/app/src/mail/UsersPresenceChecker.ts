import { CommonApplication } from "../app/common/CommonApplication";
import {event} from "../Types";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import { Session } from "./session/SessionManager";

let Logger = RootLogger.get("privfs-mail-client.mail.UsersPresenceChecker");

export class UsersPresenceChecker {
    static readonly ERROR_MSG = "Cannot start periodic checker when not logged in.";
    static readonly PERIODIC_CHECK_DELAY: number = 60 * 1000;
    periodicCheckerTimer: NodeJS.Timer;

    constructor (public app: CommonApplication) {
        this._registerUsersPresenceUpdateListener();
    }

    _registerUsersPresenceUpdateListener(): void {
        this.app.addEventListener<event.RefreshUsersPresence>("refresh-users-presence", _e => {
            this.refreshUsersPresence();
        }, "main", "ethernal");
    }

    refreshUsersPresence(): Q.Promise<void> {
        return Q().then(() => {
            for (let hostHash in this.app.sessionManager.sessions) {
                this.refreshForSessionGiven(this.app.sessionManager.getSessionByHostHash(hostHash));
            }
        })
    }
    
    refreshForSessionGiven(session: Session): Q.Promise<void> {
        return Q().then(() => {
            if (session.conv2Service.contactService) {
                Logger.info("refresh users presence");
                return session.conv2Service.contactService.utilApi.getUsernamesEx()
                .then(users => {
                    session.conv2Service.personService.updateExtraInfos(users);
                });
            }
        });
    }
    
    start(): void {
        if (! this.app.mailClientApi) {
            throw new Error(UsersPresenceChecker.ERROR_MSG);
        }
        this.resetPeriodicChecks();
        this.periodicCheckerTimer = setInterval(() => this.refreshUsersPresence(), UsersPresenceChecker.PERIODIC_CHECK_DELAY);
    }

    resetPeriodicChecks(): void {
        if (this.periodicCheckerTimer) {
            clearInterval(this.periodicCheckerTimer);
            this.periodicCheckerTimer = null;
        }
    }

    stop(): void {
        this.resetPeriodicChecks();
    }
}