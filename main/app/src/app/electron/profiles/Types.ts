export interface Profile {
    name: string;
    path: string;
    pathIsRelative: boolean;
    lang?: string;
    licenceAccepted?: boolean;
    loginInfoVisible?: boolean;
    ccApiEndpoint?: string;
    autostartEnabled?: boolean;
    errorsLoggingEnabled?: boolean;
}

export interface Profiles {
    initProfile: string;
    devInitProfile: string;
    deviceIdSeed: string;
    profiles: { [name: string]: Profile }
}

export interface ProfileEx {
    name: string;
    absolutePath: string;
    storageAbsolutePath: string;
    tmpAbsolutePath: string;
    getLanguage(): string;
    setLanguage(lang: string): void;
    isLicenceAccepted(): boolean;
    getCcApiEndpoint(): string;
    setLicenceAccepted(): void;
    isLoginInfoVisible(): boolean;
    setLoginInfoHidden(): void;
    isAutostartEnabled(): boolean;
    isErrorsLoggingEnabled(): boolean;
    setAutostartEnabled(enabled: boolean): void;
    setErrorsLoggingEnabled(enabled: boolean): void;
}

export interface UserProfileSettingChangeEvent<T = any> {
    type: "userprofilesettingchange",
    name: string;
    value: T
}