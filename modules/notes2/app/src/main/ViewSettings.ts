import * as Mail from "pmc-mail";
import { ViewSettingsStorage } from "./ViewSettingsStorage";
import { ViewContext } from "./Common";

// Flags (0, 1, 2, 4, 8, ...)
export enum ViewSettingIsolation {
    NONE = 0, // Global settings e.g. show-task-panel
    PROJECT = 1, // Each project has unique settings
    CONTEXT = 2, // Where TaskGroupsPanel is displayed e.g. notes2 window, summary window
}

export class ViewSetting {
    key: string;
    value: number;
    setDT: number;
}

export interface ViewSettingKey {
    name: string;
    project: string;
    context: string;
}

export class ViewSettings {
	
	static VIEW_MODE: string = "view-mode";
	static SHOW_FILE_PREVIEW: string = "show-file-preview";
	static SHOW_URL_FILES: string = "show-url-files";
    static SHOW_HIDDEN_FILES: string = "show-hidden-files";
    
    settingsInfo: { [name: string]: { defaults: { [key: string]: number }, isolation: number } };
    settingsStorage: ViewSettingsStorage;
    settingsCache: { [projectId: string]: { [context: string]: { [settingName: string]: number } } } = {};
    
    constructor(prefix: string, kvdb: Mail.mail.kvdb.KvdbCollection<Mail.mail.kvdb.KvdbSettingEntry>) {
        this.settingsInfo = {
            "view-mode": { defaults: { "notes2":0, "summary":0, "filechooser":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-file-preview": { defaults: { "global":1 }, isolation: ViewSettingIsolation.NONE },
            "show-url-files": { defaults: { "global":1 }, isolation: ViewSettingIsolation.NONE },
            "show-hidden-files": { defaults: { "global":0 }, isolation: ViewSettingIsolation.NONE },
        };
        
        this.settingsStorage = new ViewSettingsStorage(prefix, kvdb);
    }
    
    isSettingProjectIsolated(name: string): boolean {
        return (this.settingsInfo[name].isolation & ViewSettingIsolation.PROJECT) == ViewSettingIsolation.PROJECT;
    }
    
    isSettingContextIsolated(name: string): boolean {
        return (this.settingsInfo[name].isolation & ViewSettingIsolation.CONTEXT) == ViewSettingIsolation.CONTEXT;
    }
    
    isSettingIsolated(name: string): boolean {
        return !this.isSettingProjectIsolated(name) && !this.isSettingContextIsolated(name);
    }
    
    loadSettings(session: Mail.mail.session.Session, projectId: string, overrideDefaults?: { [key: string]: number }): Q.Promise<void> {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!(projectId in this.settingsCache)) {
            this.settingsCache[projectId] = {};
        }
        if (!overrideDefaults) {
            overrideDefaults = {};
        }
        let projectSettings = this.settingsCache[projectId];
        for (let name in this.settingsInfo) {
            let data = this.settingsInfo[name];
            for (let ctx in data.defaults) {
                if (!projectSettings[ctx]) {
                    projectSettings[ctx] = {};
                }
                projectSettings[ctx][name] = (name in overrideDefaults) ? overrideDefaults[name] : data.defaults[ctx];
            }
        }
        return this.settingsStorage.getArray(projectId).then(arr => {
            if (!arr) {
                return;
            }
            arr.forEach(x => {
                let key: ViewSettingKey = JSON.parse(x.key);
                projectSettings[key.context][key.name] = x.value;
            });
        });
    }
    
    saveSetting(session: Mail.mail.session.Session, name: string, value: number, projectId: string, context: ViewContext): void {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = ViewContext.Global;
        }
        this.settingsCache[projectId][context][name] = value;
        
        let now = new Date().getTime();
        this.settingsStorage.setValue(projectId, [{
            key: this.getKey(name, projectId, context),
            value: value,
            setDT: now,
        }]);
    }
    
    getSetting(session: Mail.mail.session.Session, name: string, projectId: string, context: ViewContext): number {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = ViewContext.Global;
        }
        let val = this.settingsCache[projectId][context][name];
        if (val === 0 || val === 1) {
            return val;
        }
        return this.settingsInfo[name].defaults[context];
    }
    
    hasProject(session: Mail.mail.session.Session, projectId: string): boolean {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        return projectId in this.settingsCache;
    }
    
    hasSetting(session: Mail.mail.session.Session, name: string, projectId: string, context: ViewContext): boolean {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = ViewContext.Global;
        }
        return (projectId in this.settingsCache) && (context in this.settingsCache[projectId]) && (name in this.settingsCache[projectId][context]);
    }
    
    protected getKey(name: string, finalProjectId: string, context: ViewContext): string {
        let key: ViewSettingKey = {
            name: name,
            project: finalProjectId,
            context: context,
        };
        return JSON.stringify(key);
    }
    
    static getSettingFullProjectId(session: Mail.mail.session.Session, projectId: string): string {
        if (!session || !projectId) {
            return projectId;
        }
        let isRemoteSession = session.sessionType == "remote";
        let fullProjectId = isRemoteSession ? `${session.hostHash}--${projectId}` : projectId;
        return fullProjectId;
    }
    
}
