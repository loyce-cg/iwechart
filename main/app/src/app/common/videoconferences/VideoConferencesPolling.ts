import { session } from "../../../mail";
import { Types } from "../../../build/core";
import { VideoConferencesService } from "./VideoConferencesService";
import { ConferenceData } from "../../../mail/videoconferences/VideoConferencesServiceApi";
import * as Q from "q";

interface VideoConferencesPollingInfo {
    session: session.Session;
    timeoutId: number;
}

export interface VideoConferencesPollingResult {
    hostHash: string;
    conferencesData: ConferenceData[];
}

export class VideoConferencesPolling {
    
    static readonly POLLING_MODE: "interval" | "ws" = "ws";
    static readonly POLLING_INTERVAL = 10 * 1000;
    
    protected pollings: { [hostHash: string]: VideoConferencesPollingInfo } = {};
    recentPollingResults: { [hostHash: string]: VideoConferencesPollingResult } = {};
    
    constructor(public videoConferencesService: VideoConferencesService) {
        
    }
    
    clear(): void {
        for (let hostHash of Object.keys(this.pollings)) {
            this.stop(this.pollings[hostHash].session);
        }
        this.pollings = {};
        this.recentPollingResults = {};
    }
    
    start(session: session.Session): boolean {
        if (session.hostHash in this.pollings) {
            return false;
        }
        this.pollings[session.hostHash] = {
            session: session,
            timeoutId: null,
        };
        this._poll(session);
        return true;
    }
    
    stop(session: session.Session): void {
        if (!(session.hostHash in this.pollings)) {
            return;
        }
        let timeoutId = this.pollings[session.hostHash].timeoutId;
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        delete this.pollings[session.hostHash];
    }
    
    pollNow(session: session.Session): Q.Promise<void> {
        if (!(session.hostHash in this.pollings)) {
            return;
        }
        let timeoutId = this.pollings[session.hostHash].timeoutId;
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        return this._poll(session);
    }
    
    update(session: session.Session, sectionId: string, users: string[]): void {
        if (this.recentPollingResults[session.hostHash] && this.recentPollingResults[session.hostHash].conferencesData) {
            let data = this.recentPollingResults[session.hostHash].conferencesData.filter(x => x.sectionId == sectionId);
            if (data.length == 1) {
                if (users && users.length > 0) {
                    data[0].users = users;
                }
                else {
                    let idx = this.recentPollingResults[session.hostHash].conferencesData.indexOf(data[0]);
                    if (idx >= 0) {
                        this.recentPollingResults[session.hostHash].conferencesData.splice(idx, 1);
                    }
                }
                this._emitResultEvent(session);
                return;
            }
        }
        this.pollNow(session);
    }
    
    protected _poll(session: session.Session): Q.Promise<void> {
        if (!(session.hostHash in this.pollings)) {
            return;
        }
        return Q().then(() => {
            return this.videoConferencesService.getApi(session).getVideoRoomsState();
        })
        .then(conferencesData => {
            conferencesData = conferencesData.filter(x => x.users && x.users.length > 0);
            this.recentPollingResults[session.hostHash] = {
                hostHash: session.hostHash,
                conferencesData: conferencesData,
            };
            this._emitResultEvent(session);
        })
        .fin(() => {
            if (VideoConferencesPolling.POLLING_MODE == "interval") {
                this.pollings[session.hostHash].timeoutId = <any>setTimeout(() => {
                    this._poll(session);
                }, VideoConferencesPolling.POLLING_INTERVAL);
            }
            else {
                this.pollings[session.hostHash].timeoutId = null;
            }
        });
    }
    
    protected _emitResultEvent(session: session.Session): void {
        this.videoConferencesService.app.dispatchEvent<Types.event.GotVideoConferencesPollingResultEvent>({
            type: "got-video-conferences-polling-result",
            hostHash: session.hostHash,
            result: this.recentPollingResults[session.hostHash],
        });
    }
    
}
