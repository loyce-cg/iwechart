import {CommonApplication} from "./app/common/CommonApplication";
import {ViewManager} from "./app/common/ViewManager";
import {BaseWindowController} from "./window/base/BaseWindowController";
import {Model} from "./utils/Model";
import {SubRaw, Settings} from "./utils/Settings";
import * as privfs from "privfs-client";
import {MailClientViewHelper} from "./web-utils/MailClientViewHelper";
import {Template} from "./web-utils/template/Template";
import {TemplateManager} from "./web-utils/template/Manager";
import {Container} from "./utils/Container";
import {MessageWindowController} from "./window/message/MessageWindowController";
import {Starter} from "./window/base/Starter";
import {ComponentView} from "./component/base/ComponentView";
import {SinkIndexEntry} from "./mail/SinkIndexEntry";
import * as shelltypes from "./app/common/shell/ShellTypes";
import {Options as SelectContactsWindowOptions} from "./window/selectcontacts/SelectContactsWindowController";
import {NotificationController} from "./component/notification/NotificationController";
import {ErrorLog} from "./app/common/ErrorLog";
import {SectionService} from "./mail/section/SectionService";
import {SinkIndex, PollingItem} from "./mail/SinkIndex";
import {LowUser} from "./mail/LowUser";
import {Profile, UserPreferences} from "./mail/UserPreferences";
import { IOC } from "./mail/IOC";
import { LocaleService } from "./mail/LocaleService";
import { AssetsManager } from "./app/common/AssetsManager";
import { MailStats } from "./mail/MailStats";
import { MutableCollection } from "./utils/collection/MutableCollection";
import { PrivmxRegistry } from "./mail/PrivmxRegistry";
import { SimpleOpenableElement } from "./app/common/shell/ShellTypes";
import { VoiceChatUser } from "./app/common/voicechat/VoiceChatService";
import { Person } from "./mail/person/Person";


export namespace utils {
    
    export type EventCallback<T, U, V> = (a1: T, a2: U, a3: V) => void;
    export type EventsCallback<T, U, V> = (events: [T, U, V][]) => void;
    export type Comparator<T> = (a: T, b: T) => number;
    export type Getter<T, U> = ((v: T) => U);
    export type GetterArg<T, U> = Getter<T, U>|string;
    export type ArrayAction<T> = (v: T, index: number, list: T[]) => void;
    export type ArrayFinder<T> = (v: T, index: number, list: T[]) => boolean;
    export type ArrayMapper<T, U> = (v: T, index: number, list: T[]) => U;
    export type Map<T> = {[key: string]: T};
    
    export interface Storage<K, V> {
        getItem(key: K): Q.IWhenable<V>;
        setItem(key: K, value: V): Q.IWhenable<void>;
        removeItem(key: K): Q.IWhenable<void>;
        getStorageType(): string;
        length(): Q.IWhenable<number>;
        iterate(func: (key: K, value: V) => void): Q.IWhenable<void>;
        clear(): Q.IWhenable<void>;
    }
    
    export interface Plugin<T> {
        createComponents(parent: T): void;
    }

    export interface ProjectInfo {
        str: string;
        ver: string;
    }
    
    export interface Column {
        type: string;
        min?: number;
        value: number|Settings;
    }
    
    export namespace collection {
        
        export interface Entry<T> {
            index: number;
            obj: T;
        }
        
        export interface CollectionEvent<T> {
            type: string;
            changeId: number;
            index?: number;
            element?: T;
            indicies?: number[];
            oldIndex?: number;
            newIndex?: number;
            oldActive?: Entry<T>;
            newActive?: Entry<T>;
            causeType?: string;
        }
        
        export type CollectionEventArgs<T> = [CollectionEvent<T>, any, any];
        export type CollectionEventCallback<T> = (a1: CollectionEvent<T>, a2: any, a3: any) => void;
        export type CollectionEventsCallback<T> = (events: CollectionEventArgs<T>[]) => void;
    }
    
    export interface Resource {
        name: string;
        mimetype: string;
        content: Buffer;
    }
    
    export interface ObjClassName {
        className: string;
    }
    
    export interface IKeyValueDb<T extends privfs.types.db.KvdbEntry> {
        dbId: string;
        extKey: privfs.crypto.ecc.ExtKey;
        newlyCreated: boolean;
        get(key: string): Q.Promise<T>;
        opt(key: string, defaultData: T): Q.Promise<T>;
        set(key: string, value: T): Q.Promise<void>;
        withLock(key: string, func: (content: T|false, lockId: string, entryKey: Buffer) => Q.IWhenable<T>): Q.Promise<void>;
    }
    
    export interface IKeyValueDbCollection<T extends privfs.types.db.KvdbEntry> extends IKeyValueDb<T> {
        collection: MutableCollection<T>;
        hasSync(key: string): boolean;
        optSync(key: string, defaultValue: T): T;
        getSync(key: string): T;
    }
    
    export interface IKvdbMap<T> {
        has(key: string): boolean;
        get(key: string): T;
        getEntries(_copy?: boolean): {[key: string]: T};
        getValues(): T[];
        set(key: string, value: T): Q.Promise<void>;
        remove(key: string): Q.Promise<void>;
        setMany(map: {[key: string]: T}): Q.Promise<boolean>;
        removeMany(keys: string[]): Q.Promise<void>;
        forEach(func: (key: string, value: T) => void): void
    }
    
    export interface Gateway {
        request(method: string, params: any): Q.Promise<any>;
    }
    
    export interface IdentityProvider {
        getIdentity(): privfs.identity.Identity;
        isAdmin(): boolean;
        getLogin(): string;
        getType(): string;
        getRights(): string[];
    }
    
    export interface FileSizeChecker {
        checkFileSize(fileSize: number): void;
    }
    
    export interface MessageSender {
        createMessage(oneOrMoreReceivers: privfs.message.MessageReceiver|privfs.message.MessageReceiver[], subject: string, text: string): privfs.message.Message;
        sendSimpleMessage(message: privfs.message.Message, extra?: string, addToSink?: boolean, tags?: string[]): Q.Promise<privfs.types.message.ReceiverData[]>;
        editSimpleMessage(originalMessageId: number, message: privfs.message.Message, addToSink?: boolean, tags?: string[]): Q.Promise<privfs.message.SentMessage>;
    }
    
    export interface AsyncMap {
        get<T = any>(key: string): Q.Promise<T>;
        set<T = any>(key: string, item: T): Q.Promise<void>;
        remove(key: string): Q.Promise<void>;
    }
    
    export type IStorage = AsyncMap;
    
    export interface Option<T> {
        value: T;
    }
    
    export interface RegisterTokenInfo {
        domain: string;
        token: string;
        isAdmin: boolean;
        key?: string;
        username?: string;
    }
}

export namespace webUtils {
    
    export type HelperDefinition<H> = string|{new(...args: any[]): H};
    export type TemplateFunctionRaw<M, C, H> = (model?: M, context?: C, helper?: H) => string;
    export type TemplateFunctionWithHelperDefinition<M, C, H> = {
        func: TemplateFunctionRaw<M, C, H>;
        helper: HelperDefinition<H>;
    };
    export type TemplateDefinition<M, C, H> = TemplateFunctionRaw<M, C, H>|TemplateFunctionWithHelperDefinition<M, C, H>|Template<M, C, H>;
    export type MailTemplateDefinition<M, C = any> = TemplateDefinition<M, C, MailClientViewHelper>;
    export type MailTemplate<M, C = any> = Template<M, C, MailClientViewHelper>;
    
    export interface ProgressManager {
        newChannel(func: Function): number;
        destroyChannel(id: number): void;
    }
    
    export type ProgressNotifier = (data: any) => string|false;
    
    export interface SanitizeOptions {
        elements?: string[];
        attributes?: {[name: string]: any[]};
        allow_comments?: boolean;
        protocols?: {[name: string]: string};
        add_attributes?: {[name: string]: {[name: string]: string}};
        dom?: Document;
        remove_contents?: string[];
        transformers?: any[];
    }
    
    export interface PersonModelFull {
        hashmail: string;
        username: string;
        name: string;
        present: boolean;
        description: string;
        avatar: string;
        lastUpdate: number;
        isEmail: boolean;
        isStarred: boolean;
        isExternal: boolean;
        deviceName: string;
        client: string;
        isAdmin: boolean;
        loggedInSince: number;
        lastSeen: number;
        ipAddress: string;
    }

    export interface PersonModelFullOptymized {
        hashmail: string;
        username: string;
        name: string;
        present: boolean;
        description: string;
        avatar: app.BlobData;
        lastUpdate: number;
        isEmail: boolean;
        isStarred: boolean;
        isExternal: boolean;
        deviceName: string;
        client: string;
        isAdmin: boolean;
        loggedInSince: number;
        lastSeen: number;
        ipAddress: string;
    }

    export interface UserExtraInfo {
        deviceName: string;
        client: string;
    }

    
    export interface ConversationModel {
        id: string;
        unread: number;
        unmutedUnread: number;
        elementsCount: number;
        searchCount: number;
        allSearched: boolean;
        isSingleContact: boolean;
        withSpinner: boolean;
        isPinned: boolean;
        withPin: boolean;
        customName?: string;
        person: {
            hashmail: string;
            name: string;
            description: string;
            present: boolean;
            starred: boolean;
            isBasic?: boolean;
            deleted?: boolean;
        };
        persons: {
            hashmail: string;
            name: string;
            isBasic?: boolean;
            deleted?: boolean;
        }[];
        personsPresence?: number;
        isBellRinging?: boolean;
        activeVoiceChatInfo?: webUtils.ActiveVoiceChatInfo
    }
    
    export interface SectionListElementModel {
        id: string;
        name: string;
        unread: number;
        elementsCount: number;
        searchCount: number;
        allSearched: boolean;
        withSpinner: boolean;
        scope: string;
        breadcrumb: string;
        muted: boolean;
        disabled: boolean;
        primary: boolean;
        openOnFirstLogin: boolean;
        pinned: boolean;
        isBellRinging?: boolean;
        activeVoiceChatInfo?: webUtils.ActiveVoiceChatInfo;
    }

    export interface HostListElementModel {
        id: string;
        name: string;
        unread: number;
        elementsCount: number;
        searchCount: number;
        allSearched: boolean;
        scope: string;
        muted: boolean;
        disabled: boolean;
        isExpanded: boolean;
    }

    
    export interface SectionModel {
        id: string;
        name: string;
        parent: string;
        hasChat: boolean;
        hasFiles: boolean;
        hasTasks: boolean;
        level: number;
    }
    
    export interface CustomElementModel {
        id: string;
        label: string;
        icon: {
            type: string,
            value: string
        };
        private: boolean;
        withBorder?: boolean
        unread: number;
        unmutedUnread: number;
        elementsCount: number;
        searchCount: number;
        withSpinner: boolean;
        allSearched: boolean;
        alternative: boolean;
        emphasized: boolean;
    }
    
    export interface WiElementModel {
        id: string;
        icon: string;
        name: string;
        badge: number;
    }
    
    export interface EmojiIconsModel {
        icons: EmojiIconModel[];
    }
    
    export interface EmojiIconModel {
        id: string;
        count: number;
        names: string;
        isMy: boolean;
        persons: PersonModelFull[];
    }
    
    export interface ButtonsModel {
        enabled: boolean;
        buttons: ButtonModel[];
    }
    
    export interface ButtonModel {
        icon: string;
        enabled: boolean;
        action: string;
        label: string;
    }

    export interface PersonSimpleModel {
        name: string;
        hashmail: string;
        description: string;
        present: boolean;
    }

    export interface ActiveVoiceChatInfo {
        active: boolean;
        users: PersonSimpleModel[]
    }
}

export namespace event {
    
    export type EventListener<T extends Event> = (event: T) => void;
    export type EventsListener<T extends Event> = (event: T[]) => void;
    
    export interface Event<T = any> {
        type: string;
        bubbleable?: boolean;
        result?: T;
    }
    
    export interface AfterLoginEvent extends Event {
        type: "afterlogin";
        target: CommonApplication;
        userCredentials: app.UserCredentials;
    }
    
    export interface BeforeLogoutPlugin extends Event {
        type: "beforelogout";
        target: CommonApplication;
    }
    
    export interface AfterLogoutPlugin extends Event {
        type: "afterlogout";
        target: CommonApplication;
    }
    
    export interface PluginLoadedEvent extends Event {
        type: "pluginsloaded";
        target: CommonApplication;
    }
    
    export interface BatchStartEvent extends Event {
        type: "batchstart";
    }
    
    export interface BatchEndEvent extends Event {
        type: "batchend";
    }
    
    export interface ContainerEvent<T = any, C = Container> extends Event {
        type: "beforeadd"|"afteradd"|"beforeremove"|"afterremove";
        target: C;
        id: string;
        component: T;
    }
    
    export interface ComponentViewEvent<T = ComponentView> extends Event {
        type: "beforerender"|"afterrender";
        target: T;
    }
    
    export interface ComponentViewInitEvent<T = ComponentView> extends Event<Q.Promise<void>> {
        type: "beforeinit"|"afterinit";
        target: T;
    }
    
    export interface TemplateManagerCreatedEvent extends Event {
        type: "templatemanagercreated";
        templateManager: TemplateManager;
        helperModel: app.MailClientViewHelperModel;
    }
    
    export interface MailStatsEvent extends Event {
        type: "mailstats";
        mailStats: MailStats;
        stats: mail.UnreadStatsCombined;
    }
    
    export interface SinkPollingResultEvent extends Event {
        type: "sinkpollingresult";
        entries: PollingItem[]
    }
    
    export interface CustomActionEvent extends Event {
        type: "customaction";
        target: MessageWindowController;
        actionType: string;
    }
    export interface WindowFocusEvent extends Event {
        type: "focusChanged";
        target: any;
        windowId: string;
    }
    
    export interface StarterLoadEvent extends Event {
        type: "load";
        target: Starter;
    }
    
    export interface InstanceRegisteredEvent<I = utils.ObjClassName, T = any> extends Event {
        type: "instanceregistered",
        target: T;
        instance: I;
    }
    
    export interface AdditionalLoginStepEvent<T = any> extends Event<Q.Promise<void>> {
        type: "additionalloginstep";
        basicLoginResult: {srpSecure: privfs.core.PrivFsSrpSecure};
        data: T;
    }
    
    export interface EndpointResolvedEvent extends Event {
        type: "endpointresolved";
        host: string;
        url: string;
        urlMap: {[url: string]: string};
    }
    
    export interface AdditionalLoginStepActionEvent extends Event {
        type: "additionalloginstepaction"
    }
    
    export interface GrantAccessToSharedDbEvent extends Event<Q.Promise<void>> {
        type: "grantaccesstoshareddb";
    }
    
    export interface GrantAccessToAdminKeyEvent extends Event<Q.Promise<void>> {
        type: "grantaccesstoadminkey";
    }
    
    export interface SinkIndexManagerReady extends Event<Q.Promise<void>> {
        type: "sinkindexmanagerready";
    }
    
    export interface UserPreferencesChangeEvent extends Event {
        type: "userpreferenceschange";
        operation: "load"|"save";
        userPreferences: UserPreferences;
    }

    export interface NotificationServiceEvent extends Event {
        type: "notifyUser";
        options?: NotificationOptions;
    }

    export interface ElectronNotificationServiceEvent extends Event {
        type: "notifyInTray" | "notifyInTooltip",
        options?: NotificationTooltipOptions,
        context?: NotificationContext,
    }
    
    export interface TryMarkAsReadEvent extends Event {
        type: "try-mark-as-read",
        sectionId?: string,
        conversationId?: string,
        customElementId?: string,
        moduleName?: "chat"|"notes2"|"tasks",
        hostHash?: string;
    }
    
    export interface MarkAsReadEvent extends Event {
        type: "mark-as-read",
        sectionId?: string,
        conversationId?: string,
        customElementId?: string,
        moduleName?: "chat"|"notes2"|"tasks",
        hostHash?: string,
    }
    
    export interface SetBubblesState extends Event {
        type: "set-bubbles-state";
        markingAsRead: boolean;
        scope: MarkAsReadEvent;
    }
    
    export interface RefreshUsersPresence {
        type: "refresh-users-presence";
    }

    export interface NotificationContext {
        module: string;
        sinkId: string;
        hostHash?: string;
    }
    
    export interface NotificationOptions {
        sender?: string,
        sound?: boolean,
        tray?: boolean,
        tooltip?: boolean,
        tooltipOptions?: NotificationTooltipOptions,
        context?: NotificationContext,
    }
    
    export interface NotificationTooltipOptions {
        title?: string,
        text?: string,
        sender?: string,
        withAvatar?: boolean,
        withUserName?: boolean,
        withSticker?: string,
        customMessageLength?: number,
        customEllipsis?: string,
        context?: NotificationContext,
    }
    
    export interface NewSinkIndexEntry extends Event {
        type: "newsinkindexentry";
        indexEntry: SinkIndexEntry;
    }
    
    export interface RevertSinkIndexEntry extends Event {
        type: "revertsinkindexentry";
        indexEventType: string;
        indexEntry: SinkIndexEntry;
    }
    
    export interface ContentChangeEvent extends Event {
        type: "content-change";
        element: shelltypes.OpenableElement;
    }
    
    export interface OpenHistoryViewEvent extends Event {
        type: "open-history-view";
        fileSystem: privfs.fs.file.FileSystem,
        path: string,
        parent: BaseWindowController;
        hostHash: string;
    }
    
    export interface OpenMindmapHelpEvent extends Event {
        type: "open-mindmap-help";
    }
    
    export interface FileOpenedEvent extends Event {
        type: "file-opened";
        element: shelltypes.OpenableElement;
        applicationId: string;
        docked: boolean;
        action?: shelltypes.ShellOpenAction;
        hostHash: string;
    }

    export type DescriptorLockEventRole = "descriptorReleased" | "descriptorLocked" | "descriptorModified" | "descriptorDeleted" | "descriptorCreated" | "descriptorUpdated";

    export interface FileLockChangedEvent {
        type: "file-lock-changed";
        role: DescriptorLockEventRole;
        did: string;
        user: string;
        locked?: boolean;
        lockReleased?: boolean;
    }
    
    export interface UpdateStatusChangeEvent {
        type: "update-status-change";
        status: app.UpdaterProgressStatus;
        downloaded?: number;
        total?: number;
    }
    
    export interface AllWindowsMessage {
        type: "all-windows-message";
        message: "show-screen-cover" | "hide-screen-cover" | "show-no-connection-screen-cover" | "hide-no-connection-screen-cover" | "set-zoom-level" | "connection-msg";
        extra?: string;
    }

    export interface UserDeletedEvent {
        type: "user-deleted";
        hashmail: string;
    }

    export interface SectionStateChangedEvent {
        type: "section-state-changed";
        sectionId: string;
    }

    export interface ActiveAppWindowChangedEvent {
        type: "active-app-window-changed";
        appWindowId: string;
    }
    
    export interface OpenEditSectionDialogEvent extends Event {
        type: "open-edit-section-dialog";
        sectionId: string;
    }

    export type TrialStatusUpdateEvent = app.TrialStatus & {type: "trial-status-update"}

    export interface AfterPasswordChangedEvent {
        type: "afterPasswordChanged";
        userCredentials: app.UserCredentials;
    }

    export interface SectionsLimitReachedEvent {
        type: "sectionsLimitReached";
        reached: boolean;
    }

    export interface HostSessionCreatedEvent {
        type: "hostSessionCreated",
        host: string,
        hostHash: string
    }
    
    export interface FileRenamedEvent {
        type: "fileRenamed";
        did: string;
        oldPath: string;
        newPath: string;
        isLocal?: boolean;
        hostHash?: string;
    }
    export interface UserPresenceChangeEvent {
        type: "user-presence-change";
        hostHash: string;
        host: string;
        role: string;
        data?: any;
    }

    export interface LostConnectionInWebSocketEvent {
        type: "lost-connection-in-web-socket";
        hostHash: string;
    }

    export interface VoiceChatUsersPresenceChangeEvent {
        type: "voice-chat-users-presence-change";
        hostHash: string;
        host: string;
        sectionId: string;
        users: string[];
    }

    export interface VoiceChatTalkingBaseEvent extends Event {
        sectionId: string;
        hostHash: string;
    }

    export interface JoinedVoiceChatTalkingEvent extends VoiceChatTalkingBaseEvent {
        type: "joinedVoiceChat";
    }
    
    export interface LeftVoiceChatTalkingEvent extends VoiceChatTalkingBaseEvent {
        type: "leftVoiceChat";
    }
    
    export interface StartedTalkingEvent extends VoiceChatTalkingBaseEvent {
        type: "startedTalking";
    }
    
    export interface StoppedTalkingEvent extends VoiceChatTalkingBaseEvent {
        type: "stoppedTalking";
    }
    
    export interface RefreshListeningUsersEvent extends VoiceChatTalkingBaseEvent {
        type: "refreshListeningUsers";
        listeningUsers: VoiceChatUser[];
    }

    export interface RingTheBellTalkingEvent extends VoiceChatTalkingBaseEvent {
        type: "ringTheBell";
    }
    
    export interface DingDongTalkingEvent extends VoiceChatTalkingBaseEvent {
        type: "dingDong";
    }

    export interface ToggleSidebarBellStateEvent extends VoiceChatTalkingBaseEvent {
        type: "toggleSidebarBellState";
        conversationId: string;
        isRinging: boolean;
    }

    export interface ToggleSidebarVoiceChatActiveEvent extends VoiceChatTalkingBaseEvent {
        type: "toggleSidebarVoiceChatActive";
        conversationSectionId: string;
        active: boolean;
        users: webUtils.PersonSimpleModel[];
    }


    export interface StreamsActionEvent extends VoiceChatTalkingBaseEvent {
        type: "streamsAction";
        action: "talk" | "mute" | "hangup";
    }
    
}

export namespace app {
    
    export interface ConfigEx extends privfs.types.core.UserConfig {
        desktopDownloadUrl: string;
        instanceName: string;
        contactData: string;
        feedbackUrl: string;
    }
    
    export interface BlobData {
        mimetype: string;
        buffer: any;
    }
    
    export type i18nLang = {[name: string]: string};
    export type i18nLangs = {[lang: string]: i18nLang};
    
    export interface SendFileOptions {
        parent?: BaseWindowController;
        options?: SelectContactsWindowOptions;
        notifications?: NotificationController;
        errorLog?: ErrorLog;
        getData: () => Q.IWhenable<privfs.lazyBuffer.IContent>;
    }
    
    export type OnLogoutCallback = () => boolean;
    
    export interface AppOptions {
        sinkFilter: utils.Option<(sink: privfs.message.MessageSinkPriv) => boolean>;
        defaultPki: utils.Option<boolean>;
        notifications: utils.Option<mail.NotificationEntry[]>;
        forcedPublishPresenceType: utils.Option<string>;
        maxFileSize: utils.Option<number>;
        kvdbPollInterval: utils.Option<number>;
    }
    
    export interface Position {
        x: number;
        y: number;
    }
    
    export interface Size {
        width: number;
        height: number;
    }
    
    export interface WindowState {
        x: number;
        y: number;
        width: number;
        height: number;
    }
    
    export interface FileHandle {
        handleType: string;
    }
    
    export interface ElectronFileHandle extends FileHandle {
        path: string;
        type: string;
    }
    
    export interface BrowserFileHandle extends FileHandle {
        file: File;
    }

    export interface ElectronBrowserFile extends File {
        path: string;
    }
    
    export interface PluginConfigProvider {
        getPluginConfig(pluginName: string): app.PluginConfig;
    }
    
    export interface PluginConfig {
        name: string;
        buildId: string;
    }
    
    export interface MailClientViewHelperModel {
        localeService: {
            instance: LocaleService;
            currentLang: string;
            serializedTexts: string;
            availableLanguages: string;
        };
        assetsManager: {
            instance: AssetsManager;
            assets: {[name: string]: {default: boolean, url: string}};
            rootUrl: string;
            pluginRootUrl: string;
            pluginConfigProvider: app.PluginConfig[];
        };
        version: string;
        isDemo: boolean;
        defaultHost: string;
        isContextMenuBlocked: boolean;
        openLinksByController: boolean;
        uiEventsListener: () => void;
    }
    
    export enum LoginType {
        PASSWORD,
        MNEMONIC
    }
    
    export interface UserCredentials {
        type: LoginType;
        hashmail: privfs.identity.Hashmail;
        password?: string;
        mnemonic?: string;
    }
    
    export interface PathWithType {
        type: string;
        path: string;
    }

    export interface PersonAvatar {
        hashmail: string;
        lastUpdate: number;
        avatar: string;
        isEmail: boolean;
    }
    
    export interface AutoUpdateStatusData {
        status: string;
    }
    export type AutoUpdateStatusModel = Model<AutoUpdateStatusData>;
    
    export interface FullscreenModel extends Model<boolean> {
        toggle(): void;
    }
    
    export interface SearchModel extends Model<{value: string, visible: boolean}> {
    }
    
    export interface SecureFormsSettings {
        enabled: boolean;
    }
    
    export interface IpcSender {
        channel: string;
        send(params: any): void;
        addListener(listener: Function): void;
        destroy(): void;
    }
    
    export interface IpcContainer extends Container {
        createIpcSender(channelId?: string): IpcSender;
    }
    
    export interface IOCContainer {
        ioc: IOC;
    }
    
    export interface ViewParent extends Container {
        viewManager: ViewManager;
        addIpcListener(channel: string, callback: Function): void;
        removeIpcListener(channel: string, callback: Function): void;
        sendIpcMessage(channel: string, message: any): void;
    }
    
    export interface WindowParent extends IpcContainer {
        app: CommonApplication;
        onDockedLoad(window: BaseWindowController): void;
        onChildWindowClose(window: BaseWindowController): void;
        getClosestNotDockedController(): BaseWindowController;
    }
    
    export interface WindowParentEx extends WindowParent {
        openChildWindow<T extends BaseWindowController>(win: T, delayedOpenDeferred?: Q.Deferred<T>): T
    }
    
    export interface WindowLoadOptionsHtml {
        type: "html";
        html: string;
        name: string;
        host?: string;
    }
    
    export interface WindowLoadOptionsUrl {
        type: "url";
        url: string;
        secureContent?: boolean;
    }
    
    export interface WindowLoadOptionsBase {
        type: "base";
        baseUrl: string;
        viewName: string;
        scripts: string[];
        styles: string[];
        dynamicScripts: string[];
    }
    
    export interface FontVariant {
        family?: string;
        weight?: string;
        style?: string;
        variant?: string;
        stretch?: string;
    }
    
    export interface WindowLoadOptionsRender {
        type: "render";
        lang: string;
        title: string;
        bodyClass: string;
        viewName: string;
        scripts: string[];
        styles: string[];
        dynamicScripts: string[];
        fonts: FontVariant[];
        isElectron?: boolean;
        extraBodyAttributes?: { [key: string]: string };
        host?: string;
    }
    
    export type WindowLoadOptions = WindowLoadOptionsHtml|WindowLoadOptionsUrl|WindowLoadOptionsBase|WindowLoadOptionsRender;
    
    export type PreTitleIcon = "section-public" | "section-non-public" | "local" | "person" | "private";
    
    export interface WindowOptions {
        toolbar?: boolean;
        show?: boolean;
        modal?: boolean;
        alwaysOnTop?: boolean;
        showInactive?: boolean;
        minimizable?: boolean;
        resizable?: boolean;
        maximizable?: boolean;
        closable?: boolean;
        showLoadingScreen?: boolean;
        hideLoadingSpinner?: boolean;
        decoration?: boolean;
        widget?: boolean;
        cssClass?: string;
        fullscreen?: boolean;
        draggable?: boolean;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
        icon?: string;
        preTitleIcon?: PreTitleIcon;
        positionX?: number,
        positionY?: number,
        width?: string|number;
        height?: string|number;
        title?: string;
        position?: string;
        maximized?: boolean;
        hidden?: boolean;
        frame?: boolean;
        backgroundColor?: string;
        keepSpinnerUntilViewLoaded?: boolean;
        manualSpinnerRemoval?: boolean;
        electronPartition?: string;
    }
    
    export interface HistoryEntry {
        pathname: string;
        state?: string;
        key?: string;
    }
    
    export interface InteractiveModal {
        result: string;
        value: string;
        checked: boolean;
        close: () => void;
        startProcessing: (label?: string) => void;
        updateProcessing: (label?: string) => void;
        stopProcessing: () => void;
        showInputError: (error: string) => void;
        hideInputError: () => void;
    }
    
    export interface Settings {
        isPublic: boolean;
        defaultValue?: any;
        subs?: {[name: string]: SubRaw};
    }
    
    export interface AdminDataForUserEncryptResult {
        serverData: string;
        key: string;
    }
    
    export interface AdminDataForUser {
        key: string;
        cipher: string;
    }
    
    export interface AdminDataForUserCore {
        sharedDb: string;
    }
    
    export type UpdaterProgressStatus = "downloading" | "extracting" | "error" | "verify" | "done" | "checking" | "readyToInstall" | "new-version-info";
    
    export interface VendorLicenseAsset {
        assetName: string;
        openableElement: SimpleOpenableElement
        assetPath: string;
    }
    
    export interface Error {
        askToReport: boolean;
        errorData: string;
        occurredAt: number;
        helpCenterCode?: number;
    }
    
    export interface TrialStatus {
        isAdmin: boolean;
        subscriptionEnding: boolean,
        trial: boolean,
        startDate?: number,
        endDate: number,
        hasExtendOrder: boolean,
        expired: boolean,
        maxUsers?: number,
        totalStorage?: string,
        orderId?: string,
        dataCenterUser?: {id: string, login: string}
    }
}

export namespace mail {
    
    export type Flags = {[name: string]: any};
    
    export interface TagProvider {
        getTag(tagName: string): Q.Promise<string>;
    }
    
    export interface SinkIndexProvider {
        getSinkIndexById(sinkId: string): SinkIndex;
    }
    
    export interface SinkProvider {
        waitForInit(): Q.Promise<void>
        getInboxes(): privfs.message.MessageSinkPriv[];
        getOutbox(): privfs.message.MessageSinkPriv;
    }
    
    export interface ProfileProvider {
        getProfile(): Profile;
    }
    
    export interface LowUserProvider {
        getLowUserByUser(sender: privfs.identity.User): LowUser;
        getLowUser(username: string, host: string): LowUser;
        getLowUserByHashmail(hashmail: string): LowUser;
        isLowUser(sender: privfs.identity.User): boolean;
        getLowUserFromAlternativeRegistry(hashmail: string): LowUser;
        getLowUserBySource(source: string): LowUser;
        getLowUserByEmail(email: string): LowUser;
    }
    
    export interface ILowUserService extends LowUserProvider {
        addLowUser(email: string, password: string, hint: string, lang: string, source: string, subject: string, text: string): Q.Promise<LowUser>
    }
    
    export type SinkFilter = (sink: privfs.message.MessageSinkPriv) => boolean;
    
    export interface AdminDataManagable {
        masterSeed: string;
        recovery: string;
        generatedPassword: string;
    }

    export interface AdminDataPrivate {
        key: string;
        link: string;
        activateToken: string;
    }
    
    export type AdminData = AdminDataManagable|AdminDataPrivate;
    
    export interface AttachmentEntry {
        id: string;
        entry: SinkIndexEntry;
        index: number;
        attachment: privfs.message.MessageAttachment;
    }
    
    export interface NotificationEntry {
        userPreferencesKey: string;
        defaultValue: boolean;
        tags: (tagService: privfs.message.TagService) => string[];
        i18nKey: string;
    }
    
    export interface MessageHandler {
        id: number;
        sink: privfs.message.MessageSinkPriv;
    }
    
    export interface MailResourceLoader {
        getResource(name: string): Q.Promise<utils.Resource>;
        getResourceSafe(name: string, onFailResource?: utils.Resource): Q.Promise<utils.Resource>;
    }
    
    export interface MessageHandle {
        sid: string;
        mid: number;
    }
    
    export interface MessagePostResult {
        message: privfs.message.Message;
        info: privfs.types.message.ReceiverData[];
        errors: number;
        nooneGetMsg: boolean;
        full: privfs.types.message.MessagePostResultOutbox;
        outMessage: privfs.message.SentMessage;
        outSink: privfs.message.MessageSinkPriv;
    }
    
    export interface UnreadStats {
        unread: number;
    }
    
    export interface UnreadStatsWithByJsonType {
        unread: number;
        byJsonType: {[type: string]: UnreadStats};
    }
    
    export interface UnreadStatsWithByType {
        unread: number;
        byType: {[type: string]: UnreadStats};
    }
    
    export type UnreadStatsByType = UnreadStatsWithByJsonType;
    export type UnreadStatsByJsonType = UnreadStatsWithByType;
    
    export interface UnreadStatsBySid {
        unread: number;
        byType: {[type: string]: UnreadStatsByType};
        byJsonType: {[type: string]: UnreadStatsByJsonType};
    }
    
    export interface UnreadStatsCombined {
        unread: number;
        byType: {[type: string]: UnreadStatsByType};
        byJsonType: {[type: string]: UnreadStatsByJsonType};
        bySid: {[sid: string]: UnreadStatsBySid};
    }
}

export namespace section {
    
    export type SectionId = string;
    
    export interface SectionSecuredData {
        name: string;
        modules: {[module: string]: {enabled: boolean, data: string}};
        extraOptions: SectionExtra;
    }
    
    export interface SectionBasicGroup {
        users: string[];
        groups: string[];
    }
    
    export type SectionState = "enabled"|"disabled"|"removed";
    
    export interface SectionCreateModel {
        id: SectionId;
        parentId?: SectionId;
        data: string;
        keyId: string;
        group: {
            id?: string;
            type: string;
            users: string[];
        };
        state: SectionState;
        acl: {
            manage: string;
            createSubsections: string;
        };
        primary: boolean;
    }
    
    export interface AclEntry {
        admins: boolean;
        all: boolean;
        users: string[];
    }
    
    export interface SectionAcl {
        manage: AclEntry;
        createSubsections: AclEntry;
    }
    
    export interface SectionRawAcl {
        manage: string;
        createSubsections: string;
    }
    
    export interface SectionCreateModelDecrypted {
        id: SectionId;
        parentId?: SectionId;
        data: SectionSecuredData;
        group: {
            id?: string;
            type: string;
            users: string[];
        };
        state: SectionState;
        acl: SectionAcl;
        primary: boolean;
    }
    
    export interface SectionExtra {
        openOnFirstLogin: boolean;
    }

    export interface SectionUpdateModel {
        id: SectionId;
        parentId?: SectionId;
        data: string;
        version: number;
        keyId: string;
        group: {
            type: string;
            users: string[];
        };
        state: SectionState;
        acl: SectionRawAcl;
        primary: boolean;
    }
    
    export interface SectionUpdateModelDecrypted {
        id: SectionId;
        parentId?: SectionId;
        data: SectionSecuredData;
        version: number;
        group: {
            type: string;
            users: string[];
        };
        state: SectionState;
        acl: SectionAcl;
        primary: boolean;
    }
    
    export interface SectionData {
        id: SectionId;
        parentId?: SectionId;
        data: string;
        version: number;
        keyId: string;
        group: {
            id: string;
            type: string;
            users: string[];
        };
        state: SectionState;
        acl: {
            read: string;
            manage: string;
            createSubsections: string;
        };
        primary: boolean;
        extraOptions: SectionExtra;
    }
    
    export interface SectionMessage {
        type: string;
    }
    
    export interface SectionShareKeyMessage {
        type: string;
        sectionId: SectionId;
        key: string;
        isPublic?: boolean;
    }

    export interface SectionAccessChangeMessage {
        type: string;
        sectionId: SectionId;
    }
    
    export type SectionKeyId = string;
    
    export interface SectionKey {
        sectionId: SectionId;
        keyId: SectionKeyId;
        key: Buffer;
    }
    
    export type SectionFileId = string;
    
    export interface UploadFileTreeOptions {
        data: privfs.lazyBuffer.IContent;
        path?: string;
        fileOptions?: privfs.types.descriptor.DNVKOptions;
        copyFrom?: SectionFileId;
        elementToMove?: SectionFileId;
        conflictBehavior?: privfs.fs.file.multi.ConflictBehavior
        statusCallback?: privfs.fs.file.multi.MultiStatusCallback;
    }
    
    export interface UploadFileTreeResult {
        entryId: SectionFileId;
        path: string;
        openableElement: shelltypes.OpenableElement;
        elementMoved: boolean;
    }
    
    export interface UploadFileConversationOptions {
        data: privfs.lazyBuffer.IContent;
        destination: string;
    }
    
    export interface SendAttachmentResult {
        result: privfs.types.message.ReceiverData;
        openableElement: shelltypes.OpenableElement;
    }
    
    export interface SendAttachmentToConversationResult {
        result: mail.MessagePostResult;
        openableElement: shelltypes.OpenableElement;
    }
    
    export interface UploadFileOptions {
        data: privfs.lazyBuffer.IContent;
        path?: string;
        fileOptions?: privfs.types.descriptor.DNVKOptions;
        noMessage?: boolean;
        copyFrom?: SectionFileId;
        elementToMove?: SectionFileId;
        conflictBehavior?: privfs.fs.file.multi.ConflictBehavior
        statusCallback?: privfs.fs.file.multi.MultiStatusCallback;
    }
    
    export interface UploadFileOptionsEx extends UploadFileOptions {
        destination: string;
    }
    
    export interface OperationResult {
        success: boolean;
        error: any;
    }
    
    export interface UploadFileResult {
        fileResult: UploadFileTreeResult;
        mailWithFileInfoResult: privfs.types.message.ReceiverData;
        mailResult: privfs.types.message.ReceiverData;
        openableElement: shelltypes.OpenableElement;
        moveResult: OperationResult;
    }
    
    export interface UploadFileResultEx extends UploadFileResult {
        conversationResult: mail.MessagePostResult;
    }
    
    export interface SendJsonMessageOptions {
        data?: any;
        attachments?: privfs.lazyBuffer.IContent[];
        type?: string;
    }
    
    export interface SendMessageOptions {
        text?: string;
        attachments?: privfs.lazyBuffer.IContent[];
        type?: string;
        deleted?: boolean;
    }
    
    export interface SendMessageOptionsEx extends SendMessageOptions {
        destination: string;
    }
    
    export interface SendMessageResult {
        sinkId: string;
        serverId: number;
        mailResult: privfs.types.message.ReceiverData;
        conversationResult: mail.MessagePostResult;
    }
    
    export interface UserSettingsSerialized {
        id: string;
        mutedModules: section.NotificationSettings;
        visible: boolean;
    }
    
    export interface UserSettings {
        mutedModules: section.NotificationSettings;
        visible: boolean;
    }
    
    export interface DescantsInfo {
        active: SectionService;
        rootSection: SectionService;
        descants: SectionService[];
    }
    
    export interface ModuleInfo {
        name: string
        enabled: boolean;
    }
    
    export interface StickersProvider {
        getStickers(): string[];
    }
    
    export enum NotificationModule {
        CHAT = "chat",
        NOTES2 = "notes2",
        TASKS = "tasks",
        CALENDAR = "calendar",
    }
    
    export interface NotificationSettings {
        [key: string]: boolean,
        chat?: boolean;
        notes2?: boolean;
        tasks?: boolean;
    }
}

export namespace ipc {
    
    export interface IpcSender {
        id: number;
        send(channel: string, data: any): void;
    }
    
    export interface IpcMainEvent {
        sender: IpcSender;
    }
    
    export interface IpcRendererEvent {
        senderId: number;
    }
    
    export type IpcRendererListener = (evt: IpcRendererEvent, arg: any) => any;
    
    export interface IpcRenderer {
        send(channel: string, ...args: any[]): void;
        on(channel: string, listener: IpcRendererListener): void;
        removeListener(channel: string, listener: IpcRendererListener): void;
        removeAllListeners(channel: string): void;
    }
    
    export type IpcMainListener = (evt: IpcMainEvent, arg: any) => any;
    
    export interface IpcMain {
        on(channel: string, listener: IpcMainListener): void;
    }
    
    export interface IpcRequest {
        id: number;
        method: string;
        params: any[];
    }
    
    export interface IpcResponse<T = any> {
        id: number;
        success: boolean;
        value: T;
    }
    
    export interface IpcContainerEntry {
        serviceName: string;
        service: any;
        inChannelName: string;
        outChannelName: string;
        methods: string[];
    }
    
    export interface IpcServiceDefinition {
        serviceName: string;
        inChannelName: string;
        outChannelName: string;
        methods: string[];
    }
    
    export type IpcServicesDefinitions = {[name: string]: ipc.IpcServiceDefinition};
}

export namespace subidentity {
    
    export type SubidentitiesRaw = {[pub: string]: SubidentyRawData};
    export type SubidentitiesPriv = {[pub: string]: SubidentyPrivDataEx};
    export interface SubidentityAcl {
        group: string;
    }

    export interface SubidentyRawData {
        priv: string;
        data: string;
        key: string;
        createDate?: string;
        deviceId?: string;
        deviceName?: string;
        deviceAssigmentDate?: string;
        deviceIdRequired: boolean;
        lastLoginDate?: string;
        acl: SubidentityAcl;
    }
    export interface SubidentyData {
        identity: {
            username: string,
            wif: string
        };
        pubKey: string;
        sectionId: string;
        sectionKeyId: string;
        sectionKey: string;
    }
    export interface SubidentyPrivData extends SubidentyData {
        bip39Mnemonic: string;
    }
    export interface SubidentyPrivDataEx extends SubidentyPrivData {
        createDate: string;
        deviceId: string;
        deviceName: string;
        deviceIdRequired: boolean;
        deviceAssigmentDate: string;
        lastLoginDate: string;
        acl: SubidentityAcl;
    }
    export interface LoginResult {
        data: SubidentyData;
        createDate: string;
        deviceId: string;
        deviceName: string;
        deviceIdRequired: boolean;
        deviceAssigmentDate: string;
        lastLoginDate: string;
        acl: SubidentityAcl;
        srpSecure: privfs.core.PrivFsSrpSecure;
        bip39: privfs.crypto.crypto.Interfaces.Bip39;
        identity: privfs.identity.Identity;
        sectionId: string;
        sectionKey: section.SectionKey;
        sectionPubKey: section.SectionKey;
        section: SectionService;
        privmxRegistry: PrivmxRegistry;
    }
}