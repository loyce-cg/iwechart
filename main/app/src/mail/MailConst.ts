export class MailConst {
    
    static FILES_INDEX = 0;
    static MESSAGES_INDEX = 1;
    static IDENTITY_INDEX = 2;
    static SETTINGS_ENCRYPTOR_INDEX = 9;
    static SETTINGS_KVDB_INDEX = 10;
    static PRIV_SECTIONS_INDEX = 11;
    static SUBIDENTITIES_INDEX = 12;
    static TAG_PROVIDER_KVDB_INDEX = 13;
    static MAIL_FILTER_KVDB_INDEX = 14;
    static PKI_CACHE_KVDB_INDEX = 15;
    static LOW_USERS_KVDB_INDEX = 16;
    static CONTACTS_KVDB_INDEX = 17;
    static SINK_ENCRYPTOR_INDEX = 25;
    /** @deprecated used only in migration to kvdb */
    static CONTACTS_FILENAME = "/contacts.json";
    /** @deprecated used only in migration to kvdb */
    static TAGS_FILENAME = "/tags.json";
    /** @deprecated not in used */
    static TRUSTED_SERVERS_FILENAME = "/trusted-servers.json";
    /** @deprecated used only in migration to kvdb */
    static USER_PREFERENCES_FILENAME = "/user-preferences.json";
    static USER_PREFERENCES_KVDB_KEY = "user-preferences";
    /** @deprecated used only in migration to kvdb */
    static MAIL_FILTER_FILENAME = "/mail-filter.json";
    /** @deprecated used only in migration to kvdb */
    static PKI_CACHE_FILENAME = "/pki-cache.json";
    /** @deprecated used only in migration to kvdb */
    static LOW_USERS_FILENAME = "/low-users.json";
    static MAX_COSIGNERS = 5;
    static ADMIN_KVDB_INDEX = 1;
    static SHARED_KVDB_KEY_IN_ADMIN_DB = "sharedKvdb";
    static NOTIFICATIONS_MUTED_SINKS = "notifications.mutedSinks";
    static UI_AUDIO = "ui.audio";
    static UI_NOTIFICATIONS = "ui.notifications";
    static UI_APP_SILENT_MODE = "ui.appSilentMode";
    static UI_SPELLCHECKER = "ui.spellchecker2";
    static UI_UNREAD_BADGE_CLICK_ACTION = "ui.unreadBadgeClickAction";
    static UI_UNREAD_BADGE_USE_DOUBLE_CLICK = "ui.unreadBadgeUseDoubleClick";
    static UI_PLAY_BUBBLE_POP_SOUND = "ui.playBubblePopSound";
    static UI_PASTE_AS_FILE_ACTION = "ui.pasteAsFileAction";
    static UI_SHOW_ENCRYPTED_TEXT = "ui.showEncryptedText";
    static UI_ONLINE_FIRST = "ui.onlineFirst";
    static UI_SYSTEM_CLIPBOARD_INTEGRATION = "ui.systemClipboardIntegration";
    static UI_PINNED_SECTION_IDS_STR = "ui.pinnedSectionIdsStr";
    static UI_AUTO_MARK_AS_READ = "ui.autoMarkAsRead";
    static UI_INACTIVITY_OVERLAY = "ui.inactivityOverlay";
    static ADMIN_SINK_KEY = "adminSink";
    static PUBLIC_SECTIONS_KEY = "publicSectionsKey";
    static PLAYER_LOOP = "player.loop";
    static PLAYER_RANDOM = "player.random";
    static PLAYER_PLAYLIST = "player.playlist";
    static PLAYER_COLLAPSED = "player.collapsed";
    static PLAYER_MUTED = "player.muted";
    static PLAYER_VOLUME = "player.volume";
    static CUSTOM_SECTION_NAMES = "customSectionNames";
    static CED_IS_AUTO_TASK_PICKER_ENABLED = "contentEditableEditor.isAutoTaskPickerEnabled";
    static CED_IS_AUTO_FILE_PICKER_ENABLED = "contentEditableEditor.isAutoFilePickerEnabled";
    static PROFILE_IMAGE = "profile.image";
    static SWITCH_VOICE_CHAT_SHOW_CONFIRM = "ui.switchvoicechatconfirm.hideConfirmChecked";
    
}