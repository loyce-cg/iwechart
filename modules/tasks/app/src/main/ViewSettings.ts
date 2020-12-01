import * as Mail from "pmc-mail";
import { ViewSettingsStorage } from "./ViewSettingsStorage";
import { ViewContext } from "./Types";

// Flags (0, 1, 2, 4, 8, ...)
export enum ViewSettingIsolation {
    NONE = 0, // Global settings e.g. show-task-panel
    PROJECT = 1, // Each project has unique settings
    CONTEXT = 2, // Where TaskGroupsPanel is displayed e.g. tasks window, summary window
}

export class ViewSetting {
    key: string;
    value: number|string;
    setDT: number;
}

export interface ViewSettingKey {
    name: string;
    project: string;
    context: string;
}

export class ViewSettings {
    
    settingsInfo: { [name: string]: { defaults: { [key: string]: number|string }, isolation: number } };
    settingsStorage: ViewSettingsStorage;
    settingsCache: { [projectId: string]: { [context: string]: { [settingName: string]: number|string } } } = {};
    protected globalSettingsUsingDefault: { [key: string]: boolean } = {};
    
    constructor(prefix: string, kvdb: Mail.mail.kvdb.KvdbCollection<Mail.mail.kvdb.KvdbSettingEntry>) {
        this.settingsInfo = {
            "show-task-panel": { defaults: { "global":1 }, isolation: ViewSettingIsolation.NONE },
            "enter-saves-task": { defaults: { "global":0 }, isolation: ViewSettingIsolation.NONE },
            "enter-adds-comment": { defaults: { "global":0 }, isolation: ViewSettingIsolation.NONE },
            "horizontal-task-window-layout": { defaults: { "global":1 }, isolation: ViewSettingIsolation.NONE },
            "show-only-unread": { defaults: { "global":0 }, isolation: ViewSettingIsolation.NONE },
            "narrow-issue-rows": { defaults: { "global":0 }, isolation: ViewSettingIsolation.NONE },
            
            "show-orphans": { defaults: { "global":1 }, isolation: ViewSettingIsolation.PROJECT },
            
            "show-header-per-list": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-list-progress": { defaults: { "tasks":1, "summary":0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-task-numbers": { defaults: { "tasks":1, "summary":0 }, isolation: ViewSettingIsolation.CONTEXT },
            "show-all-other-list-names": { defaults:  { "tasks":1, "summary":0 }, isolation: ViewSettingIsolation.CONTEXT },
            
            "show-hash-id-column": { defaults: { "tasks":1, "summary":1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-task-column": { defaults: { "tasks":1, "summary":1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-type-column": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-status-column": { defaults: { "tasks":1, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-priority-column": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-assigned-to-column": { defaults: { "tasks":1, "summary":1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-attachments-column": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-created-column": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-modified-column": { defaults: { "tasks":1, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-recently-modified": { defaults: { "tasks":1, "summary":1 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "kanban-mode": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "hide-done": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "show-full-task-descriptions": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "collapsed-taskgroups": { defaults: { "tasks":"[]", "summary":"[]" }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "filter": { defaults: { "tasks":"all-tasks", "summary":"all-tasks" }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "kanban-filter": { defaults: { "tasks":"all-tasks", "summary":"all-tasks" }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
            "texts-with-status-color": { defaults: { "tasks":0, "summary":0 }, isolation: ViewSettingIsolation.PROJECT | ViewSettingIsolation.CONTEXT },
        };
        
        this.settingsStorage = new ViewSettingsStorage(prefix, kvdb);
    }
    
    isSettingProjectIsolated(name: string): boolean {
        return (this.settingsInfo && (name in this.settingsInfo) && this.settingsInfo[name].isolation & ViewSettingIsolation.PROJECT) == ViewSettingIsolation.PROJECT;
    }
    
    isSettingContextIsolated(name: string): boolean {
        return (this.settingsInfo && (name in this.settingsInfo) && this.settingsInfo[name].isolation & ViewSettingIsolation.CONTEXT) == ViewSettingIsolation.CONTEXT;
    }
    
    isSettingIsolated(name: string): boolean {
        return !this.isSettingProjectIsolated(name) && !this.isSettingContextIsolated(name);
    }
    
    isSettingGlobal(name: string): boolean {
        return this.settingsInfo && (name in this.settingsInfo) && this.settingsInfo[name].isolation == ViewSettingIsolation.NONE;
    }
    
    loadSettings(session: Mail.mail.session.Session, projectId: string, overrideDefaults?: { [key: string]: number|string }): Q.Promise<void> {
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
                if (this.isSettingGlobal(name)) {
                    this.globalSettingsUsingDefault[name] = true;
                }
            }
        }
        return this.settingsStorage.getArray(projectId).then(arr => {
            if (!arr) {
                return;
            }
            arr.forEach(x => {
                let key: ViewSettingKey = JSON.parse(x.key);
                projectSettings[key.context][key.name] = x.value;
                if (this.isSettingGlobal(key.name)) {
                    this.globalSettingsUsingDefault[key.name] = false;
                }
            });
        });
    }
    
    saveSetting(session: Mail.mail.session.Session, name: string, value: number|string, projectId: string, context: ViewContext): void {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = ViewContext.Global;
        }
        if (this.isSettingGlobal(name)) {
            this.globalSettingsUsingDefault[name] = false;
        }
        this.settingsCache[projectId][context][name] = value;
        
        let now = new Date().getTime();
        this.settingsStorage.setValue(projectId, [{
            key: this.getKey(name, projectId, context),
            value: value,
            setDT: now,
        }]);
    }
    
    getSetting(session: Mail.mail.session.Session, name: string, projectId: string, context: ViewContext): number|string {
        projectId = ViewSettings.getSettingFullProjectId(session, projectId);
        if (!this.isSettingProjectIsolated(name)) {
            projectId = "__global__";
        }
        if (!this.isSettingContextIsolated(name)) {
            context = ViewContext.Global;
        }
        let val = this.settingsCache[projectId] && this.settingsCache[projectId][context] ? this.settingsCache[projectId][context][name] : null;
        if (val === 0 || val === 1 || (typeof(val) == "string" && typeof(this.settingsInfo[name].defaults[context]) == "string")) {
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
    
    overrideDefaultGlobalSetting(name: string, value: number|string): void {
        if (!(name in this.settingsInfo) || this.isSettingProjectIsolated(name)) {
            return;
        }
        let defaults = this.settingsInfo[name].defaults;
        for (let ctx in defaults) {
            defaults[ctx] = value;
        }
        if (this.isSettingGlobal(name) && this.globalSettingsUsingDefault[name] && this.settingsCache && this.settingsCache["__global__"] && this.settingsCache["__global__"][ViewContext.Global]) {
            this.settingsCache["__global__"][ViewContext.Global][name] = value;
        }
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
