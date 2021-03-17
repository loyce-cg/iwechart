import { Profiles, Profile, ProfileEx } from "./Types";
import { LocaleService } from "../../../mail";
import { KeyboardShortcuts } from "../../common/KeyboardShortcuts";
import * as privfs from "privfs-client";
import * as Q from "q";

import electron = require("electron");
import path = require("path");
import fs = require("fs");
import fse = require("fs-extra");
import os = require("os");
import * as systeminformation from "systeminformation";

export class ProfilesManager {
    basePath: string;
    profilesPath: string;
    profilesConfigPath: string;
    profiles: Profiles;
    onNewProfileHandlers: ((absPath: string) => void)[] = [];
    deviceId: string;

    constructor(
        public isInDevMode: boolean
    ) {
        this.basePath = path.resolve(os.homedir(), ".privmx");
        this.profilesPath = path.resolve(this.basePath, "profiles");
        this.profilesConfigPath = path.resolve(this.basePath, "profiles.json");
        fse.mkdirsSync(this.basePath);
        fse.mkdirsSync(this.profilesPath);
        if (fs.existsSync(this.profilesConfigPath)) {
            this.profiles = JSON.parse(fs.readFileSync(this.profilesConfigPath, "utf8"));
            if (!this.profiles.deviceIdSeed) {
                this.profiles.deviceIdSeed = this.generateDeviceIsSeed();
                this.dumpProfiles();
            }

            if (isInDevMode && !this.profiles.initProfile) {
                let devProfile: Profile;
                devProfile = this.createProfile();
                this.profiles.profiles[devProfile.name] = devProfile;
                this.profiles.devInitProfile = devProfile.name;
                this.dumpProfiles();
            }

            if (!this.isProfileLanguageSet()) {
                this.setProfileLanguage();
            }
        }
        else {
            // let oldPrivmxStoragePath = path.resolve(os.homedir(), ".privmx-storage");
            // let oldDevPrivmxStoragePath = path.resolve(os.homedir(), ".privmx-dev-storage");
            this.profiles = {
                devInitProfile: null,
                initProfile: null,
                deviceIdSeed: this.generateDeviceIsSeed(),
                profiles: {}
            };
            let initProfile = this.createProfile();
            this.profiles.profiles[initProfile.name] = initProfile;
            this.profiles.initProfile = initProfile.name;
            // let devProfile: Profile;
            // if (fs.existsSync(oldDevPrivmxStoragePath)) {
            //     devProfile = this.createProfile();
            //     this.profiles.profiles[devProfile.name] = devProfile;
            //     this.profiles.devInitProfile = devProfile.name;
            // }
            this.dumpProfiles();
            // this.copyOldStorage(initProfile, oldPrivmxStoragePath);
            // this.copyOldStorage(devProfile, oldDevPrivmxStoragePath);
        }

    }

    isProfileLanguageSet(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].lang != null;
    }

    isLicenceAccepted(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].licenceAccepted == true;
    }

    isAutostartEnabled(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].autostartEnabled == true;
    }

    isErrorsLoggingEnabled(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].errorsLoggingEnabled == true;
    }


    getCcApiEndpoint(): string {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].ccApiEndpoint ? this.profiles.profiles[profileName].ccApiEndpoint : null;
    }


    setLicenceAccepted(): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].licenceAccepted = true;
        }
        this.dumpProfiles();
    }

    setAutostartEnabled(enabled: boolean): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].autostartEnabled = enabled;
        }
        this.dumpProfiles();
    }

    setErrorsLoggingEnabled(enabled: boolean): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].errorsLoggingEnabled = enabled;
        }
        this.dumpProfiles();
    }


    isLoginInfoVisible(): boolean {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        return profileName && this.profiles.profiles[profileName] && this.profiles.profiles[profileName].loginInfoVisible !== false;
    }

    setLoginInfoHidden(): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (profileName) {
            this.profiles.profiles[profileName].loginInfoVisible = false;
        }
        this.dumpProfiles();
    }



    setProfileLanguage(lang?: string): void {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;

        if (profileName) {
            this.profiles.profiles[profileName].lang = lang ? lang : this.getDefaultLangCode();
        }

        this.dumpProfiles();
    }

    getLangCode(locale: string): string {
        let sep: number = locale.indexOf("-");
        if (sep >= 0) {
            return locale.substr(0, sep);
        }
        return locale;
    }

    getProfileLanguage(): string {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        if (!(profileName in this.profiles.profiles)) {
            console.log("Trying to read profile language but given profile ", profileName, "does not exists. Fallback to system locale.");
            return this.getDefaultLangCode();
        }
        return this.profiles.profiles[profileName].lang;
    }
    
    getDefaultLangCode(): string {
        let langCode = this.getLangCode(electron.app.getLocale());
        if (LocaleService.canUseAsDefaultLanguage(langCode)) {
            return langCode;
        }
        return LocaleService.DEFAULT_LANG_CODE;
    }

    static create(isInDevMode: boolean): Q.Promise<ProfilesManager> {
        let profilesManager: ProfilesManager;
        return Q().then(() => {
            profilesManager = new ProfilesManager(isInDevMode);
            return ProfilesManager.getDeviceId(profilesManager.profiles.deviceIdSeed);
        })
            .then(deviceId => {
                profilesManager.deviceId = deviceId;
                return profilesManager
            });
    }

    generateDeviceIsSeed(): string {
        return privfs.crypto.serviceSync.randomBytes(10).toString("hex");
    }

    static getDeviceId(deviceIdSeed: string): Q.Promise<string> {
        return Q().then(() => {
            return systeminformation.uuid();
        })
            .then(uuid => {
                let cpus = os.cpus();
                let hardwareInfo = deviceIdSeed + ":" + cpus.length + ":" + (cpus.length == 0 ? "" : cpus[0].model) + ":" + uuid.os;
                return privfs.crypto.service.sha256(Buffer.from(hardwareInfo, "utf8"));
            })
            .then(hash => {
                return hash.slice(0, 16).toString("hex");
            });
    }

    onNewProfile(handler: (absPath: string) => void) {
        this.onNewProfileHandlers.push(handler);
    }

    // copyOldStorage(profile: Profile, oldStoragePath: string) {
    //     if (profile != null && fs.existsSync(oldStoragePath)) {
    //         let profileEx = this.prepareProfile(profile);
    //         fse.copySync(oldStoragePath, profileEx.storageAbsolutePath, {overwrite: true});
    //     }
    // }

    createProfile(): Profile {
        let profileName: string;
        let profilePath: string;
        do {
            profileName = privfs.crypto.serviceSync.randomBytes(10).toString("hex");
            profilePath = path.resolve(this.profilesPath, profileName);
        }
        while (fs.existsSync(profilePath));
        fse.mkdirsSync(profilePath);
        let profile = {
            name: profileName,
            path: profileName,
            pathIsRelative: true,
            lang: this.getDefaultLangCode(),
        };
        return profile;
    }

    getCurrentProfile(): ProfileEx {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        let profile = this.profiles.profiles[profileName];
        if (profile == null) {
            profile = this.createProfile();
            this.profiles.profiles[profile.name] = profile;
            if (this.isInDevMode) {
                this.profiles.devInitProfile = profile.name;
            }
            else {
                this.profiles.initProfile = profile.name;
            }
            this.dumpProfiles();
        }
        return this.prepareProfile(profile);
    }

    prepareProfile(profile: Profile): ProfileEx {
        let absolutePath = profile.pathIsRelative ? path.resolve(this.profilesPath, profile.path) : profile.path;
        fse.mkdirsSync(absolutePath);
        let storageAbsolutePath = path.resolve(absolutePath, "storage");
        fse.mkdirsSync(storageAbsolutePath);
        let tmpAbsolutePath = path.resolve(absolutePath, "tmp");
        if (fse.existsSync(tmpAbsolutePath)) {
            try {
                fse.removeSync(tmpAbsolutePath);
            }
            catch (e) { }
        }
        fse.mkdirsSync(tmpAbsolutePath);

        let tmpShortcuts = KeyboardShortcuts.defaultShortcuts;
        if (fse.existsSync(path.resolve(absolutePath, "shortcuts-example.json"))) {
            fse.unlinkSync(path.resolve(absolutePath, "shortcuts-example.json"));
        }
        fse.writeFileSync(path.resolve(absolutePath, "shortcuts-example.json"), JSON.stringify(tmpShortcuts, null, 2), "utf8");


        return {
            name: profile.name,
            absolutePath: absolutePath,
            storageAbsolutePath: storageAbsolutePath,
            tmpAbsolutePath: tmpAbsolutePath,
            getLanguage: () => this.getProfileLanguage(),
            setLanguage: (lang: string) => {
                this.setProfileLanguage(lang);
            },
            isLicenceAccepted: () => this.isLicenceAccepted(),
            getCcApiEndpoint: () => this.getCcApiEndpoint(),
            setLicenceAccepted: () => this.setLicenceAccepted(),
            isLoginInfoVisible: () => this.isLoginInfoVisible(),
            setLoginInfoHidden: () => this.setLoginInfoHidden(),
            isAutostartEnabled: () => this.isAutostartEnabled(),
            setAutostartEnabled: (enabled: boolean) => this.setAutostartEnabled(enabled),
            isErrorsLoggingEnabled: () => this.isErrorsLoggingEnabled(),
            setErrorsLoggingEnabled: (enabled: boolean) => this.setErrorsLoggingEnabled(enabled)
        };
    }

    dumpProfiles() {
        fs.writeFileSync(this.profilesConfigPath, JSON.stringify(this.profiles, null, 2), "utf8");
    }

    deleteCurrentProfile() {
        let profileName = this.isInDevMode ? this.profiles.devInitProfile : this.profiles.initProfile;
        let profile = this.profiles.profiles[profileName];
        if (profile != null) {
            let absolutePath = profile.pathIsRelative ? path.resolve(this.profilesPath, profile.path) : profile.path;
            fse.removeSync(absolutePath);
            delete this.profiles.profiles[profile.name];
            if (this.isInDevMode) {
                this.profiles.devInitProfile = null;
            }
            else {
                this.profiles.initProfile = null;
            }
            this.dumpProfiles();
            let profile2 = this.getCurrentProfile();

            let basePath = profile2.storageAbsolutePath;
            for (let handler of this.onNewProfileHandlers) {
                handler(basePath);
            }
        }
    }
}
