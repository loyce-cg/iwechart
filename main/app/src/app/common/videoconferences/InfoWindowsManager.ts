import { CommonApplication } from "..";
import { PollingItem, session } from "../../../mail";
import { Types } from "../../../build/core";
import { ConferenceData, Options as WindowOptions, VideoConferenceInfoWindowController, WindowType } from "../../../window/videoconferenceinfo/main";

enum WindowState {
    INITIAL = "initial",
    OPENING = "opening",
    OPEN = "open",
    CLOSED = "closed",
}

interface WindowInfo {
    state: WindowState;
    window: VideoConferenceInfoWindowController | null;
    openPromise: Promise<void> | null;
}

export class InfoWindowsManager {
    
    windows: { [hostHash: string]: { [sectionId: string]: WindowInfo } } = {};
    
    constructor(
        public app: CommonApplication,
    ) {
        app.addEventListener<Types.event.SinkPollingResultEvent>("sinkpollingresult", event => {
            event.entries.forEach(async entry => {
                const isStartMessage = this.isVideoConferenceStartMessage(entry);
                const isGongMessage = this.isVideoConferenceGongMessage(entry);
                if (!isStartMessage && !isGongMessage) {
                    return;
                }
                const message = entry.entry.getMessage();
                const session: session.Session = this.app.sessionManager.getSession(entry.entry.host);
                if (!session) {
                    return;
                }
                const identity = session.userData.identity;
                if (message.sender.pub58 == identity.pub58) {
                    return;
                }
                const section = session.sectionManager.getSectionBySinkId(entry.entry.index.sink.id);
                const content = entry.entry.getContentAsJson();
                const conferenceTitle = isStartMessage ? content.conferenceTitle : null;
                const creatorHashmail = message.sender.hashmail;
                const creatorDisplayName = session.conv2Service.contactService.getContactByHashmail(creatorHashmail).getDisplayName();
                const pollingResults = this.app.videoConferencesService.polling.recentPollingResults[session.hostHash];
                const data = {
                    sectionId: section.getId(),
                    startedBy: {
                        hashmail: creatorHashmail,
                        displayName: creatorDisplayName,
                    },
                    conferenceTitle: conferenceTitle,
                };
                if (isGongMessage) {
                    const gongMessage = content.message ? content.message : null;
                    this.tryShowVideoConferenceGongWindow(session, data, gongMessage);
                }
                else {
                    let conferenceData = pollingResults ? pollingResults.conferencesData.find(conferenceData => conferenceData.sectionId == section.getId()) : null;
                    if (!conferenceData) {
                        await new Promise<void>(resolve => {
                            setTimeout(() => {
                                resolve();
                            }, 1000);
                        })
                        conferenceData = pollingResults ? pollingResults.conferencesData.find(conferenceData => conferenceData.sectionId == section.getId()) : null;
                    }
                    if (conferenceData) {
                        this.tryShowVideoConferenceStartWindow(session, data);
                    }
                }
            })
        }, "main", "ethernal");
        app.addEventListener<Types.event.GotVideoConferencesPollingResultEvent>("got-video-conferences-polling-result", event => {
            const session = this.app.sessionManager.getSessionByHostHash(event.result.hostHash);
            if (session.hostHash in this.windows) {
                for (let sectionId in this.windows[session.hostHash]) {
                    const conferenceData = event.result.conferencesData.find(conferenceData => conferenceData.sectionId == sectionId);
                    if (!conferenceData || conferenceData.users.indexOf(session.userData.identity.hashmail) > 0) {
                        this.tryCloseWindow(session, sectionId).then(() => {
                            this._removeWindowIfConferenceEnded(session, sectionId);
                        });
                    }
                }
            }
        }, "main", "ethernal");
    }
    
    isVideoConferenceStartMessage(pollingItem: PollingItem): boolean {
        if (pollingItem.entry.source.data.contentType != "application/json") {
            return false;
        }
        let content = pollingItem.entry.getContentAsJson();
        return content && content.type == "video-conference-start";
    }
    
    isVideoConferenceGongMessage(pollingItem: PollingItem): boolean {
        if (pollingItem.entry.source.data.contentType != "application/json") {
            return false;
        }
        let content = pollingItem.entry.getContentAsJson();
        return content && content.type == "video-conference-gong";
    }
    
    async tryShowVideoConferenceStartWindow(session: session.Session, conferenceData: ConferenceData): Promise<void> {
        let windowInfo = this.getOrCreateWindowInfo(session, conferenceData.sectionId);
        if (windowInfo.state != WindowState.INITIAL) {
            return;
        }
        windowInfo.state = WindowState.OPENING;
        windowInfo.openPromise = new Promise<void>(async (resolve) => {
            const window = await this.app.ioc.create(VideoConferenceInfoWindowController, [this.app, this.getWindowOptions(session, WindowType.VIDEO_CONFERENCE_STARTED, conferenceData)]);
            this.app.openChildWindow(window);
            windowInfo.state = WindowState.OPEN;
            windowInfo.window = window;
            windowInfo.openPromise = null;
            resolve();
        });
        await windowInfo.openPromise;
    }

    async tryShowVideoConferenceGongWindow(session: session.Session, conferenceData: ConferenceData, gongMessage: string): Promise<void> {
        const windowName = `gong-${session.hostHash}-${conferenceData.sectionId}`;
        this.app.openSingletonWindow(windowName, VideoConferenceInfoWindowController, this.getWindowOptions(session, WindowType.GONG, conferenceData, gongMessage));
    }
    
    private getWindowOptions(session: session.Session, windowType: WindowType, conferenceData: ConferenceData, gongMessage?: string): WindowOptions {
        return  {
            session: session,
            sectionId: conferenceData.sectionId,
            startedBy: {
                hashmail: conferenceData.startedBy.hashmail,
                displayName: conferenceData.startedBy.displayName,
            },
            conferenceTitle: conferenceData.conferenceTitle,
            windowType: windowType,
            gongMessage: gongMessage,
        };
    }
    
    async tryCloseWindow(session: session.Session, sectionId: string): Promise<void> {
        let windowInfo = this.getWindowInfo(session, sectionId);
        if (!windowInfo || windowInfo.state == WindowState.CLOSED) {
            return;
        }
        if (windowInfo.state == WindowState.INITIAL) {
            windowInfo.state = WindowState.CLOSED;
        }
        if (windowInfo.state == WindowState.OPENING) {
            await windowInfo.openPromise;
        }
        if (windowInfo.state == WindowState.OPEN) {
            windowInfo.window.close();
        }
    }
    
    async onWindowClosed(session: session.Session, sectionId: string): Promise<void> {
        let windowInfo = this.getWindowInfo(session, sectionId);
        if (!windowInfo) {
            return;
        }
        if (windowInfo.openPromise) {
            await windowInfo.openPromise;
        }
        windowInfo.state = WindowState.CLOSED;
        windowInfo.window = null;
        this._removeWindowIfConferenceEnded(session, sectionId);
    }
    
    private _removeWindowIfConferenceEnded(session: session.Session, sectionId: string): void {
        let windowInfo = this.getWindowInfo(session, sectionId);
        if (!windowInfo) {
            return;
        }
        
        const results = this.app.videoConferencesService.polling.recentPollingResults[session.hostHash];
        const conferenceFound: boolean = results && results.conferencesData.filter(conferenceData => conferenceData.sectionId == sectionId).length > 0;
        if (!conferenceFound) {
            delete this.windows[session.hostHash][sectionId];
            if (Object.keys(this.windows[session.hostHash]).length == 0) {
                delete this.windows[session.hostHash];
            }
        }
    }
    
    getOrCreateWindowInfo(session: session.Session, sectionId: string): WindowInfo {
        if (!(session.hostHash in this.windows)) {
            this.windows[session.hostHash] = {};
        }
        if (!(sectionId in this.windows[session.hostHash])) {
            this.windows[session.hostHash][sectionId] = {
                state: WindowState.INITIAL,
                window: null,
                openPromise: null,
            };
        }
        return this.windows[session.hostHash][sectionId];
    }
    
    getWindowInfo(session: session.Session, sectionId: string): WindowInfo | null {
        if ((session.hostHash in this.windows) && (sectionId in this.windows[session.hostHash])) {
            return this.windows[session.hostHash][sectionId];
        }
        return null;
    }
    
    clear(): void {
        this.windows = {};
    }
    
}
