import {utils, mail} from "pmc-mail";
import * as Mail from "pmc-mail";
import Q = Mail.Q;
import {i18n} from "../i18n/index";

export interface NotesPreferences {
    style?: string;
}

export interface MindmapSpec {
    elements: {
        klass: string;
        spec: MindmapElementSpec;
    }[];
    version: number;
    style: {
        name: string
    };
}

export class MindmapElementSpec {
    label: string;
    nodes: MindmapElementSpec[];
}

export interface PartialTasksPlugin {
    addTaskStatusesFromMessage(session: mail.session.Session, statuses: { [taskId: string]: string }, text: string): void;
    addTaskStatusesFromTaskIds(session: mail.session.Session, statuses: { [taskId: string]: string }, taskIds: string[]): void ;
    getTaskIdsFromMessage(text: string): string[];
    openEditTaskWindow(session: mail.session.Session, taskId: string, editMode?: boolean, scrollToComments?: boolean): void;
    watch(session: mail.session.Session, type: "task", id: "*", action: "*", handler: (type: "task", id: string, action: string) => void): void;
    unWatch(session: mail.session.Session, type: "task", id: "*", action: "*", handler: (type: "task", id: string, action: string) => void): void;
    getTaskTooltipContent(session: mail.session.Session, taskIdsStr: string): string;
    getBindedTasksData(session: mail.session.Session, metaBindedElementId: string|null|undefined|number): { taskId: string, labelClass: string }[];
}

export class EditorPlugin {
    
    initPromise: Q.Promise<void>;
    userPreferences: Mail.mail.UserPreferences.UserPreferences;
    
    constructor(public app: Mail.app.common.CommonApplication) {
    }
    
    registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.editor.");
    }
    
    logout() {
        this.initPromise = null;
    }
    
    checkInit(): Q.Promise<void> {
        if (this.initPromise == null) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    }
    
    init() {
        return Q().then(() => {
            return this.app.mailClientApi.loadUserPreferences();
        });
    }
    
    getNotesPreferences(): Q.Promise<NotesPreferences> {
        return this.app.mailClientApi.privmxRegistry.getUserPreferences().then(userPreferences => {
            this.userPreferences = userPreferences;
            return this.getNotesPreferencesC(userPreferences);
        })
    }
    
    getNotesPreferencesC(userPreferences: Mail.mail.UserPreferences.UserPreferences): NotesPreferences {
        return userPreferences.getValue("notes");
    }
    
    getNewMindmapContent(fileName?: string): Q.Promise<Mail.privfs.lazyBuffer.Content> {
        return this.getNotesPreferences().then(notesPreferences => this.getNewMindmapContentC(fileName, notesPreferences));
    }
    
    getNewMindmapContentC(fileName?: string, notesPreferences?: NotesPreferences): Mail.privfs.lazyBuffer.Content {
        let mindmapName = fileName || "new-mindmap";
        if (utils.Lang.endsWith(mindmapName, ".smm")) {
            mindmapName = mindmapName.substring(0, mindmapName.length - 4);
        }
        if (utils.Lang.endsWith(mindmapName, ".pmxmm")) {
            mindmapName = mindmapName.substring(0, mindmapName.length - 6);
        }
        let spec: MindmapSpec = {
            elements: [
                {
                    klass: "MindMapElement",
                    spec: {
                        label: mindmapName,
                        nodes: [
                            {
                                label: "first",
                                nodes: []
                            },
                            {
                                label: "second",
                                nodes: [
                                    {
                                        label: "second-first",
                                        nodes: []
                                    },
                                    {
                                        label: "second-second",
                                        nodes: []
                                    }
                                ]
                            }
                        ]
                    }
                }
            ],
            version: 1,
            style: undefined
        };
        if (notesPreferences && notesPreferences.style) {
            spec.style = {name: notesPreferences.style};
        }
        return Mail.privfs.lazyBuffer.Content.createFromJson(spec, "application/x-smm", mindmapName + ".pmxmm");
    }
    
    getNewTextNoteContent(fileName?: string): Q.Promise<Mail.privfs.lazyBuffer.Content> {
        return this.getNotesPreferences().then(notesPreferences => this.getNewTextNoteContentC(fileName, notesPreferences));
    }
    
    getNewTextNoteContentC(fileName?: string, notesPreferences?: NotesPreferences): Mail.privfs.lazyBuffer.Content {
        let textNoteName = fileName || "new-note-file";
        if (utils.Lang.endsWith(textNoteName, ".stt")) {
            textNoteName = textNoteName.substring(0, textNoteName.length - 4);
        }
        if (utils.Lang.endsWith(textNoteName, ".pmxtt")) {
            textNoteName = textNoteName.substring(0, textNoteName.length - 6);
        }
        let spec = {content: "", style: <{name: string}>undefined};
        if (notesPreferences && notesPreferences.style) {
            spec.style = {name: notesPreferences.style};
        }
        return Mail.privfs.lazyBuffer.Content.createFromJson(spec, "application/x-stt", textNoteName + ".pmxtt");
    }
    
    openTask(session: mail.session.Session, _sectionId: string, id: string): void {
        let tasksPlugin: PartialTasksPlugin = this.app.getComponent("tasks-plugin");
        if (!tasksPlugin) {
            return;
        }
        tasksPlugin.openEditTaskWindow(session, id, true);
    }
    
}