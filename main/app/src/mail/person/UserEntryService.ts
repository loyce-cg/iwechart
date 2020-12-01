import * as privfs from "privfs-client";
import * as Q from "q";
import * as RootLogger from "simplito-logger";
import {LocaleService} from "../LocaleService";
import {UserPreferences} from "../UserPreferences";
import {SinkIndexManager} from "../SinkIndexManager";
import {IdentityProfile} from "./IdentityProfile";
import {MailConst} from "../MailConst";
import {MailFilter} from "../MailFilter";
import {mail, utils} from "../../Types";
let Logger = RootLogger.get("privfs-mail-client.mail.person.UserEntryService");

export class UserEntryService {
    
    constructor(
        public localeService: LocaleService,
        public userPreferences: UserPreferences,
        public sinkIndexManager: SinkIndexManager,
        public srpSecure: privfs.core.PrivFsSrpSecure,
        public identityProfile: IdentityProfile,
        public authData: privfs.types.core.UserDataEx,
        public identity: privfs.identity.Identity,
        public tagService: privfs.message.TagService,
        public mailFilter: MailFilter,
        public notifications: utils.Option<mail.NotificationEntry[]>,
        public sinkProvider: mail.SinkProvider
    ) {
    }
    
    comparePkiProfiles(a: privfs.types.core.UserInfoProfile, b: privfs.types.core.UserInfoProfile): boolean {
        if (a.sinks != b.sinks && (a.sinks == null || b.sinks == null || a.sinks.length != b.sinks.length)) {
            return false;
        }
        for (let i = 0; i < a.sinks.length; i++) {
            if (a.sinks[i].id != b.sinks[i].id || a.sinks[i].name != b.sinks[i].name || a.sinks[i].description != b.sinks[i].description) {
                return false;
            }
        }
        if (a.image != b.image && (a.image == null || b.image == null || !a.image.equals(b.image))) {
            return false;
        }
        return a.name == b.name && a.description == b.description;
    }
    
    publishUserEntry(): Q.Promise<void> {
        return Q().then(() => {
            Logger.debug("Publishing user entry...");
            return this.buildNotificationsEntry();
        })
        .then(notificationsEntry => {
            let lang = this.localeService.getLang(this.userPreferences ? this.userPreferences.getValue<string>("ui.lang") : "");
            let contactForm = this.sinkIndexManager ? this.sinkIndexManager.getContactFormSink() : null;
            return this.srpSecure.setUserPreferences(lang, notificationsEntry, contactForm == null ? null : contactForm.id);
        })
        .then(() => {
            return this.sinkProvider.waitForInit();
        })
        .then(() => {
            let userInfoProfile = this.identityProfile.buildUserInfoProfile();
            if (!this.comparePkiProfiles(userInfoProfile, this.authData.myData.userInfo.profile)) {
                return Q().then(() => {
                    return this.srpSecure.setUserInfo(this.identity, userInfoProfile);
                })
                .then(() => {
                    this.authData.myData.userInfo.profile = userInfoProfile;
                });
            }
        })
        .fail(e => {
            Logger.error(e, e.stack);
            return Q.reject<void>(e);
        });
    }
    
    buildNotificationsEntry(): Q.Promise<privfs.types.core.NotificationsEntry> {
        return Q().then(() => {
            let tags: string[] = [];
            this.notifications.value.forEach(nEntry => {
                if (this.userPreferences.getValue<boolean>("notifications." + nEntry.userPreferencesKey, false)) {
                    tags = tags.concat(nEntry.tags(this.tagService));
                }
            });
            return this.tagService.createTags(this.identity.pub, tags);
        })
        .then(tags => {
            let domains = this.mailFilter.getDeniedDomains();
            return {
                enabled: this.userPreferences.getValue<boolean>("notifications.enabled", false),
                email: this.userPreferences.getValue<string>("notifications.email", ""),
                tags: tags,
                ignoredDomains: domains,
                mutedSinks: this.userPreferences.getValue<string>(MailConst.NOTIFICATIONS_MUTED_SINKS,"")
            };
        });
    }
}