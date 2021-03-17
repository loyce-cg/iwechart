import { mail, window, Q, component, Types, app } from "pmc-mail";
import { i18n } from "./i18n/index";
import { VideoConferenceConfiguration } from "../../main/videoConference/Types";
import { DesktopPickerController } from "../desktoppicker/DesktopPickerController";
import { ChatComponentFactory, ChatPlugin } from "../../main/ChatPlugin";

export interface Model {
    roomMetadata: app.common.videoconferences.RoomMetadata;
}

export class VideoConferenceController extends window.base.WindowComponentController<window.base.BaseWindowController> {
    
    static textsPrefix: string = "plugin.chat.component.videoconference.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    componentFactory: ChatComponentFactory;
    chatPlugin: ChatPlugin;
    session: mail.session.Session;
    conferenceId: string = null;
    currentSection: mail.section.SectionService = null;
    connected: boolean = false;
    notifications: component.notification.NotificationController;
    desktopPicker: DesktopPickerController;
    talkingWhenMutedNotificationId: number = null;
    resolutionCustomSelect: component.customselect.CustomSelectController;
    
    constructor(parent: window.base.BaseWindowController, public roomMetadata: app.common.videoconferences.RoomMetadata) {
        super(parent);
        this.ipcMode = true;
        this.chatPlugin = this.app.getComponent("chat-plugin");
        this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        this.desktopPicker = this.addComponent("desktopPicker", this.componentFactory.createComponent("desktoppicker", [this]));
        this.resolutionCustomSelect = this.addComponent("resolutionCustomSelect", this.componentFactory.createComponent("customselect", [this, {
            items: [],
            editable: true,
            size: "small",
            noSelectionItem: {
                type: "item",
                icon: null,
                text: this.i18n("window.videorecorder.resolutionCustomSelect.noSelection.text"),
                selected: false,
                value: null,
            },
        }]));
    }
    
    init(): Q.Promise<void> {
        return Q();
    }
    
    getModel(): Model {
        return {
            roomMetadata: this.roomMetadata,
        };
    }
    
    obtainConfiguration(section: mail.section.SectionService, roomMetadata: app.common.videoconferences.RoomMetadata): Q.Promise<VideoConferenceConfiguration> {
        if (!this.session) {
            return Q.reject("VideoConferenceController.obtainConfiguration(): no session");
        }
        
        let hashmail: string = null;
        if (this.session.userData && this.session.userData.identity) {
            hashmail = this.session.userData.identity.hashmail;
        }
        return Q().then(() => {
            return this.app.videoConferencesService.joinConference(this.session, section, data => {
                return this.retrieveFromView("connectAndCreateConference", JSON.stringify(<VideoConferenceConfiguration>{
                    domain: data.domain,
                    appId: null,
                    token: null,
                    
                    hashmail: hashmail,
                    
                    conferenceId: data.roomName,
                    conferencePassword: data.conferencePassword,
                    conferenceEncryptionKey: null,
                    conferenceEncryptionIV: null,
                }), data.tmpUser.username, data.tmpUser.password)
                .then((resultStr: string) => {
                    let result: {
                        status: "ok" | "error" | "cancelled",
                        data?: {
                            key: string,
                            iv: string,
                        }
                    } = JSON.parse(resultStr);
                    if (result.status == "error") {
                        throw "could not connect";
                    }
                    if (result.status == "cancelled") {
                        throw "cancelled by user";
                    }
                    this.connected = result.status == "ok";
                    if (result.status == "ok") {
                        return {
                            encryptionKey: result.data.key,
                            encryptionIV: result.data.iv,
                            roomMetadata: roomMetadata,
                        };
                    }
                    return {
                        encryptionKey: null,
                        encryptionIV: null,
                        roomMetadata: roomMetadata,
                    };
                });
            });
        })
        .then(conference => {
            this.conferenceId = conference.id;
            this.currentSection = section;
            this.updateConferenceMetadata(conference.roomMetadata);
            return {
                domain: conference.jitsiDomain,
                appId: null,
                token: null,
                
                hashmail: hashmail,
                
                conferenceId: conference.id,
                conferencePassword: conference.password,
                conferenceEncryptionKey: conference.encryptionKey,
                conferenceEncryptionIV: conference.encryptionIV,
            };
        });
    }
    
    updateConferenceMetadata(metaData: app.common.videoconferences.RoomMetadata): void {
        this.callViewMethod("updateConferenceMetadata", metaData);
    }
    
    onViewLeaveVideoConference(): void {
        this.connected = false;
        this.app.dispatchEvent<Types.event.LeaveVideoConferenceEvent>({
            type: "leave-video-conference",
        });
        this.app.videoConferencesService.leaveConference(this.session, this.currentSection, this.conferenceId);
        this.conferenceId = null;
        this.currentSection = null;
    }
    
    disconnect(): Q.Promise<void> {
        return this.retrieveFromView("disconnect").thenResolve(null);
    }
    
    connect(session: mail.session.Session, section: mail.section.SectionService, roomMetadata: app.common.videoconferences.RoomMetadata): Q.Promise<void> {
        if (this.connected) {
            return Q();
        }
        this.session = session;
        this.currentSection = section;
        this.showLoadingOverlay();
        return this.obtainConfiguration(section, roomMetadata).then(configuration => {
            if (!this.connected) {
                this.callViewMethod("connect", JSON.stringify(configuration), undefined, undefined);
            }
        })
        .catch(e => {
            console.error("VideoConferenceController.connect() error2:", e);
            throw e;
        });
    }
    
    onViewConnected(): void {
        this.hideLoadingOverlay();
        this.callViewMethod("setVideoFrameSignatureVerificationRatioInverse", this.app.userPreferences.getVideoFrameSignatureVerificationRatioInverse());
    }
    
    onViewConnectCancelled(): void {
        this.hideLoadingOverlay();
        console.log(this.app.videoConferencesService.isUserInAnyConference())
        console.log((<any>this.app.videoConferencesService)._activeConferences)
        this.onViewLeaveVideoConference();
        console.log(this.app.videoConferencesService.isUserInAnyConference())
        console.log((<any>this.app.videoConferencesService)._activeConferences)
        // setInterval(()=> {
        //     console.log(this.app.videoConferencesService.isUserInAnyConference())
        // },300)
    }
    
    onViewUnsupportedBrowser(): void {
        this.parent.app.msgBox.alert(this.i18n("plugin.chat.component.videoconference.error.unsupportedBrowser"));
    }
    
    showLoadingOverlay(): void {
        this.callViewMethod("showLoadingOverlay");
    }
    
    hideLoadingOverlay(): void {
        this.callViewMethod("hideLoadingOverlay");
    }
    
    onViewShowTalkingWhenMutedNotification(): void {
        if (this.talkingWhenMutedNotificationId === null) {
            let text = this.i18n("plugin.chat.component.videoconference.talkingWhenMutedNotification");
            this.talkingWhenMutedNotificationId = this.notifications.showNotification(text, {
                autoHide: false,
                progress: false,
                extraCssClass: "talking-when-muted-notification",
            });
        }
    }
    
    onViewHideTalkingWhenMutedNotification(): void {
        if (this.talkingWhenMutedNotificationId !== null) {
            this.notifications.hideNotification(this.talkingWhenMutedNotificationId);
            this.talkingWhenMutedNotificationId = null;
        }
    }
    
    onViewGong(message: string): void {
        this.chatPlugin.gong(this.session, this.currentSection, message);
    }
    
    onViewSetAlwaysOnTop(alwaysOnTop: boolean): void {
        this.parent.setAlwaysOnTop(!!alwaysOnTop);
    }
    
    onViewSetAvailableResolutions(resolutions: window.videorecorder.VideoResolution[]): void {
        const horizontalResolutions = resolutions.filter(resolution => resolution.width >= resolution.height);
        const verticalResolutions = resolutions.filter(resolution => resolution.width < resolution.height);
        const hasSeparator = horizontalResolutions.length > 0 && verticalResolutions.length > 0;
        const separator: "separator"[] = hasSeparator ? ["separator"] : [];
        const resolutionsWithSeparators: (window.videorecorder.VideoResolution | "separator")[] = [...horizontalResolutions, ...separator, ...verticalResolutions];
        const items: (component.customselect.CustomSelectItem | component.customselect.CustomSelectSeparator)[] = resolutionsWithSeparators.map(resolutionOrSeparator => {
            if (typeof(resolutionOrSeparator) == "string") {
                return <component.customselect.CustomSelectSeparator>{
                    type: "separator",
                };
            }
            else {
                const resolution = resolutionOrSeparator;
                return <component.customselect.CustomSelectItem>{
                    type: "item",
                    icon: null,
                    selected: resolution.isCurrent,
                    text: `${resolution.width} x ${resolution.height}`,
                    value: `${resolution.width}x${resolution.height}`,
                };
            }
        });
        this.resolutionCustomSelect.setItems(items);
    }
    
}
