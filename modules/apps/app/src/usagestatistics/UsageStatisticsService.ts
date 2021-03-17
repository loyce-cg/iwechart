import { app, mail, utils, Types } from "pmc-mail"
export interface State {
    messages: number;
    files: number;
    tasks: number;
}

export interface StatisticsChangeEvent extends State {
    type: "statistics-change";
}
export class UsageStatisticsService {
    private static readonly PREFERENCES_MAIN_KEY = "usage-statistics-service";
    private static readonly STATE_KEY = UsageStatisticsService.PREFERENCES_MAIN_KEY + ":state";
    private loadedModules: {[name: string]: boolean} = {};
    private currentState: State = {files: null, messages: null, tasks: null};
    private stateModifiedTime: number = 0;
    private initializeDefer: Promise<void>;
    private refreshLock: boolean = false;
    eventDispatcher: utils.EventDispatcher;


    constructor(private app: app.common.CommonApplication, private session: mail.session.Session) {
        this.eventDispatcher = new utils.EventDispatcher();
        this.bindToModulesLoadEvents();
    }
    
    private bindToModulesLoadEvents(): void {
        this.app.bindEvent<Types.event.PluginModuleReadyEvent>(this.app, "plugin-module-ready", event => {
            this.setModuleLoaded(event.name);                
        })
    }

    private async setModuleLoaded(moduleName: string): Promise<void> {
        this.loadedModules[moduleName] = true;
        if (moduleName == "chat") {
            this.getSectionsMessagesCount();
        }
        if (moduleName == "tasks") {
            this.getTasksCount();
        }

        if (moduleName == "notes2") {
            this.getFilesAndDirsCount();
        }
    }

    private async getSectionsMessagesCount(): Promise<number> {
        if ("chat" in this.loadedModules) {
            const manager = await this.session.mailClientApi.privmxRegistry.getSinkIndexManager();
            const messages = manager.sinkIndexCollection.list.filter(x => x.sink.acl == "shared").reduce((a, b) => a + b.getReadableMessagesCount(), 0)    
            this.updateMessagesState(messages);
            return messages;
        }
        else {
            return this.currentState.messages;
        }
    }

    private async updateMessagesState(messages: number): Promise<void> {
        if (this.currentState.messages != messages) {
            this.currentState.messages = messages;
            await this.saveState(this.currentState);
        }
    }

    private async getTasksCount(): Promise<number> {
        if ("tasks" in this.loadedModules) {
            let tasks = await this.app.components["tasks-plugin"];
            const allTasks = await tasks.getTasks(this.session, null);
            const tasksCount = Object.keys(allTasks).length;
            this.updateTasksState(tasksCount);
            return tasksCount;    
        }
        else {
            return this.currentState.tasks;
        }
    }

    private async updateTasksState(tasks: number): Promise<void> {
        if (this.currentState.tasks != tasks) {
            this.currentState.tasks = tasks;
            await this.saveState(this.currentState);
        }
    }
    
    private async getAllFileTrees() {
        const list = await Promise.all(this.session.sectionManager.filteredCollection.list.map(x => x.getFileTree()));
        return list.filter(x => !!x);
    }
    
    private sumFilesAndDirsInFileTrees(fileTrees: mail.filetree.nt.Tree[]) {
        return fileTrees.reduce((a, b) => a + b.collection.size(), 0);
    }

    private async getFilesAndDirsCount(): Promise<number> {
        if ("notes2" in this.loadedModules) {
            const fileTrees = await this.getAllFileTrees();
            const filesCount = this.sumFilesAndDirsInFileTrees(fileTrees);
            this.updateFilesState(filesCount);
            return filesCount;    
        }
        else {
            return this.currentState.files;
        }
    }

    private async updateFilesState(files: number): Promise<void> {
        if (this.currentState.files != files) {
            this.currentState.files = files;
            await this.saveState(this.currentState);
        }
    }

    public async init(): Promise<void> {
        if (! this.initializeDefer) {
            this.initializeDefer = new Promise<void>(async(resolve) => {
                return this.loadState()
                .then(result => {
                    this.currentState = result;
                    this.dispatchChangeEvent();
                    resolve();
                })
            });    
        }
        
        return this.initializeDefer;
    }



    private async loadState(): Promise<State> {
        const prefs = await this.session.mailClientApi.privmxRegistry.getUserPreferences();
        const stateRaw = prefs.getValue(UsageStatisticsService.STATE_KEY, null);
        const state = stateRaw ? <State>JSON.parse(stateRaw): <State>{messages: null, files: null, tasks: null};
        return state;
    }

    private async saveState(state: State): Promise<void> {
        let currTime = Date.now();
        if (currTime < this.stateModifiedTime) {
            return;
        }
        this.dispatchChangeEvent();
        this.stateModifiedTime = currTime;
        const prefs = await this.session.mailClientApi.privmxRegistry.getUserPreferences();
        await prefs.set(UsageStatisticsService.STATE_KEY, JSON.stringify(state), true);
    }

    private dispatchChangeEvent(): void {
        this.eventDispatcher.dispatchEvent<StatisticsChangeEvent>(<StatisticsChangeEvent>{
            type: "statistics-change",
            messages: this.currentState.messages,
            files: this.currentState.files,
            tasks: this.currentState.tasks
        });
    }

    public async refresh(): Promise<void> {
        if (this.refreshLock) {
            return;
        }
        this.refreshLock = true;
        await this.init();
        await this.getFilesAndDirsCount();
        await this.getTasksCount();
        await this.getSectionsMessagesCount();    
        this.refreshLock = false;
    }
}