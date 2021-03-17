import {ContainerWindowController} from "../../window/container/ContainerWindowController";
import {SettingsWindowController} from "../../window/settings/SettingsWindowController";
import {ComposeWindowController, Options as ComposeWindowOptions} from "../../window/compose/ComposeWindowController";
import {ImageWindowController} from "../../window/image/ImageWindowController";
import {AdminWindowController} from "../../window/admin/AdminWindowController";
import {AboutWindowController} from "../../window/about/AboutWindowController";
import {FontsWindowController} from "../../window/fonts/FontsWindowController";
import {BaseWindowController} from "../../window/base/BaseWindowController";
import {ChangePasswordWindowController} from "../../window/changepassword/ChangePasswordWindowController";
import {VideoWindowController} from "../../window/video/VideoWindowController";
import {MessageWindowController} from "../../window/message/MessageWindowController";
import {DownloadAttachmentWindowController} from "../../window/downloadattachment/DownloadAttachmentWindowController";
import {SwitchVoiceChatConfirmWindowController, Result} from "../../window/switchvoicechatconfirm/SwitchVoiceChatConfirmWindowController";
import {MailClientApi} from "../../mail/MailClientApi";
import {McaFactory} from "../../mail/McaFactory";
import {SinkIndexEntry} from "../../mail/SinkIndexEntry";
import * as privfs from "privfs-client";
import * as Utils from "simplito-utils";
import * as Q from "q";
import {MsgBox} from "./MsgBox";
import {Event} from "../../utils/Event";
import {ConnectionStatusChecker} from "./ConnectionStatusChecker";
import {LocaleService} from "../../mail/LocaleService";
import {Window} from "./window/Window";
import * as Types from "../../Types";
import {app, event, mail, utils} from "../../Types";
import {BrowserDetection} from "../../web-utils/BrowserDetection";
import {plugins} from "./installed-plugins";
import * as RootLogger from "simplito-logger";
import {Model} from "../../utils/Model";
import {AssetsManager} from "./AssetsManager";
import {Container} from "../../utils/Container";
import {Lang} from "../../utils/Lang";
import { ShellRegistry } from "./shell/ShellRegistry";
import {MimeType as MimeTypeTree} from "../../mail/filetree";
import {UrlWindowController} from "../../window/url/UrlWindowController";
import { UnsupportedWindowController } from "../../window/unsupported/UnsupportedWindowController";
import { OpenableAttachment, OpenableElement, SimpleOpenableElement, ApplicationBinding, ShellOpenOptions, ShellOpenAction, ShellUnsupportedError, ShellAppActionOptions, ShellActionType, } from "./shell/ShellTypes";
import { Clipboard, ClipboardData, ClipboardElement } from "./clipboard/Clipboard";
import { ImageEditorWindowController } from "../../window/imageeditor/ImageEditorWindowController";
import { PdfWindowController } from "../../window/pdf/PdfWindowController";
import { OpenedElementsManager } from "./openedelements/OpenedElementsManager";
import { SectionsWindowController } from "../../window/sections/SectionsWindowController";
import { NotificationsWindowController } from "../../window/notifications/NotificationsWindowController";
import { SelectContactsWindowController} from "../../window/selectcontacts/SelectContactsWindowController";
import { Exception } from "privmx-exception";
import { ErrorLog } from "./ErrorLog";
import { BaseWindowManager } from "../BaseWindowManager";
import { IpcHolder } from "../../ipc/IpcHolder";
import { MessageService } from "../../service/MessageService";
import { UserService } from "../../service/UserService";
import { MsgBoxService } from "../../service/MsgBoxService";
import { MailUtils } from "../../mail/MailUtils";
import { IOC, Lifecycle } from "../../mail/IOC";
import * as components from "../../component/main";
import * as windows from "../../window/main";
import { EncryptedStorage } from "../../utils/EncryptedStorage";
import { NetworkStatusService } from "../../mail/NetworkStatusService";
import { ParallelTaskStream } from "../../task/ParallelTaskStream";
import { PlayerManager } from "./musicPlayer/PlayerManager";
import { NotificationsService } from "./notifications/NotificationsService";
import { AudioWindowController } from "../../window/audio/AudioWindowController";
import { PollingItem } from "../../mail/SinkIndex";
import { CssParser } from "./customization/CssParser";
import { CustomizationData } from "./customization/CustomizationData";
import { EventDispatcher } from "../../utils/EventDispatcher";
import { SectionPickerWindowController } from "../../window/sectionpicker/SectionPickerWindowController";
import { SectionNewWindowController } from "../../window/sectionnew/SectionNewWindowController";
import { Window as AppWindow } from "./../../app/common/window/Window";
import { ContactService } from "../../mail/contact/ContactService";
import { LicenceWindowController } from "../../window/licence/LicenceWindowController";
import { UserPreferences, UnreadBadgeClickAction } from "../../mail/UserPreferences";
import { MailConst, section, WebSocketNotifier } from "../../mail";
import { MindmapEditorWindowController } from "../../window/mindmapeditor/main";
import { SupportWindowController } from "../../window/support/SupportWindowController";
import { SoundsLibrary } from "../../sounds/SoundsLibrary";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { SessionManager } from "../../mail/session/SessionManager";
import { FileStyleResolver } from "./FileStyleResolver";
import { StickersList } from "../../component/emojipicker/StickersList";
import { HelperWindowController } from "../../window/helper/HelperWindowController";
import { WebCCApi } from "../../mail/WebCCApi";
import { Session } from "../../mail/session/SessionManager";
import { ContentEditableEditorMetaData, FilePickerData } from "../../web-utils/ContentEditableEditorMetaData";
import { ThumbsManager } from "../../mail/thumbs";
import { FileRenameObserver } from "./FileRenameObserver";
import { VoiceChatService } from "./voicechat/VoiceChatService";
import { PlayerHelperWindowController } from "../../window/playerhelper/PlayerHelperWindowController";
import { UsersPresenceChecker } from "../../mail/UsersPresenceChecker";
import { VideoConferencesService } from "./videoconferences/VideoConferencesService";
import { PersonService } from "../../mail/person/PersonService";
import { FilesLockingService } from "./fileslockingservice/FilesLockingService";
import { UploadService } from "./uploadservice/UploadService";
import { ContextHistory, NewContextAddedToHistoryEvent } from "./contexthistory/ContextHistory";
import { Router } from "./router/Router";
import { DevConsoleWindowController } from "../../window/devconsole/main";

let Logger = RootLogger.get("app.common.CommonApplication");

plugins.forEach(plugin => {
    Logger.debug("Plugin loaded", plugin.name);
})

export abstract class CommonApplication extends Container implements app.IpcContainer {
    
    static ENC_KEY = new Buffer("d2014a39e7c4d0f524279560f82aa57ec1c894acbd242ef74aaaf3cce47cfde4", "hex");
    static MIN_ATTACHMENT_SIZE_TO_OPEN_DOWNLOAD_WINDOW = 2 * 1024 * 1024;
    
    app: CommonApplication;
    storage: utils.Storage<string, string>;
    localeService: LocaleService;
    msgBox: MsgBox;
    defaultSettings: EncryptedStorage;
    mcaFactory: McaFactory;
    windows: {[name: string]: BaseWindowController};
    networkStatusService: NetworkStatusService;
    connectionStatusChecker: ConnectionStatusChecker;
    preventLeavePageAlert: boolean;
    viewLogLevel: string;
    mailResourceLoader: mail.MailResourceLoader;
    assetsManager: AssetsManager;
    searchModel: app.SearchModel;
    onSetAppTitle: (title: string) => string;
    onLogoutCallback: app.OnLogoutCallback[];
    customMenuItems: privfs.types.core.CustomMenuItem[];
    unclosableWindowsName: string[];
    openedWindows: BaseWindowController[];
    hiddenMode: boolean;
    historyKey: number;
    ipcChannelId: number;
    shellRegistry: ShellRegistry;
    clipboard: Clipboard;
    openedElementsManager: OpenedElementsManager;
    errorLog: ErrorLog;
    errorLogFile: string = null;
    manager: BaseWindowManager<BaseWindowController>;
    ipcHolder: IpcHolder;
    ioc: IOC;
    taskStream: ParallelTaskStream;
    options: app.AppOptions;
    countModels: Model<number>[];
    commonNotificationsService: NotificationsService;
    customizedTheme: CustomizationData = null;
    temporaryCustomizedTheme: CustomizationData = null;
    isUsingTemporaryCustomizedTheme: boolean = false;
    isMnemonicEnabled: boolean = true;
    dataCleared: boolean = false;
    needShiftToSwitchWithContext: boolean = false;
    contextModifierPresent: boolean = false;
    eventDispatcher: EventDispatcher;
    contactService: ContactService;
    personService: PersonService;
    userCredentials: app.UserCredentials;
    userPreferences: UserPreferences;
    serverConfigPromise: Q.Promise<privfs.types.core.ConfigEx>;
    serverConfigForUser: privfs.types.core.UserConfig;
    filesLockingService: FilesLockingService;
    uploadService: UploadService;
    openTryMarkAsReadConfirms: { event: event.TryMarkAsReadEvent, window: Window }[] = [];
    soundsLibrary: SoundsLibrary = new SoundsLibrary();
    keyboardShortcuts: KeyboardShortcuts = null;
    sessionManager: SessionManager;
    fileStyleResolver: FileStyleResolver = null;
    thumbsManager: ThumbsManager = null;
    paymentStatusUpdater: NodeJS.Timer;
    playBubblePopSoundOnNextSetBubblesStateEvent: boolean = false;
    zoomLevels: number[] = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
    zoomLevelId: number = 5;
    defaultZoomLevelId: number = 5;
    onCancelPrintCallback: () => void = null;
    identity: privfs.identity.Identity;
    fileRenameObserver: FileRenameObserver;
    voiceChatService: VoiceChatService;
    videoConferencesService: VideoConferencesService;
    usersPresenceChecker: UsersPresenceChecker;
    router: Router;
    contextHistory: ContextHistory;
    deviceId: string;

    static instance: CommonApplication;
    
    constructor(public ipcMain: Types.ipc.IpcMain, storage: utils.Storage<string, string>, localeService: LocaleService, mailResourceLoader: mail.MailResourceLoader, assetsManager: AssetsManager) {
        super();
        CommonApplication.instance = this;
        this.ioc = new IOC();
        this.ioc.registerComponent("autorefresh", components.autorefresh.AutoRefreshController);
        this.ioc.registerComponent("progress", components.channel.ProgressController);
        this.ioc.registerComponent("conv2list", components.conv2list.Conv2ListController);
        this.ioc.registerComponent("conversationlist", components.conversationlist.ConversationListController);
        this.ioc.registerComponent("customelementlist", components.customelementlist.CustomElementListController);
        this.ioc.registerComponent("customizationeditor", components.customizationeditor.CustomizationEditorController);
        this.ioc.registerComponent("editorbuttons", components.editorbuttons.EditorButtonsController);
        this.ioc.registerComponent("extlist", components.extlist.ExtListController);
        this.ioc.registerComponent("exttable", components.exttable.ExtTableController);
        this.ioc.registerComponent("mindmapeditor", components.mindmapeditor.MindmapEditorController);
        this.ioc.registerComponent("navbar", components.navbar.NavBarController);
        this.ioc.registerComponent("notification", components.notification.NotificationController);
        this.ioc.registerComponent("persons", components.persons.PersonsController);
        this.ioc.registerComponent("playercontrols", components.playercontrols.PlayerControlsController);
        this.ioc.registerComponent("slider", components.slider.SliderController);
        this.ioc.registerComponent("sectionstabs", components.sectionstabs.SectionsTabsController);
        this.ioc.registerComponent("sectionlist", components.sectionlist.SectionListController);
        this.ioc.registerComponent("remotesectionlist", components.remotesectionlist.RemoteSectionListController);
        this.ioc.registerComponent("remoteconv2list", components.remoteconv2list.RemoteConv2ListController);
        this.ioc.registerComponent("remotehostlist", components.remotehostlist.RemoteHostListController);
        this.ioc.registerComponent("sidebar", components.sidebar.SidebarController);
        this.ioc.registerComponent("splitter", components.splitter.SplitterController);
        this.ioc.registerComponent("statusbar", components.statusbar.StatusBarController);
        this.ioc.registerComponent("statusbarmain", components.statusbarmain.StatusBarMainController);
        this.ioc.registerComponent("tooltip", components.tooltip.TooltipController);
        this.ioc.registerComponent("tasktooltip", components.tasktooltip.TaskTooltipController);
        this.ioc.registerComponent("filetooltip", components.filetooltip.FileTooltipController);
        this.ioc.registerComponent("titletooltip", components.titletooltip.TitleTooltipController);
        this.ioc.registerComponent("sectiontooltip", components.sectiontooltip.SectionTooltipController);
        this.ioc.registerComponent("userslisttooltip", components.userslisttooltip.UsersListTooltipController);
        this.ioc.registerComponent("tree", components.tree.TreeController);
        this.ioc.registerComponent("emojipicker", components.emojipicker.EmojiPickerController);
        this.ioc.registerComponent("emojiviewbar", components.emojiviewbar.EmojiViewBarController);
        this.ioc.registerComponent("updatenotification", components.updatenotification.UpdateNotificationController);
        this.ioc.registerComponent("disabledsection", components.disabledsection.DisabledSectionController);
        this.ioc.registerComponent("taskchooser", components.taskchooser.TaskChooserController);
        this.ioc.registerComponent("encryptioneffect", components.encryptioneffect.EncryptionEffectController);
        this.ioc.registerComponent("userguide", components.userguide.UserGuideController);
        this.ioc.registerComponent("loading", components.loading.LoadingController);
        this.ioc.registerComponent("thumbs", components.thumbs.ThumbsController);
        this.ioc.registerComponent("voicechatcontrols", components.voicechatcontrols.VoiceChatControlsController);
        this.ioc.registerComponent("audioplayer", components.audioplayer.AudioPlayerController);
        this.ioc.registerComponent("customselect", components.customselect.CustomSelectController);
        
        // i18n: components
        components.autorefresh.AutoRefreshController.registerTexts(localeService);
        components.channel.ProgressController.registerTexts(localeService);
        components.conv2list.Conv2ListController.registerTexts(localeService);
        components.conversationlist.ConversationListController.registerTexts(localeService);
        components.customelementlist.CustomElementListController.registerTexts(localeService);
        components.customizationeditor.CustomizationEditorController.registerTexts(localeService);
        components.disabledsection.DisabledSectionController.registerTexts(localeService);
        components.editorbuttons.EditorButtonsController.registerTexts(localeService);
        components.emojipicker.EmojiPickerController.registerTexts(localeService);
        components.emojiviewbar.EmojiViewBarController.registerTexts(localeService);
        components.encryptioneffect.EncryptionEffectController.registerTexts(localeService);
        components.extlist.ExtListController.registerTexts(localeService);
        components.exttable.ExtTableController.registerTexts(localeService);
        components.mindmapeditor.MindmapEditorController.registerTexts(localeService);
        components.navbar.NavBarController.registerTexts(localeService);
        components.notification.NotificationController.registerTexts(localeService);
        components.persons.PersonsController.registerTexts(localeService);
        components.playercontrols.PlayerControlsController.registerTexts(localeService);
        components.sectionlist.SectionListController.registerTexts(localeService);
        components.remotesectionlist.RemoteSectionListController.registerTexts(localeService);
        components.remoteconv2list.RemoteConv2ListController.registerTexts(localeService);
        components.remotehostlist.RemoteHostListController.registerTexts(localeService);
        components.sectionstabs.SectionsTabsController.registerTexts(localeService);
        components.sectiontooltip.SectionTooltipController.registerTexts(localeService);
        components.userslisttooltip.UsersListTooltipController.registerTexts(localeService);
        components.sidebar.SidebarController.registerTexts(localeService);
        components.slider.SliderController.registerTexts(localeService);
        components.splitter.SplitterController.registerTexts(localeService);
        components.statusbar.StatusBarController.registerTexts(localeService);
        components.statusbarmain.StatusBarMainController.registerTexts(localeService);
        components.taskchooser.TaskChooserController.registerTexts(localeService);
        components.tasktooltip.TaskTooltipController.registerTexts(localeService);
        components.filetooltip.FileTooltipController.registerTexts(localeService);
        components.titletooltip.TitleTooltipController.registerTexts(localeService);
        components.tooltip.TooltipController.registerTexts(localeService);
        components.tree.TreeController.registerTexts(localeService);
        components.updatenotification.UpdateNotificationController.registerTexts(localeService);
        components.userguide.UserGuideController.registerTexts(localeService);
        components.loading.LoadingController.registerTexts(localeService);
        components.voicechatcontrols.VoiceChatControlsController.registerTexts(localeService);
        components.audioplayer.AudioPlayerController.registerTexts(localeService);
        components.customselect.CustomSelectController.registerTexts(localeService);
        
        // i18n: windows
        windows.about.AboutWindowController.registerTexts(localeService);
        windows.admin.AdminWindowController.registerTexts(localeService);
        windows.admin.blacklist.BlacklistController.registerTexts(localeService);
        windows.admin.cron.CronController.registerTexts(localeService);
        windows.admin.customization.CustomizationController.registerTexts(localeService);
        windows.admin.externalusers.ExternalUsersController.registerTexts(localeService);
        windows.admin.initdata.InitDataController.registerTexts(localeService);
        windows.admin.logins.LoginsController.registerTexts(localeService);
        windows.admin.privmsg.PrivMsgController.registerTexts(localeService);
        windows.admin.smtp.SmtpController.registerTexts(localeService);
        windows.admin.sysinfo.SysInfoController.registerTexts(localeService);
        windows.admin.payments.PaymentsController.registerTexts(localeService);
        windows.admin.sysmsg.SysMsgController.registerTexts(localeService);
        windows.admin.trusted.TrustedController.registerTexts(localeService);
        windows.admin.users.UsersController.registerTexts(localeService);
        windows.admin.proxywhitelist.ProxyWhitelistController.registerTexts(localeService);
        windows.adminaddexternaluser.AdminAddExternalUserWindowController.registerTexts(localeService);
        windows.adminadduser.AdminAddUserWindowController.registerTexts(localeService);
        windows.adminedituser.AdminEditUserWindowController.registerTexts(localeService);
        windows.audio.AudioWindowController.registerTexts(localeService);
        windows.changepassword.ChangePasswordWindowController.registerTexts(localeService);
        windows.clearcache.ClearCacheWindowController.registerTexts(localeService);
        windows.compose.ComposeWindowController.registerTexts(localeService);
        windows.container.ContainerWindowController.registerTexts(localeService);
        windows.download.DownloadWindowController.registerTexts(localeService);
        windows.downloadattachment.DownloadAttachmentWindowController.registerTexts(localeService);
        windows.editor.EditorWindowController.registerTexts(localeService);
        windows.emailinfo.EmailInfoWindowController.registerTexts(localeService);
        windows.emailpassword.EmailPasswordWindowController.registerTexts(localeService);
        windows.empty.EmptyWindowController.registerTexts(localeService);
        windows.fonts.FontsWindowController.registerTexts(localeService);
        windows.helper.HelperWindowController.registerTexts(localeService);
        windows.image.ImageWindowController.registerTexts(localeService);
        windows.imageeditor.ImageEditorWindowController.registerTexts(localeService);
        windows.licence.LicenceWindowController.registerTexts(localeService);
        windows.login.LoginWindowController.registerTexts(localeService);
        windows.message.MessageWindowController.registerTexts(localeService);
        windows.msgbox.MsgBoxWindowController.registerTexts(localeService);
        windows.notifications.NotificationsWindowController.registerTexts(localeService);
        windows.openexternal.OpenExternalWindowController.registerTexts(localeService);
        windows.pdf.PdfWindowController.registerTexts(localeService);
        windows.playerhelper.PlayerHelperWindowController.registerTexts(localeService);
        windows.sectionedit.SectionEditWindowController.registerTexts(localeService);
        windows.sectionnew.SectionNewWindowController.registerTexts(localeService);
        windows.sectionpicker.SectionPickerWindowController.registerTexts(localeService);
        windows.sections.SectionsWindowController.registerTexts(localeService);
        windows.sectionsummary.SectionSummaryWindowController.registerTexts(localeService);
        windows.secureformdev.SecureFormDevWindowController.registerTexts(localeService);
        windows.selectcontacts.SelectContactsWindowController.registerTexts(localeService);
        windows.settings.SettingsWindowController.registerTexts(localeService);
        windows.settings.alternativeLogin.AlternativeLoginController.registerTexts(localeService);
        windows.settings.changepassword.ChangePasswordController.registerTexts(localeService);
        windows.settings.contactform.ContactFormController.registerTexts(localeService);
        windows.settings.hotkeys.HotkeysController.registerTexts(localeService);
        windows.settings.mail.MailController.registerTexts(localeService);
        windows.settings.notifications.NotificationsController.registerTexts(localeService);
        windows.settings.publicprofile.PublicProfileController.registerTexts(localeService);
        windows.settings.secureforms.SecureFormsController.registerTexts(localeService);
        windows.settings.subidentities.SubidentitiesController.registerTexts(localeService);
        windows.settings.sysinfo.SysInfoController.registerTexts(localeService);
        windows.settings.sysinfoext.SysInfoExtController.registerTexts(localeService);
        windows.settings.userinterface.UserInterfaceController.registerTexts(localeService);
        windows.settings.devices.DevicesController.registerTexts(localeService);
        windows.settings.whitelist.WhitelistController.registerTexts(localeService);
        windows.source.SourceWindowController.registerTexts(localeService);
        windows.subid.SubIdWindowController.registerTexts(localeService);
        windows.taskchooser.TaskChooserWindowController.registerTexts(localeService);
        windows.unsupported.UnsupportedWindowController.registerTexts(localeService);
        windows.update.UpdateWindowController.registerTexts(localeService);
        windows.url.UrlWindowController.registerTexts(localeService);
        windows.verifydomain.VerifyDomainWindowController.registerTexts(localeService);
        windows.video.VideoWindowController.registerTexts(localeService);
        windows.licensevendors.LicenseVendorsWindowController.registerTexts(localeService);
        windows.mindmapeditor.MindmapEditorWindowController.registerTexts(localeService);
        windows.controlcenter.ControlCenterWindowController.registerTexts(localeService);
        windows.error.ErrorWindowController.registerTexts(localeService);
        windows.textviewer.TextViewerWindowController.registerTexts(localeService);
        windows.support.SupportWindowController.registerTexts(localeService);
        windows.switchvoicechatconfirm.SwitchVoiceChatConfirmWindowController.registerTexts(localeService);
        windows.videorecorder.VideoRecorderWindowController.registerTexts(localeService);
        windows.deviceselector.DeviceSelectorWindowController.registerTexts(localeService);
        windows.devconsole.DevConsoleWindowController.registerTexts(localeService);
        windows.videoconferenceinfo.VideoConferenceInfoWindowController.registerTexts(localeService);
        windows.uploadservice.UploadServiceWindowController.registerTexts(localeService);

        this.localeService = this.ioc.registerByValue("localeService", localeService, Lifecycle.ETERNAL);
        this.assetsManager = this.ioc.registerByValue("assetsManager", assetsManager, Lifecycle.ETERNAL);
        this.networkStatusService = this.ioc.registerByValue("networkStatusService", new NetworkStatusService(), Lifecycle.ETERNAL);
        this.mailResourceLoader = this.ioc.registerByValue("mailResourceLoader", mailResourceLoader, Lifecycle.ETERNAL);
        this.taskStream = this.ioc.registerByValue("taskStream", new ParallelTaskStream(), Lifecycle.ETERNAL);
        this.storage = this.ioc.registerByValue("unecryptedLocalStorage", storage, Lifecycle.ETERNAL);
        this.defaultSettings = this.ioc.registerByValue("wellKnownEncryptedLocalStorage", new EncryptedStorage(CommonApplication.ENC_KEY, storage), Lifecycle.ETERNAL);
        this.ioc.registerByValue("eventDispatcher", this, Lifecycle.ETERNAL);
        this.ioc.registerByValue("componentFactory", this.ioc, Lifecycle.ETERNAL);
        this.ioc.registerByValue("stickersProvider", {getStickers: () => StickersList.get()}, Lifecycle.ETERNAL);
        
        this.options = {
            sinkFilter: this.ioc.registerByValue("sinkFilter", {value: null}, Lifecycle.ETERNAL),
            defaultPki: this.ioc.registerByValue("defaultPki", {value: false}, Lifecycle.ETERNAL),
            notifications: this.ioc.registerByValue("notifications", {value: []}, Lifecycle.ETERNAL),
            forcedPublishPresenceType: this.ioc.registerByValue("forcedPublishPresenceType", {value: null}, Lifecycle.ETERNAL),
            maxFileSize: this.ioc.registerByValue("maxFileSize", {value: null}, Lifecycle.ETERNAL),
            kvdbPollInterval: this.ioc.registerByValue("kvdbPollInterval", {value: 10000}, Lifecycle.ETERNAL)
        };
        
        this.ipcHolder = new IpcHolder(ipcMain);
        this.ipcHolder.register("messageService", new MessageService(this));
        this.ipcHolder.register("userService", new UserService(this));
        this.ipcHolder.register("msgBoxService", new MsgBoxService(this));
        
        this.app = this;
        this.manager = new BaseWindowManager(null, null);

        this.contextHistory = new ContextHistory(this);
        this.app.addEventListener<NewContextAddedToHistoryEvent>("new-context-added-to-history", event => {
            let currentContext = this.contextHistory.getCurrent();
            this.app.setContainerWindowHistoryEntry({
                    pathname: "/" + currentContext.getModuleName(),
                    state: currentContext
                }, false);
        }, "main", "ethernal");
        

        this.router = new Router(this.manager, this.contextHistory);

        this.ioc.registerByValue("contextHistory", this.contextHistory, Lifecycle.ETERNAL);
        this.ioc.registerByValue("router", this.router, Lifecycle.ETERNAL);


        
        this.ipcChannelId = 0;
        this.msgBox = MsgBox.create(this, this.localeService, this.ioc);
        this.errorLog = new ErrorLog(Logger, this, this.msgBox);
        this.viewLogLevel = "WARN";
        this.mcaFactory = new McaFactory(this.localeService, this, this.ioc);
        this.defaultSettings.get("endpoints").then(endpoints => {
            if (endpoints) {
                this.mcaFactory.setCachedUrls(JSON.parse(endpoints));
            }
        });
        this.addEventListener<event.EndpointResolvedEvent>("endpointresolved", event => {
            this.defaultSettings.set("endpoints", JSON.stringify(event.urlMap));
        }, "main", "ethernal");
        this.addEventListener<event.SinkPollingResultEvent>("sinkpollingresult", event => {
            this.onPollingResult(event.entries);
        }, "main", "ethernal");
        this.addEventListener<event.TryMarkAsReadEvent>("try-mark-as-read", this.onTryMarkAsRead.bind(this), "main", "ethernal");
        this.app.addEventListener<event.SetBubblesState>("set-bubbles-state", e => {
            if (e.markingAsRead == false) {
                this.tryPlayBubblePopSound();
            }
        }, "main");
        this.addEventListener<event.OpenEditSectionDialogEvent>("open-edit-section-dialog", e => {
            this.openEditSectionDialogFromSidebar(e.sectionId);
        }, "main", "ethernal");
        
        this.usersPresenceChecker = new UsersPresenceChecker(this);
        
        this.windows = {};
        
        this.openedElementsManager = new OpenedElementsManager();
        
        this.searchModel = new Model({value: "", visible: false});
        this.onLogoutCallback = [];
        this.customMenuItems = [];
        this.connectionStatusChecker = null;
        this.unclosableWindowsName = ["container"];
        this.openedWindows = [];
        this.hiddenMode = false;
        this.historyKey = 0;
        
        this.shellRegistry = new ShellRegistry(this);
        this.clipboard = new Clipboard(this);
        this.fileStyleResolver = new FileStyleResolver(this);
        this.thumbsManager = new ThumbsManager(this);
        this.fileRenameObserver = new FileRenameObserver(this);
        this.voiceChatService = new VoiceChatService(this);
        this.videoConferencesService = new VideoConferencesService(this);
    }
    
    openChildWindow<T extends BaseWindowController>(win: T, delayedOpenDeferred?: Q.Deferred<T>): T {
        let prep = win.prepareBeforeShowing();
        if (prep) {
            prep.then(() => {
                this.openChildWindow(win, delayedOpenDeferred);
            });
            return;
        }
        this.registerInstance(win);
        win.open();
        if (delayedOpenDeferred) {
            delayedOpenDeferred.resolve(win);
        }
        return win;
    }
    
    abstract addToObjectMap(obj: any): number;
    
    abstract getFromObjectMap<T = any>(id: number): T;

    abstract removeFromObjectMap(id: number): void;
    
    abstract getMailClientViewHelperModel(): app.MailClientViewHelperModel;
    
    createIpcChannelId(): string {
        return "channel-" + this.ipcChannelId++;
    }
    
    createIpcSender(_channelId: string = null): app.IpcSender {
        throw new Error("Ipc sender cannot be create directly in application");
    }
    
    addIpcListener(_channel: string, _listener: Types.ipc.IpcMainListener): void {
    }
    
    removeAllIpcListeners(_channel: string): void {
    }
    
    getNodeModulesDir(): string {
        return "";
    }
    
    abstract isElectronApp(): boolean;
    
    abstract isWebApp(): boolean;
    
    isTestMode(): boolean {
        return false;
    }
    
    isDemo(): boolean {
        return false;
    }
    
    supportsSecureForms(): boolean {
        return false;
    }
    
    isSearchEnabled(): boolean {
        return true;
    }
    
    getInitApp(): string {
        return "";
    }
    
    getLogoApp(): string {
        return "";
    }
    
    getApps(): string[] {
        return [];
    }
    
    loadCustomizationAsset(_name: string): string {
        return "";
    }
    
    startWithAutoLogin(): boolean {
        return false;
    }
    
    abstract isAutoUpdateSupport(): boolean;
    
    abstract getAutoUpdateStatusModel(): app.AutoUpdateStatusModel;
    
    abstract openWindow(load: app.WindowLoadOptions, options: app.WindowOptions, controller: BaseWindowController, parentWindow: app.WindowParent, singletonName?: string): Window;
    
    getUIEventsListener(): () => void {
        return null;
    }
    
    openLinksByController() {
        return false;
    }
    
    getFullscreenModel(): app.FullscreenModel {
        return null;
    }
    
    getBrowser(): BrowserDetection {
        return null;
    }
    
    abstract getVersion(): utils.ProjectInfo;
    
    isInviteFriendEnabled(): boolean {
        return false;
    }
    
    isContextMenuBlocked(): boolean {
        return true;
    }
    
    isLogged() {
        return this.sessionManager
            && this.sessionManager.isSessionExistsByHost(this.sessionManager.defaultHost)
            && this.sessionManager.getLocalSession().mailClientApi != null;
    }
    
    isHidden() {
        return this.hiddenMode
    }
    
    onContainerHide() {
    }
    
    startUpdateMode(): void {
        this.ioc.create(ContainerWindowController, [this]).then(container => {
            this.registerInstance(container);
            if (!this.manager) {
                this.manager = new BaseWindowManager(container, null);
            }
            this.windows.container = container;
            container.open();
        });
    }
    
    start(afterUpdate?: boolean): void {
        this.ioc.registerByValue("tasksPlugin", this.components["tasks-plugin"], Lifecycle.ETERNAL);
        this.ioc.registerByValue("notes2Plugin", this.components["notes2-plugin"], Lifecycle.ETERNAL);
        this.dispatchEvent<Types.event.PluginLoadedEvent>({type: "pluginsloaded", target: this});
        if (afterUpdate) {
            this.registerViewersEditors();
            return;
        }
        this.ioc.create(ContainerWindowController, [this]).then(container => {
            container.setTitle(this.getAppTitle());
            this.registerInstance(container);
            if (!this.manager) {
                this.manager = new BaseWindowManager(container, null);
            }
            this.windows.container = container;
            container.openWindowOptions.hidden = this.isHidden();
            container.open();
            this.registerViewersEditors();
        });
    }
    
    onLoginStart(): void {
    }
    
    onAutoLoginNotPerformed(): void {
    }
    
    onLoginFail(): void {
    }
    
    onLogin(mailClientApi: MailClientApi, userCredentials: app.UserCredentials): void {
        let containerWindow: ContainerWindowController;
        this.userCredentials = userCredentials;
        Q().then(() => {
            return Q.all([
                mailClientApi.privmxRegistry.getSessionManager(),
                mailClientApi.privmxRegistry.getAuthData(),
                mailClientApi.privmxRegistry.getServerProxyService()
            ])
        })
        .then(res => {
            let [sessionManager, authData] = res;
            this.sessionManager = sessionManager;
            return this.sessionManager.addLocalSession(authData, mailClientApi);
        })
        .then(() => {
            return this.sessionManager.initAfterLogin();
        })
        .then(() => {
            this.uploadService = new UploadService(this);
            // console.log("create player helper window")
            this.ioc.create(PlayerHelperWindowController, [this]).then(helperWindow => {
                helperWindow.playerManager = new PlayerManager(this, helperWindow);
                this.windows.playerHelper = this.registerInstance(helperWindow);
                this.windows.playerHelper.open();
            });
            return this.afterLoginBefore();
        })
        .then(() => {
            return this.mailClientApi.privmxRegistry.getSrpSecure()
        })
        .then(srpSecure => {
            return Q.all([
                Q.all([
                    srpSecure,
                    srpSecure.getUserConfig(),
                    this.mailClientApi.privmxRegistry.getClient(),
                    this.mailClientApi.privmxRegistry.getUserPreferences(),
                    this.mailClientApi.privmxRegistry.getContactService(),
                    this.mailClientApi.privmxRegistry.getMailFilter(),
                ]),
                Q.all([
                    this.mailClientApi.privmxRegistry.getAuthData(),
                    this.mailClientApi.privmxRegistry.getNetworkStatusService(),
                    this.mailClientApi.privmxRegistry.getEventDispatcher(),
                    this.mailClientApi.privmxRegistry.getCustomizationApi(),
                    this.mailClientApi.privmxRegistry.getUtilApi(),
                    this.mailClientApi.privmxRegistry.getIdentityProvider(),
                ]),
                Q.all([
                    this.mailClientApi.privmxRegistry.getPersonService()
                ]),
            ]);
        })
        .then(res => {
            let [srpSecure, userConfig, client, userPreferences, contactService] = res[0];
            let [authData, networkStatusService, eventDispatcher, customizationApi, utilApi, identityProvider] = res[1];
            let [personService] = res[2];
            this.identity = identityProvider.getIdentity();
            this.filesLockingService = new FilesLockingService(this, this.identity);
            this.userPreferences = userPreferences;
            
            this.usersPresenceChecker.start();
            
            utilApi.getDeviceToken().then(deviceToken => {
                srpSecure.gateway.properties["deviceToken"] = deviceToken;
            })
            .fail(e => {
                console.log("Error during getting device token", e);
            });
            // lazy loaded serverConfig for admin windows
            this.serverConfigPromise = identityProvider.isAdmin() ? srpSecure.getConfigEx() : Q.resolve(null);
            this.serverConfigForUser = userConfig;
            this.setSentryEnabled(this.serverConfigForUser && (<any>this.serverConfigForUser).clientDebugLevel);
            
            customizationApi.getCustomization().then(theme => {
                theme.cssVariables = CssParser.parseVariables(theme.css).cssVars;
                this.useCustomizedTheme(theme, true);
                this.saveCustomTheme();
                this.assetsManager.setAssetByName("CUSTOM_LOGO_127X112", this.customizedTheme.logoLoginScreen ? this.customizedTheme.logoLoginScreen : this.assetsManager.getAssetByName("CUSTOM_LOGO_127X112_ORIG"), false);
                this.assetsManager.setAssetByName("CUSTOM_LOGO_127X112_WH", this.customizedTheme.logoLoginScreen ? this.customizedTheme.logoLoginScreen : this.assetsManager.getAssetByName("CUSTOM_LOGO_127X112_WH_ORIG"), false);
                this.assetsManager.setAssetByName("CUSTOM_LOGO_87X22", this.customizedTheme.logoHeader ? this.customizedTheme.logoHeader : this.assetsManager.getAssetByName("CUSTOM_LOGO_87X22_ORIG"), false);
                this.assetsManager.setAssetByName("CUSTOM_LOGO_87X22_WH", this.customizedTheme.logoHeaderWh ? this.customizedTheme.logoHeaderWh : this.assetsManager.getAssetByName("CUSTOM_LOGO_87X22_WH_ORIG"), false);
            });
            client.storageProviderManager.event.add(this.onStorageEvent.bind(this));
            if (! this.isElectronApp()) {
                this.connectionStatusChecker = new ConnectionStatusChecker(srpSecure, this.identity, networkStatusService, this, <Event<any, any, any>><any>srpSecure.gateway.onConnectionLostEvent);
            }
            this.eventDispatcher = eventDispatcher;
            eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this), "main");
            this.onUserPreferencesChange({
                type: "userpreferenceschange",
                operation: "load",
                userPreferences: userPreferences
            });
            this.voiceChatService.initAfterLogin();
            this.videoConferencesService.initAfterLogin();
            
            this.getPlayerManager().init(eventDispatcher);
            this.getPlayerManager().onUserPreferencesChange({
                type: "userpreferenceschange",
                operation: "load",
                userPreferences: userPreferences
            });
            this.registerStreamsEvents(eventDispatcher);
            eventDispatcher.addEventListener<event.RevertSinkIndexEntry>("revertsinkindexentry", this.onRevertEntry.bind(this), "main");
            eventDispatcher.addEventListener<event.UserPreferencesChangeEvent>("userpreferenceschange", this.onUserPreferencesChange.bind(this), "main");
            this.addCountModel(contactService.starredContactCountModel);
            
            this.commonNotificationsService = new NotificationsService(this, eventDispatcher);
            containerWindow = <ContainerWindowController>this.windows.container;
            containerWindow.closeLoginWindow();
            
            this.afterLogin();
            this.dispatchEvent<Types.event.AfterLoginEvent>({type: "afterlogin", target: this, userCredentials: userCredentials});
            containerWindow.prepareApps();
            this.onNewCountChange();
            
            if (authData.myData.raw.generatedPassword) {
                this.ioc.create(ChangePasswordWindowController, [this, (newPassword: string) => {
                    this.userCredentials.password = newPassword;
                    this.app.dispatchEvent<Types.event.AfterPasswordChangedEvent>({type: "afterPasswordChanged", userCredentials: this.userCredentials});
                    this.checkFirstLoginAndSwitchToAppMode(this.userPreferences, containerWindow);
                }])
                .then(win => {
                    this.openChildWindow(win);
                });
            }
            else {
                this.checkFirstLoginAndSwitchToAppMode(this.userPreferences, containerWindow);
            }
            this.contactService = contactService;
            this.personService = personService;
            personService.startSynchronizationTimer();
            this.startPaymentStatusUpdater();
        })
        .fail(e => {
            Logger.error("Error onLogin", e);
        });
    }
    
    checkFirstLoginAndSwitchToAppMode(userPreferences: UserPreferences, containerWindow: ContainerWindowController): Q.Promise<void> {
        return Q().then(() => {
            if (this.isFirstLogin(userPreferences)) {
                containerWindow.showInitializing();
                return this.mailClientApi.initUserPreferencesForFirstUser()
                .then(() => {
                    return this.mailClientApi.checkLoginCore().then(() => {
                        containerWindow.hideInitializing();
                    })
                })
            }
            else {
                return;
            }
        })
        .then(() => {
            containerWindow.switchToAppMode();
        });
    }
    
    addCountModel(model: Model<number>) {
        if (! this.countModels) {
            this.countModels = [];
        }
        this.countModels.push(model);
        model.changeEvent.add(this.onNewCountChange.bind(this), "multi");
    }
    
    onNewCountChange(): void {
        let newCount = 0;
        this.countModels.forEach(x => {
            newCount += x.get();
        });
        this.setNewCount(newCount);
    }
    
    onRevertEntry(event: event.RevertSinkIndexEntry): void {
        let message = this.app.localeService.i18n("app.revert.default");
        if (event.indexEventType == "update-revert") {
            message = this.localeService.i18n("app.revert.update");
        }
        if (event.indexEventType == "delete-revert") {
            message = this.localeService.i18n("app.revert.delete");
        }
        if (event.indexEventType == "move-revert") {
            message = this.localeService.i18n("app.revert.move");
        }
        if (event.indexEventType == "delete-bulk-revert") {
            message = this.localeService.i18n("app.revert.bulk");
        }
        this.msgBox.alert(message);
    }
    
    onStorageEvent(_event: privfs.types.core.SPMEvent): void {
    }
    
    afterLoginBefore(): Q.IWhenable<void> {
    }
    
    afterLogin(): void {
    }
    
    afterStart(): void {
    }
    
    logout(): void {
        this.beforeLogout();
        for (let i = 0; i < this.onLogoutCallback.length; i++) {
            try {
                if (this.onLogoutCallback[i]() === true) {
                    return;
                }
            }
            catch (e) {
                Logger.error("Error during calling onLogout", e)
            }
        }
        this.clean();
    }
    
    clean() {
        this.app.closeAllWindows().then(() => {
            let containerWindow = <ContainerWindowController>this.windows.container;
            containerWindow.clean().then(() => {
                this.searchModel.set({value: "", visible: false});
                this.ioc.clearDeps();
                if (this.mailClientApi) {
                    this.sessionManager.closeLocalSession();
                }
                if (this.connectionStatusChecker) {
                    this.connectionStatusChecker.destroy();
                    this.connectionStatusChecker = null;
                }
                this.afterLogout();
            })
            .fail(e => {
                console.log(e)
            });
        })
        .fail(e => {
            console.log(e)
        });
    }
    
    beforeLogout(): void {
        this.usersPresenceChecker.stop();
        this.stopPaymentStatusUpdater();
        this.dispatchEvent<Types.event.BeforeLogoutPlugin>({type: "beforelogout", target: this});
    }
    
    afterLogout(): void {
        this.sessionManager.closeAllRemoteSessions();
        
        this.dispatchEvent<Types.event.AfterLogoutPlugin>({type: "afterlogout", target: this});
    }
    
    getDefaultSettings(): utils.IStorage {
        return this.defaultSettings;
    }
    
    abstract setRegisterTokenInfo(tokenInfo: utils.RegisterTokenInfo): void;
    
    abstract getRegisterTokenInfo(): utils.RegisterTokenInfo;
    
    clearSession(): void {
        if (this.sessionManager) {
            this.sessionManager.closeLocalSession();
        }
        
        if (this.mcaFactory) {
            this.mcaFactory = null;
        }
        
        this.mcaFactory = new McaFactory(this.localeService, this, this.ioc);
        this.defaultSettings.get("endpoints").then(endpoints => {
            if (endpoints) {
                this.mcaFactory.setCachedUrls(JSON.parse(endpoints));
            }
        });
        this.ioc.clearDeps();
        if (this.mailClientApi) {
            this.mailClientApi.lazyLoader.destroy();
            this.mailClientApi.destroy();
        }
    }
    
    getOriginalUrl(): string {
        return null;
    }
    
    getTermsUrl(): string {
        return null;
    }
    
    getPrivacyPolicyUrl(): string {
        return null;
    }
    
    getDesktopDownloadUrl(): string {
        return null;
    }
    
    getDesktopAppUrls(): any {
        return {win32: "", darwin: "", linux: ""};
    }
    
    isWebAccessEnabled(): boolean {
        return false;
    }
    
    getInstanceName(): string {
        return null;
    }
    
    markTokenAsUsed(_token: string): void {
    }
    
    markRegisterKeyAsUsed(_key: string): void {
    }
    
    changeLang(_lang: string): void {
    }
    
    getDefaultHost(): string {
        return null;
    }
    
    onDockedLoad(_window: BaseWindowController): void {
        throw new Error("onDockedLoad not implemented");
    }
    
    getClosestNotDockedController(): BaseWindowController {
        throw new Error("Application cannot be parent of docked window");
    }
    
    getStorage() {
        return this.storage;
    }
    
    onChildWindowClose(window: BaseWindowController): void {
        for (let name in this.windows) {
            if (this.windows[name] == window) {
                delete this.windows[name];
            }
        }
        Lang.removeFromList(this.openedWindows, window);
    }
    
    openSingletonWindow(name: string, controller: {new(app: app.WindowParent, params?: any): BaseWindowController} | BaseWindowController, params?: any): Q.Promise<BaseWindowController> {
        let registered = this.manager.getSingleton(name);
        
        if (registered) {
            if (registered.controller.nwin.isMinimized()) {
                registered.controller.nwin.minimizeToggle();
            }
            registered.controller.nwin.focus();
            registered.controller.reopenWithParams(params);
            return Q(registered.controller);
        }
        else {
            if (!this.hasNetworkConnection()) {
                return Q(null);
            }
            if (controller instanceof BaseWindowController) {
                let bwc = this.registerInstance(controller);
                bwc.open(name);
                return Q(bwc);
            }
            else {
                return this.ioc.create(controller, [this, params]).then(win => {
                    let bwc = this.registerInstance(win);
                    bwc.open(name);
                    return bwc;
                })
                .fail(e => { this.errorLog.errorCallback(e); return null; })
            }
        }
    }
    
    openSingletonWindowWithReturn(name: string, controller: {new(app: app.WindowParent, params?: any): BaseWindowController} | BaseWindowController, params?: any): Q.Promise<BaseWindowController> {
        return Q().then(() => {
            let registered = this.manager.getSingleton(name);
            
            if (registered) {
                if (registered.controller.nwin.isMinimized()) {
                    registered.controller.nwin.minimizeToggle();
                }
                registered.controller.nwin.focus();
                registered.controller.reopenWithParams(params);
                return registered;
            }
            else {
                if (!this.hasNetworkConnection()) {
                    return Q.reject<any>();
                }
                if (controller instanceof BaseWindowController) {
                    this.registerInstance(controller).open(name);
                    return controller;
                }
                else {
                    return this.ioc.create(controller, [this, params]).then(win => {
                        this.registerInstance(win).open(name);
                        return win;
                    })
                    .fail(this.errorLog.errorCallback);
                }
            }
    
        })
    }
    
    openDevConsole(): void {
        this.openSingletonWindow("devConsole", DevConsoleWindowController);
    }

    openSettings(section?: string): void {
        this.openSingletonWindow("settings", SettingsWindowController, section);
    }
    
    openAdmin(section?: string): void {
        this.openSingletonWindow("admin", AdminWindowController, section);
    }
    
    openAbout(): void {
        this.openSingletonWindow("about", AboutWindowController);
    }
    
    openSupport(): void {
        this.refreshUserConfig().then(() => {
            this.openSingletonWindow("support", SupportWindowController);
        });
    }
    
    refreshUserConfig() {
        return Q().then(() => {
            return this.mailClientApi.privmxRegistry.getSrpSecure();
        })
        .then(srpSecure => {
            return srpSecure.getUserConfig();
        })
        .then(userConfig => {
            this.serverConfigForUser = userConfig;
        })
        .fail(e => {
            Logger.error("Error during refreshing user config", e);
        });
    }
    
    openSwitchVoiceChatConfirm(): Q.Promise<boolean> {
        return Q().then(() => {
            return this.sessionManager.getLocalSession().mailClientApi.privmxRegistry.getUserPreferences()
            .then(userPreferences => {
                let withoutWarning = userPreferences.getValue(MailConst.SWITCH_VOICE_CHAT_SHOW_CONFIRM, false);
                if (!withoutWarning) {
                    return this.ioc.create(SwitchVoiceChatConfirmWindowController, [this])
                    .then(controller => {
                        let defer = Q.defer<boolean>();
                        controller.showModal(result => {
                            if (result == Result.OK) {
                                defer.resolve(true);
                            }
                            else {
                                defer.resolve(false);
                            }
                        });
                        return defer.promise;
                    });
                }
                else {
                    return Q.resolve(true);
                }
            })
        });
    }
    
    openFonts(): void {
        this.openSingletonWindow("fonts", FontsWindowController);
    }
    
    openSections(sectionId?: string, centerSection?: boolean): void {
        this.openSingletonWindow("sections", SectionsWindowController, sectionId).then((swc: SectionsWindowController) => {
            if (centerSection) {
                swc.centerSelectedSection();
            }
        });
    }
    
    openNotifications(): void {
        this.openSingletonWindow("notifications", NotificationsWindowController);
    }
    
    sendMail(options: ComposeWindowOptions): void {
        if (!this.hasNetworkConnection()) {
            return;
        }
        this.ioc.create(ComposeWindowController, [this, options]).then(composeWindow => {
            this.openChildWindow(composeWindow);
            composeWindow.nwin.focus();
        });
    }
    
    sendBlankMail(): void {
        this.sendMail({type: "blank"});
    }
    
    sendMailTo(receiver: string|privfs.message.MessageReceiver): void {
        this.sendMail({
            type: "predefined",
            receivers: [receiver]
        });
    }
    
    openUrl(url: string): void {
        if (Utils.startsWith(url, "hashmailto:")) {
            let hashmail = url.substring(11);
            this.sendMailTo(hashmail);
        }
        else if (Utils.startsWith(url, "mailto:")) {
            let email = url.substring(7);
            this.sendMailTo(email);
        }
        else {
            this.openExternalUrl(url);
        }
    }
    
    abstract openExternalUrl(url: string): void;
    
    abstract isSupportedHashmail(hashmail: string): boolean;
    
    abstract getSupportedHosts(): string[];
    
    abstract getTokenRegistrationUrl(token: string): string;
    
    setContainerWindowHistoryEntry(entry: app.HistoryEntry, _replace: boolean): void {
        if ("container" in this.windows) {
            (<ContainerWindowController>this.windows.container).onHistoryChange(entry);
        }
    }
    
    playAudio(_soundName: string, _force: boolean = false, _ignoreSilentMode: boolean = undefined): void {
    }
    
    onUserPreferencesChange(event: event.UserPreferencesChangeEvent): void {
        this.setWindowsTitleBarButtonsPosition(event.userPreferences.getValue<string>("ui.windowTitleBarButtonsPosition"));
        this.setAudioEnabled(event.userPreferences.getValue<boolean>("ui.audio"));
        this.setUiLang(event.userPreferences.getValue<string>("ui.lang"));
        this.setContextSwitching(event.userPreferences.getValue<boolean>("ui.contextSwitchWithoutShift", true));
        let screenCoverEnabled = event.userPreferences.getValue<boolean>(MailConst.UI_INACTIVITY_OVERLAY, UserPreferences.DEFAULTS.ui.inactivityOverlay);
        screenCoverEnabled ? this.startScreenCover() : this.stopScreenCover();
    }
    
    setWindowsTitleBarButtonsPosition(_position: string): void {
    }
    
    setAudioEnabled(_enabled: boolean): void {
    }
    
    setUiLang(_lang: string): void {
    }
    
    setContextSwitching(withoutShift: boolean) {
        this.needShiftToSwitchWithContext = !withoutShift;
    }
    
    switchModuleWithContext(): boolean {
        return (this.needShiftToSwitchWithContext && this.contextModifierPresent) || (!this.needShiftToSwitchWithContext && !this.contextModifierPresent);
    }
    
    resetModuleSwitchingModifier(): void {
        setTimeout(() => {
            this.contextModifierPresent = false;
        }, 100);
    }
    
    setNewCount(_newCount: number): void {
    }
    
    refreshAppTitle(): void {
    }
    
    abstract createContent(file: app.FileHandle): privfs.lazyBuffer.IContent;
    
    abstract openFile(parentWindow?: AppWindow): Q.Promise<privfs.lazyBuffer.IContent>;
    
    abstract openFiles(parentWindow?: AppWindow): Q.Promise<privfs.lazyBuffer.IContent[]>;
    
    chooseDirectory(_parentWindow?: AppWindow): Q.Promise<string> {
        return Q.reject();
    }
    
    downloadAttachment(session: Session, attachment: privfs.message.MessageAttachment, parent?: Types.app.WindowParentEx): Q.Promise<void> {
        if (!this.hasNetworkConnection()) {
            return;
        }
        let element = OpenableAttachment.create(attachment, true, true);
        return Q().then(() => {
            Logger.debug("shellOpen");
            let resolvedApp = this.app.shellRegistry.resolveApplicationByElement({element: element, session: session});
            if (resolvedApp.id == "core.unsupported") {
                this.app.shellRegistry.shellOpen({
                    action: ShellOpenAction.DOWNLOAD,
                    element: element,
                    session: session,
                    parent: parent
                });
                return;
            }
            let openOptions: ShellOpenOptions = {
                element: element,
                session: session
            }
            return this.shellRegistry.shellOpen(openOptions);
        })
        .fail(e => {
            if (e instanceof ShellUnsupportedError) {
                Logger.debug("openUnsupported");
                return this.downloadOpenableElement(element, session, parent);
            }
        });
    }
    
    downloadContent(session: Session, content: privfs.lazyBuffer.IContent, parent?: Types.app.WindowParentEx): Q.Promise<void> {
        if (!this.hasNetworkConnection()) {
            return;
        }
        let element= SimpleOpenableElement.create(content, true);
        return Q().then(() => {
            Logger.debug("shellOpen");
            let openOptions: ShellOpenOptions = {
                element: element,
                parent: parent,
                session: session
            }
            return this.shellRegistry.shellOpen(openOptions);
        })
        .fail(e => {
            if (e instanceof ShellUnsupportedError) {
                Logger.debug("openUnsupported");
                return this.downloadOpenableElement(element, session, parent);
            }
        });
    }
    
    downloadOpenableElement(element: OpenableElement, session: Session, parent?: Types.app.WindowParentEx, openDowloadWindow?: boolean): Q.Promise<void> {
        let showWindow = openDowloadWindow !== false && element.getSize() < CommonApplication.MIN_ATTACHMENT_SIZE_TO_OPEN_DOWNLOAD_WINDOW;
        let promise = Q().then(() => {
            return element.getContent();
        })
        .then(content => {
            return this.saveContent(content, session, parent);
        });
        if (showWindow) {
            this.ioc.create(DownloadAttachmentWindowController, [parent || this, {
                name: element.getName(),
                size: element.getSize()
            }])
            .then(win => {
                this.openChildWindow(win);
                win.whenReady().then(() => {
                    promise.progress(info => {
                        win.setDownloadProgress(info.percent);
                    });
                    promise.then(() => {
                        win.close(true);
                    });
                    promise.catch(() => {
                        win.close(true);
                    });
                });
            });
        }
        return promise;
    }
    
    abstract hasNetworkConnection(): boolean | Q.Promise<boolean>;
    
    abstract waitForConnection(): Q.Promise<void>;
    
    exportMessages(count: number, name: string, parent?: Types.app.WindowParentEx): Q.Promise<void> {
        return Q.all([
            this.mailClientApi.privmxRegistry.getExportMessagesService(),
            this.mailClientApi.privmxRegistry.getLastMessagesService()
        ])
        .then(res => {
            let [exportMessagesService, lastMessagesService] = res;
            return lastMessagesService.getTheOldestMessages(count).then(list => {
                return exportMessagesService.exportMessages(list, name);
            });
        })
        .then(content => {
            return this.saveContent(content, this.sessionManager.getLocalSession(), parent);
        });
    }
    
    abstract directSaveContent(content: privfs.lazyBuffer.IContent, session: Session, parent?: Types.app.WindowParentEx): Promise<void>;
    
    abstract async saveContent(content: privfs.lazyBuffer.IContent, session: Session, parent?: Types.app.WindowParentEx): Promise<void>;
    
    abstract getScreenResolution(currentInsteadOfPrimary?: boolean): {width: number, height: number};
    
    abstract getScreenResolutionString(): string;
    
    abstract getOs(): string;
    
    hasMaxFileSizeLimit(): boolean {
        return this.getMaxFileSizeLimit() != null;
    }
    
    getMaxFileSizeLimit(): number {
        return this.options.maxFileSize.value;
    }
    
    canPasteFile(_path: string): boolean {
        return false;
    }
    
    getFileBuffer(_path: string): Buffer {
        return null;
    }
    
    getFileName(_filePath: string): string {
        return null;
    }
    
    getFileMimeType(_filePath: string): string {
        return null;
    }
    
    abstract getNetworkStatus(): string;
    
    abstract networkIsDown(): boolean;
    
    abstract showOfflineError(): void;
    
    goBack(): void {
    }
    
    forceRestart(): void {
    }
    
    getViewLogLevel(): string {
        return this.viewLogLevel;
    }
    
    openMessage(parent: BaseWindowController, sinkIndexEntry: SinkIndexEntry) {
        this.ioc.create(MessageWindowController, [parent]).then(win => {
            this.registerInstance(win);
            win.setIndexEntry(sinkIndexEntry);
            parent.openChildWindow(win);
        });
    }
    
    closeAllWindows(): Q.Promise<void> {
        let promises: Q.Promise<any>[] = [];
        for (let name in this.windows) {
            if (this.unclosableWindowsName.indexOf(name) == -1) {
                let whenable = this.windows[name].close();
                promises.push(Q().then(() => whenable));
            }
        }
        this.openedWindows.forEach(x => {
            if (x) {
                let whenable = x.close();
                promises.push(Q().then(() => whenable));
            }
        });
        return Q.all(promises).then(() => {});
    }
    
    isQuitting(): boolean {
        return false;
    }
    
    onPollingResult(_entries: PollingItem[]) {
    }
    
    preventLinkOpenageInView(): boolean {
        return false;
    }
    
    getDefaultApplications(): ApplicationBinding[] {
        return [];
    }
    
    tryBringWindowToTop(options: ShellOpenOptions, winType: string) {
        let manager = this.getOpenedElementsManager();
        if (! manager.exists(options.element, winType)) {
            return false;
        }
        else {
            let toOpen = manager.getByElementAndWindowType(options.element, winType);
            try {
                setTimeout(() => {
                    let nwin = (<BaseWindowController>toOpen.window).nwin;
                    if (! nwin) {
                        return;
                    }
                    if (nwin.isMinimized()) {
                        nwin.minimizeToggle();
                    }
                    nwin.focus();
                }, 100);
            } catch (e) {
                return false;
            }
            return true;
        }
    }
    
    bringMainWindowToTop(): void {
    }
    
    allowMultipleInstances(): boolean {
        return false;
    }
    
    registerViewersEditors() {
        MimeTypeTree.add(".url", "application/internet-shortcut");
        MimeTypeTree.add(".ts", "text/x-typescript");
        
        this.shellRegistry.registerMimetypeIcon("image/*", "fa fa-file-image-o");
        this.shellRegistry.registerMimetypeIcon("video/*", "fa fa-file-video-o");
        this.shellRegistry.registerMimetypeIcon("audio/*", "fa fa-music");
        this.shellRegistry.registerMimetypeIcon("text/plain", "fa fa-file-text-o");
        this.shellRegistry.registerMimetypeIcon("application/zip", "fa fa-file-archive-o");
        this.shellRegistry.registerMimetypeIcon("application/x-rar-compressed", "fa fa-file-archive-o");
        this.shellRegistry.registerMimetypeIcon("application/x-7z-compressed", "fa fa-file-archive-o");
        this.shellRegistry.registerMimetypeIcon("application/x-httpd-php", "fa fa-file-code-o");
        this.shellRegistry.registerMimetypeIcon("application/javascript", "fa fa-file-code-o");
        this.shellRegistry.registerMimetypeIcon("application/pdf", "privmx-icon privmx-icon-pdf");
        this.shellRegistry.registerMimetypeIcon("application/msword", "fa fa-file-word-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "fa fa-file-word-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.oasis.opendocument.text", "fa fa-file-word-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.ms-excel", "fa fa-file-excel-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "fa fa-file-excel-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.oasis.opendocument.spreadsheet", "fa fa-file-excel-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.ms-powerpoint", "fa fa-file-powerpoint-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.openxmlformats-officedocument.presentationml.presentation", "fa fa-file-powerpoint-o");
        this.shellRegistry.registerMimetypeIcon("application/vnd.oasis.opendocument.presentation", "fa fa-file-powerpoint-o");
        this.shellRegistry.registerMimetypeIcon("application/internet-shortcut", "fa fa-ellipsis-h");
        this.shellRegistry.registerMimetypeIcon("application/x-mswinurl", "fa fa-ellipsis-h");
        
        this.shellRegistry.registerAppEx({
            id: "core.audio",
            
            open: options => {
                return this.ioc.create(AudioWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.image",
            open: options => {
                return this.ioc.create(ImageWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.image.editor",
            open: options => {
                return this.ioc.create(ImageEditorWindowController, [options.parent, options.session, {
                    docked: options.docked,
                    editMode: true,
                    openableElement: options.element
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.mindmap.editor",
            open: options => {
                return this.ioc.create(MindmapEditorWindowController, [options.parent, options.session, {
                    openableElement: options.element,
                    docked: options.docked,
                    editMode: options.action != ShellOpenAction.PREVIEW && options.action != ShellOpenAction.PRINT,
                    newFile: false,
                    preview: options.action == ShellOpenAction.PREVIEW,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.video",
            
            open: options => {
                return this.ioc.create(VideoWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.url",
            open: options => {
                return this.ioc.create(UrlWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.pdf",
            open: options => {
                return this.ioc.create(PdfWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerAppEx({
            id: "core.unsupported",
            open: options => {
                return this.ioc.create(UnsupportedWindowController, [options.parent, options.session, {
                    entry: options.element,
                    docked: options.docked,
                    action: options.action,
                }]);
            }
        });
        
        this.shellRegistry.registerApp({
            id: "core.download",
            open: options => {
                Q().then(() => {
                    if (options.action == ShellOpenAction.DIRECT_DOWNLOAD) {
                        return this.directSaveContent(options.element, options.session, options.parent);
                    }
                    return this.saveContent(options.element, options.session, options.parent);
                })
                .fail(e => {
                    if (e != "no-choose") {
                        Logger.warn("Error during downloading", e);
                    }
                });
                return null;
            }
        });
        
        this.shellRegistry.registerApplicationBinding({applicationId: "core.audio", mimeType: "audio/*"});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.image", mimeType: "image/*"});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.video", mimeType: "video/*"});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.image.editor", mimeType: "image/*", action: ShellOpenAction.OPEN});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.mindmap.editor", mimeType: "application/x-smm"});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.mindmap.editor", mimeType: "application/x-smm", action: ShellOpenAction.EXTERNAL});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.video", mimeType: "video/*", action: ShellOpenAction.OPEN});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.url", mimeType: "application/internet-shortcut"});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.pdf", mimeType: "application/pdf"});
        
        this.shellRegistry.registerApplicationBinding({applicationId: "core.unsupported", mimeType: "*"});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.download", mimeType: "*", action: ShellOpenAction.DOWNLOAD});
        this.shellRegistry.registerApplicationBinding({applicationId: "core.download", mimeType: "*", action: ShellOpenAction.DIRECT_DOWNLOAD});
        
        let defaultApplications = this.getDefaultApplications();
        if (defaultApplications) {
            defaultApplications.forEach(x => {
              x.default = true;
              this.shellRegistry.registerApplicationBinding(x);
            });
        }
        
        this.shellRegistry.registerAppAction(<ShellAppActionOptions>{
            id: "core.upload",
            type: ShellActionType.CREATE,
            labelKey: "app.core.actions.upload",
            icon: "fa fa-upload",
            overwritesName: true,
            onCall: (_filename?: string, parentWindow?: AppWindow) => {
                return this.app.openFile(parentWindow);
            }
        });
        
        this.shellRegistry.registerAppAction(<ShellAppActionOptions>{
            id: "core.upload-multi",
            type: ShellActionType.CREATE,
            labelKey: "app.core.actions.upload-multi",
            icon: "fa fa-upload",
            overwritesName: true,
            onCallMulti: (_filenames?: string[], parentWindow?: AppWindow) => {
                return this.app.openFiles(parentWindow);
            }
        });
    }
    
    screenCapture(): Q.Promise<ImageEditorWindowController> {
        return null;
    }
    
    getSystemCliboardData(_skipCheck: boolean = false): ClipboardData {
        return null;
    }
    
    setSystemCliboardData(_data: ClipboardData): Q.Promise<boolean> {
        return Q(null);
    }
    
    getSystemClipboardFiles(): { mime: string, data: Buffer, path?: string }[] {
        return [];
    }
    
    getOpenedElementsManager() {
        return this.openedElementsManager;
    }
    
    sendFile(options: app.SendFileOptions): void {
        let parent = options.parent || this;
        let errorLog = options.errorLog || this.errorLog;
        this.ioc.create(SelectContactsWindowController, [parent, options.options || {
            message: this.localeService.i18n("app.sendFile.send"),
            hashmails: [],
            editable: true,
            allowSections: true,
            allowUserGroups: true,
        }])
        .then(win => {
            parent.openChildWindow(win);
            win.getPromise().then(res => {
                if (!res && res.length == 0) {
                    return;
                }
                let notificationId = options.notifications ? options.notifications.showNotification(this.localeService.i18n("app.sendFile.sending"), {autoHide: false, progress: true}) : null;
                let data: privfs.lazyBuffer.IContent;
                let dstSection: section.SectionService;
                Q.all([
                    this.app.mailClientApi.privmxRegistry.getConv2Service(),
                    this.app.mailClientApi.privmxRegistry.getSectionManager(),
                    Q().then(() => options.getData())
                ])
                .then(result => {
                    let [conv2Service, sectionManager] = result;
                    data = result[2];
                    if (res.length == 1) {
                        let id = res[0];
                        let section = sectionManager.filteredCollection.find(x => x.getId() == id);
                        if (section) {
                            return section;
                        }
                        let c2s = conv2Service.collection.find(x => x.id == id);
                        if (c2s) {
                            section = c2s.section;
                            if (section) {
                                return section;
                            }
                        }
                    }
                    let usernames = conv2Service.getUsersFromHashmails(res);
                    let conv2Section = conv2Service.getOrCreateConv(usernames, true);
                    if (!conv2Section.hasSection()) {
                        return conv2Service.createUserGroup(usernames);
                    }
                    return conv2Section.section;
                })
                .then(section => {
                    dstSection = section;
                    if (options.sourceSectionId && options.sourceSectionId == section.getId()) {
                        return this.msgBox.confirmEx({
                            width: 600,
                            title: this.localeService.i18n("app.sendFile.sameLocationInfo.title"),
                            message: this.localeService.i18n("app.sendFile.sameLocationInfo.message"),
                            yes: {
                                visible: true,
                                label: this.localeService.i18n("app.sendFile.sameLocationInfo.button.yes"),
                            },
                            no: {
                                visible: true,
                                label: this.localeService.i18n("app.sendFile.sameLocationInfo.button.no"),
                            },
                            cancel: {
                                visible: true,
                                label: this.localeService.i18n("app.sendFile.sameLocationInfo.button.cancel"),
                            },
                        })
                        .then(result => {
                            if (result.result == "yes") {
                                return app.SendFileSameLocationAction.UPLOAD_FILE;
                            }
                            else if (result.result == "no") {
                                return app.SendFileSameLocationAction.ONLY_SEND_CHAT_MESSAGE;
                            }
                            else {
                                return app.SendFileSameLocationAction.CANCEL;
                            }
                        });
                    }
                    else {
                        return app.SendFileSameLocationAction.UPLOAD_FILE;
                    }
                })
                .then(action => {
                    if (action == app.SendFileSameLocationAction.UPLOAD_FILE) {
                        return dstSection.uploadFile({
                            data: data,
                        });
                    }
                    else if (action == app.SendFileSameLocationAction.ONLY_SEND_CHAT_MESSAGE) {
                        return dstSection.getChatModule().sendCreateFileMessage(options.sourcePath, data.getSize(), data.getMimeType(), options.sourceDid).thenResolve(null);
                    }
                })
                .fail(e => {
                    if (e instanceof Exception && e.message == "invalid-receivers") {
                        let msg = this.localeService.i18n("app.sendFile.invalidReceivers", [e.data.join(", ")]);
                        return errorLog.onErrorCustom(msg, e);
                    }
                    let error = MailUtils.getMessagePostError(this.localeService, e);
                    return errorLog.onErrorCustom(error.msg, e);
                })
                .fin(() => {
                    options.notifications ? options.notifications.hideNotification(notificationId) : null;
                });
            });
        });
    }
    
    getPlayerManager(): PlayerManager {
        return (<PlayerHelperWindowController>this.windows.playerHelper).playerManager;
    }
    
    isPrintable(mimeType: string): boolean {
        let printableMimeTypes = [
            "application/pdf",
            "application/x-stt",
            "application/x-smm",
            "image/png",
            "image/jpeg",
        ];
        return printableMimeTypes.indexOf(mimeType) >= 0;
    }
    
    canSaveAsPdf(mimeType: string): boolean {
        let saveableAsPdfMimeTypes = [
            "application/x-stt",
            "application/x-smm",
        ];
        return saveableAsPdfMimeTypes.indexOf(mimeType) >= 0;
    }
    
    warnExperimentalPrint(): Q.Promise<boolean> {
        return this.msgBox.confirmEx({
            title: this.localeService.i18n("app.printing.experimentalWarning.title"),
            message: this.localeService.i18n("app.printing.experimentalWarning.message"),
            yes: {
                visible: true,
                label: this.localeService.i18n("app.printing.experimentalWarning.button.yes"),
            },
            no: {
                visible: true,
                label: this.localeService.i18n("app.printing.experimentalWarning.button.no"),
            },
        })
        .then(result => {
            return result.result == "yes";
        });
    }
    
    print(session: Session, file: OpenableElement, parentController?: app.WindowParentEx): Q.Promise<boolean> {
        return this.warnExperimentalPrint().then(printInPrivMx => {
            if (!printInPrivMx) {
                return false;
            }
            
            return this.shellRegistry.shellOpen({
                element: file,
                action: ShellOpenAction.PRINT,
                parent: parentController,
                session: session
            }).then(wnd => {
                return wnd.prepareToPrint(true).then(() => {
                    wnd.print();
                }).then(() => {
                    return wnd.afterPrinted.promise;
                }).then(res => {
                    wnd.manager.stateChanged(BaseWindowManager.STATE_IDLE);
                    return res;
                });
            });
        });
    }
    
    abstract saveAsPdf(session: Session, file: OpenableElement, parentWindow?: AppWindow): Q.Promise<void>;
    
    useCustomizedTheme(theme: CustomizationData, onlyIfDifferent: boolean = false): void {
        if (onlyIfDifferent && this.customizedTheme) {
            let diff = false;
            for (let k in this.customizedTheme) {
                if ((<any>this.customizedTheme)[k] != (<any>theme)[k]) {
                    diff = true;
                    break;
                }
            }
            if (!diff) {
                return;
            }
        }
        this.isUsingTemporaryCustomizedTheme = false;
        this.customizedTheme = theme;
        this.propagateCustomizedTheme(this.customizedTheme);
    }
    
    useTemporaryCustomizedTheme(theme: CustomizationData): void {
        this.isUsingTemporaryCustomizedTheme = true;
        this.temporaryCustomizedTheme = theme;
        this.propagateCustomizedTheme(this.temporaryCustomizedTheme);
    }
    
    restoreCustomizedTheme(): void {
        this.propagateCustomizedTheme(this.customizedTheme);
    }
    
    propagateCustomizedTheme(theme: CustomizationData): void {
        if (!theme.cssVariables) {
            theme.cssVariables = CssParser.parseVariables(theme.css).cssVars;
        }
        this.manager.propagateCustomizedTheme(theme);
    }
    
    readCustomTheme(): void {
    }
    
    saveCustomTheme(): void {
    }
    
    getAppTitle(): string {
        return this.customizedTheme && this.customizedTheme.title ? this.customizedTheme.title : "PrivMX";
    }
    
    openNewSectionDialogFromSidebar(parent?: BaseWindowController): void {
        let sectionId: string;
        this.app.ioc.create(SectionPickerWindowController, [this, null, {title: this.localeService.i18n("app.pickParentSection")}]).then(win => {
            if (parent) {
                win.parent = parent;
            }
            this.openChildWindow(win).getSectionPromise().then(section => {
                sectionId = section ? section.getId() : null;
                return this.app.mailClientApi.privmxRegistry.getSectionManager()
            })
            .then(manager => {
                
                this.app.ioc.create(SectionNewWindowController, [this, {
                    parentId: sectionId,
                    manager: manager
                }])
                .then(win => {
                    return this.openChildWindow(win);
                });
            });
        });
    }
    
    openEditSectionDialogFromSidebar(sectionId: string): void {
        this.openSections(sectionId, true);
    }
    
    openLicenceWindow(onStartup?: boolean, afterUpdate?: boolean): void {
        let lang = this.localeService.currentLang;
        
        if (!lang) {
            lang = this.localeService.defaultLang;
        }
        let licencePath = this.app.assetsManager.getAsset("assets/licence_" + lang + ".html", this.app.isElectronApp());
        let fileHandle: any;
        if (this.isElectronApp()) {
            fileHandle = {path: licencePath, handleType: "electron", mimeType: null};
        }
        else {
            fileHandle = {file: {path: licencePath}, handleType: "browser"};
        }
        let task = this.app.createContent(fileHandle);
        Q().then(() => {
            let element = new SimpleOpenableElement(task);
            if (! onStartup) {
                this.app.ioc.create(LicenceWindowController, [this, {
                    entry: element,
                    docked: false,
                    onStartup: onStartup
                }]).then(win => {
                    return this.openChildWindow(win);
                });
            }
            else {
                this.app.ioc.create(LicenceWindowController, [this, {
                    entry: element,
                    docked: false,
                    onStartup: onStartup
                }]).then(win => {
                    win.getUserActionCallback()
                    .then(() => {
                        this.acceptLicence(afterUpdate);
                    })
                    .fail(() => {
                        this.exitApp();
                        
                    })
                    return this.openChildWindow(win);
                });
                
            }
            
        })
    }
    
    openLicenseVendorsWindow(): void {
    }
    
    openErrorWindow(_error: any): void {
    }

    reportToSentry(error: any): void {}
    
    getHelpCenterUrl(helpCenterCode: number): string {
        return "http://127.0.0.1/PrivMXHelpCenter/" + helpCenterCode;
    }
    
    log(..._entry: string[]): void {
    }
    
    exitApp(): void {
    }
    
    acceptLicence(_afterUpdate?: boolean): void {
    }
    
    setLoginInfoHidden(): void {}
    
    isLoginInfoVisible(): boolean {
        return true;
    }
    
    isProfileUsed(_profile: string): Q.Promise<boolean> {
        return Q.resolve(false);
    }
    
    registerProfile(_profile: string): Q.Promise<void> {
        return Q.resolve();
    }
    
    unregisterProfile(_profile: string): Q.Promise<void> {
        return Q.resolve();
    }
    
    getCcApiEndpoint(): string {
        return null;
    }
    
    areTryMarkAsReadEventEqual(a: event.TryMarkAsReadEvent, b: event.TryMarkAsReadEvent): boolean {
        if (a.conversationId != b.conversationId) {
            return false;
        }
        if (a.customElementId != b.customElementId) {
            return false;
        }
        if (a.sectionId != b.sectionId) {
            return false;
        }
        if (a.moduleName != b.moduleName) {
            return false;
        }
        return true;
    }
    
    onTryMarkAsRead(event: event.TryMarkAsReadEvent): void {
        let action: UnreadBadgeClickAction = this.userPreferences.getUnreadBadgeClickAction();
        Q().then(() => {
            if (action == UnreadBadgeClickAction.ASK) {
                let openConfirms = this.openTryMarkAsReadConfirms.filter(x => this.areTryMarkAsReadEventEqual(x.event, event))[0];
                if (openConfirms) {
                    if (openConfirms.window) {
                        openConfirms.window.focus();
                    }
                    return false;
                }
                let confirmData: { event: event.TryMarkAsReadEvent, window: Window } = { event, window: null };
                this.openTryMarkAsReadConfirms.push(confirmData);
                let allModules = !event.moduleName;
                let inSection = !!event.sectionId;
                let inConversation = !!event.conversationId;
                let trashed = event.customElementId == "trash";
                let createdByMe = event.customElementId == "tasks-created-by-me";
                let assignedToMe = event.customElementId == "tasks-assigned-to-me";
                let msgKey: string;
                let moduleKey: string = allModules
                    ? "all"
                    : { chat: "chats", notes2: "files", tasks: "tasks", }[event.moduleName];
                let filterKey: string = "";
                if (createdByMe) {
                    filterKey = "CreatedByMe";
                }
                else if (assignedToMe) {
                    filterKey = "AssignedToMe";
                }
                else if (trashed) {
                    filterKey = "Trashed";
                }
                else if (inSection) {
                    filterKey = "InSection";
                }
                else if (inConversation) {
                    filterKey = "InConversation";
                }
                else {
                    filterKey = "Everywhere";
                }
                msgKey = "markAsReadConfirmation.message." + moduleKey + filterKey;
                let msgTr = this.app.localeService.i18n(msgKey);
                if (msgTr == msgKey) {
                    msgTr = this.app.localeService.i18n("markAsReadConfirmation.message.default");
                }
                return this.msgBox.confirmEx({
                    message: msgTr,
                    width: 550,
                    height: 170,
                    yes: {
                        visible: true,
                    },
                    no: {
                        visible: true,
                    },
                    checkbox: {
                        label: this.app.localeService.i18n("markAsReadConfirmation.checkbox.label"),
                        checked: false,
                        visible: true,
                    },
                    onWindowCreated: nwin => {
                        confirmData.window = nwin;
                    },
                    info: this.app.localeService.i18n("markAsReadConfirmation.message.extraInfo"),
                    infoBelowButtons: true,
                })
                .then(result => {
                    let markAsRead = result.result == "yes";
                    if (result.checked) {
                        this.userPreferences.set(MailConst.UI_UNREAD_BADGE_CLICK_ACTION, markAsRead ? UnreadBadgeClickAction.MARK_AS_READ : UnreadBadgeClickAction.IGNORE, true);
                    }
                    return markAsRead;
                })
                .fin(() => {
                    this.openTryMarkAsReadConfirms = this.openTryMarkAsReadConfirms.filter(x => !this.areTryMarkAsReadEventEqual(x.event, event));
                });
            }
            else if (action == UnreadBadgeClickAction.IGNORE) {
                return false;
            }
            else if (action == UnreadBadgeClickAction.MARK_AS_READ) {
                return true;
            }
        })
        .then(markAsRead => {
            if (markAsRead) {
                this.dispatchEvent<event.MarkAsReadEvent>({
                    type: "mark-as-read",
                    sectionId: event.sectionId,
                    conversationId: event.conversationId,
                    customElementId: event.customElementId,
                    moduleName: event.moduleName,
                    hostHash: event.hostHash
                });
                this.playBubblePopSoundOnNextSetBubblesStateEvent = true;
            }
        });
    }
    
    tryPlayBubblePopSound(): void {
        if (this.playBubblePopSoundOnNextSetBubblesStateEvent && !this.getSilentMode() && this.userPreferences.getPlayBubblePopSound()) {
            this.playBubblePopSoundOnNextSetBubblesStateEvent = false;
            setTimeout(() => {
                this.playAudio("unreadBadgeClick", true);
            }, 50);
        }
    }
    
    isRunningInDevMode(): boolean {
        return false;
    }
    
    isFirstLogin(userPreferences: UserPreferences): boolean {
        if (userPreferences) {
            let seen = this.userPreferences.getValue("ui.seenFirstLoginInfo", 0);
            return seen ? false : true;
        }
        else {
            throw new Error("Cannot call isFirstLogin with userPreferences == undefined");
        }
    }
    
    tryPasteFiles(_paths: string[]): Q.Promise<boolean> {
        return Q.reject();
    }
    
    tryPasteImageData(): Q.Promise<boolean> {
        return Q.reject();
    }
    
    getPlatform(): string {
        return "";
    }
    
    get mailClientApi() {
        return this.sessionManager && this.sessionManager.hasLocalSession() ? this.sessionManager.getLocalSession().mailClientApi: null;
    }
    
    setSilentMode(value: boolean) {
        this.userPreferences.set(MailConst.UI_APP_SILENT_MODE, value, true);
        (<HelperWindowController>this.windows.helper).setSilentMode(value);
    }
    
    getSilentMode(): boolean {
        if (this.userPreferences) {
            return this.userPreferences.getValue(MailConst.UI_APP_SILENT_MODE, false);
        }
        else {
            return false;
        }
    }
    
    getClipboardElementToPaste(_allowedPrivMxFormats: string[], _allowedSystemFormats: string[], _onlyPlainText: boolean = false): Q.Promise<ClipboardElement> {
        this.clipboard.populateFromSystem();
        let elementPrivMx: ClipboardElement = null;
        let elementSystem: ClipboardElement = null;
        let elementPrivMxId: number = null;
        let elementSystemId: number = null;
        for (let i = this.clipboard.storedElements.length - 1; i >= 0 && (elementPrivMx === null || elementSystem === null); --i) {
            let el = this.clipboard.storedElements[i];
            if (el.source == "privmx" && elementPrivMx === null) {
                for (let format of _allowedPrivMxFormats) {
                    if (this.clipboard.elementMatches(el, format, "privmx")) {
                        elementPrivMx = el;
                        elementPrivMxId = i;
                        break;
                    }
                }
            }
            if (el.source == "system" && elementSystem === null) {
                for (let format of _allowedSystemFormats) {
                    if (this.clipboard.elementMatches(el, format, "system")) {
                        elementSystem = el;
                        elementSystemId = i;
                        break;
                    }
                }
            }
        }
        if (elementPrivMx === null && elementSystem === null) {
            return Q(null);
        }
        let element: ClipboardElement = null;
        // let integrationEnabled: boolean = false;
        return Q().then(() => {
            if (elementSystem && (!elementPrivMx || elementSystemId > elementPrivMxId)) {
                // return this.tryAskSystemClipboardIntegration().then(integration => {
                //     integrationEnabled = integration;
                //     if (integration) {
                //         return elementSystem;
                //     }
                //     else {
                //         return elementPrivMx;
                //     }
                // });
                return elementSystem;
            }
            else {
                return elementPrivMx;
            }
        }).then(_element => {
            if (!_element) {
                return null;
            }
            element = _element;
            let filesStr: string = element.data[Clipboard.FORMAT_SYSTEM_FILES];
            if (filesStr && !_onlyPlainText) {
                let files: { path?: string, mime: string }[] = JSON.parse(filesStr);
                if (files.filter(x => !x.path).length == 0) {
                    return this.app.tryPasteFiles(files.map(x => x.path));
                }
                else if (files.length == 1 && (<any>files[0].mime).startsWith("image/")) {
                    return this.app.tryPasteImageData();
                }
            }
            return true;
        })
        .then(paste => {
            if (paste === null) {
                return null;
            }
            if (paste === false) {
                let el = JSON.parse(JSON.stringify(element));
                el.data = {
                    text: el.data.text,
                };
                return el.data.text ? el : null;
            }
            return element;
        });
    }
    
    generateUniqueFileName(section: section.SectionService|"local", path: string, ext: string): Q.Promise<string> {
        if (!(<any>ext).startsWith(".")) {
            ext = "." + ext;
        }
        let formatNum = (x: number, n: number = 2) => {
            return (<any>x.toString()).padStart(n, "0");
        };
        let now = new Date();
        let y = now.getFullYear();
        let m = formatNum(now.getMonth() + 1);
        let d = formatNum(now.getDate());
        let h = formatNum(now.getHours());
        let i = formatNum(now.getMinutes());
        let s = formatNum(now.getSeconds());
        let proposedFileNames: string[] = [];
        proposedFileNames.push(`${y}-${m}-${d}${ext}`);
        proposedFileNames.push(`${y}-${m}-${d}-${h}-${i}${ext}`);
        proposedFileNames.push(`${y}-${m}-${d}-${h}-${i}-${s}${ext}`);
        return Q().then(() => {
            if (section == "local") {
                return this.listLocalFiles(path);
            }
            else {
                return section.getFileSystem().then(fileSystem => {
                    return fileSystem.list(path);
                })
                .then(entries => {
                    return entries.map(x => x.name);
                });
            }
        })
        .then(filesList => {
            for (let fileName of proposedFileNames) {
                if (filesList.indexOf(fileName) < 0) {
                    return fileName;
                }
            }
            for (let i = 1; i < 1000; ++i) {
                let fileName = `${y}-${m}-${d}-${h}-${i}-${s}(${i})${ext}`;
                if (filesList.indexOf(fileName) < 0) {
                    return fileName;
                }
            }
            return null;
        });
    }
    
    listLocalFiles(_path: string): string[] {
        return [];
    }
    
    openOrderInfo() {
        return Q().then(() => {
            return this.mailClientApi.privmxRegistry.getSrpSecure()
        })
        .then(srpSecure => {
            return WebCCApi.getControlCenterToken(srpSecure.gateway, WebCCApi.CONTROL_CENTER_TOKEN_CURRENT_ORDER)
            .then(res => {
                this.openUrl(res.url);
            })
            .fail(e => {
                Logger.error(e);
            });
        })
    }
    
    updatePaymentStatus(): Q.Promise<void> {
        return Q().then(() => {
            return Q.all([
                this.mailClientApi.privmxRegistry.getUtilApi(),
                this.mailClientApi.privmxRegistry.getIdentityProvider(),
                this.mailClientApi.privmxRegistry.getSrpSecure(),
            ])
        })
        .then(res => {
            let [utilApi, identityProvider, srpSecure] = res;
            
            if (! this.serverConfigForUser.dataCenterEnabled) {
                return null;
            }
            if (identityProvider.isAdmin()) {
                return Q.all([
                    utilApi.getFullPaymentStatus(),
                    srpSecure.getUser(identityProvider.getIdentity().user)
                ])
                .then(res2 => {
                    let [ps, user] = res2;
                    let dcUser: {id: string, login: string} = (<any>user).dataCenterUser ? (<any>user).dataCenterUser : null;
                    let trialStatusUpdate: event.TrialStatusUpdateEvent = {
                        type: "trial-status-update",
                        isAdmin: identityProvider.isAdmin(),
                        subscriptionEnding: ps.subscriptionEnding,
                        trial: ps.free,  // free znaczy tutaj czy server jest na trialowym okresie.. troche nieszczesna ta nazwa schodzi z serwera
                        startDate: Number(ps.startDate),
                        endDate: ps.endDate ? Number(ps.endDate) : -1,
                        expired: ps.expired,
                        hasExtendOrder: ps.hasExtendOrder,
                        maxUsers: (ps.serverParams.users as number),
                        totalStorage: (ps.serverParams.storage as string),
                        orderId: (ps.order as string),
                        dataCenterUser: dcUser
                    }
                    this.dispatchEvent<event.TrialStatusUpdateEvent>(trialStatusUpdate);
                })
            }
            else {
                return utilApi.getPaymentStatus()
                .then(ps => {
                    let trialStatusUpdate: event.TrialStatusUpdateEvent = {
                        type: "trial-status-update",
                        isAdmin: identityProvider.isAdmin(),
                        trial: ps.free,
                        expired: ps.expired,
                        subscriptionEnding: ps.subscriptionEnding,
                        endDate: ps.endDate ? Number(ps.endDate) : -1,
                        hasExtendOrder: ps.hasExtendOrder,
                    }
                    this.dispatchEvent<event.TrialStatusUpdateEvent>(trialStatusUpdate);
                });
            }
        })
        .fail(e => {
            Logger.warn("Payment status update failed", e);
        })
    }
    
    startPaymentStatusUpdater(): void {
        if (this.paymentStatusUpdater) {
            clearInterval(this.paymentStatusUpdater);
        }
        this.paymentStatusUpdater = setInterval(() => {
            this.updatePaymentStatus();
        }, 60 * 10000);
    }
    
    stopPaymentStatusUpdater(): void {
        if (this.paymentStatusUpdater) {
            clearInterval(this.paymentStatusUpdater);
        }
    }
    
    abstract startScreenCover(): void;
    abstract stopScreenCover(): void;
    
    sendActivationData(_username: string, _temporaryPassword: string, _email?: string, _newAccount?: boolean): void {
    }
    
    getNotificationTitleMaxLength(): number {
        return 40;
    }
    
    getNotificationTitleEllipsis(): string {
        return " ...";
    }
    
    zoomIn(): void {
        let zoomLevelId = Math.min(this.zoomLevels.length - 1, this.zoomLevelId + 1);
        this.setZoomLevelId(zoomLevelId);
    }
    
    zoomOut(): void {
        let zoomLevelId = Math.max(0, this.zoomLevelId - 1);
        this.setZoomLevelId(zoomLevelId);
    }
    
    resetZoom(): void {
        let zoomLevelId = this.defaultZoomLevelId;
        this.setZoomLevelId(zoomLevelId);
    }
    
    setZoomLevelId(zoomLevelId: number): void {
        if (this.zoomLevelId == zoomLevelId) {
            return;
        }
        this.zoomLevelId = zoomLevelId;
        let zoomLevel = this.zoomLevels[this.zoomLevelId];
        this.app.dispatchEvent<event.AllWindowsMessage>({
            type: "all-windows-message",
            message: "set-zoom-level",
            extra: JSON.stringify({ zoomLevel: zoomLevel }),
        });
    }
    
    prepareHtmlMessageBeforeSending(text: string, session: Session): Q.Promise<string> {
        // TODO: sprawdzic po co wolane jest getLocalSession, skoro session ma przychodzic wlasciwe w parametrze
        let { metaData, html } = ContentEditableEditorMetaData.extractMetaFromHtml(text);
        return Q.all([
            this.app.mailClientApi.privmxRegistry.getSectionManager(),
            this.app.mailClientApi.privmxRegistry.getConv2Service(),
        ]).then(([sectionManager]) => {
            if (!session) {
                session = this.app.sessionManager.getLocalSession();
            }
            if (session && session.sectionManager) {
                sectionManager = session.sectionManager;
            }
            let proms: Q.Promise<void>[] = [];
            if (!metaData.filePickerData) {
                metaData.filePickerData = [];
            }
            for (let match of ContentEditableEditorMetaData.parseFileTags(html)) {
                if (metaData.filePickerData.filter(x => x.userFriendlyId == match.text).length == 0) {
                    let parsedTag = ContentEditableEditorMetaData.parseFileTag(match.text);
                    if (!parsedTag) {
                        Logger.warn("Invalid file tag", match.text);
                        continue;
                    }
                    let { fullSectionName, path } = parsedTag;
                    let section = sectionManager.sectionsCollection.find(x => x.getFullSectionName(false, false, true) == fullSectionName);
                    if (section) {
                        proms.push(section.getFileTree().then(tree => {
                            let entry = tree.collection.find(x => x.path == path);
                            if (entry) {
                                let data: FilePickerData = {
                                    did: entry.ref.did,
                                    elementId: entry.id,
                                    icon: this.shellRegistry.resolveIcon(MimeTypeTree.resolve(entry.path)),
                                    userFriendlyId: match.text,
                                    sessionHost: session.host,
                                };
                                metaData.addFilePickerData(data);
                            }
                        }));
                    }
                }
            }
            return Q.all(proms);
        })
        .then(() => {
            return metaData.attach(html);
        });
    }
    
    getTmpAbsolutePath(): string {
        return null;
    }
    
    writeTemplateFile(_name: string, _html: string): void {
    }
    
    readTemplateFile(_name: string): string {
        return null;
    }
    
    getRenderedTemplateUrl(_name: string): string {
        return null;
    }
    
    async askForMicrophoneAccess(): Promise<boolean> {
        return true;
    }

    async askForCameraAccess(): Promise<boolean> {
        return true;
    }

    async openMacOSSystemPreferencesWindow(pane: string, section?: string): Promise<void> {
        return;
    }

    getSystemPlatfrom(): string {
        return "";
    }
    
    registerStreamsEvents(eventDispatcher: EventDispatcher): void {
        (<PlayerHelperWindowController>this.windows.playerHelper).registerStreamsEvents(eventDispatcher);
    }
    
    getUsersListTooltipContent(session: Session, sectionId: string): string {
        let users = session.webSocketNotifier.getVoiceChatCachedUsers(session, sectionId);
        return JSON.stringify({
            persons: WebSocketNotifier.getListeningPeople(session, sectionId, users)
        });
    }
    
    getAssetSafeUrl(path: string) {
        return this.assetsManager.getAsset(path);
    }

    reportToSentryOnErrorCallback(e: any): void {}

    getGPUInfo(): any {
    }
    
    abstract getEnviromentLocale(): string;

    abstract getInMemoryCacheSize(): number;

    protected abstract setSentryEnabled(enabled: boolean): void;
}
