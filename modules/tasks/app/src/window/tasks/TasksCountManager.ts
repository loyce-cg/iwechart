import {component, mail} from "pmc-mail";
import {TasksPlugin} from "../../main/TasksPlugin";
import {Action, CustomTasksElements} from "../../main/Types";
import {Task} from "../../main/data/Task";

export interface TasksSummary {
    tasks: {[id: string]: Task};
    count: number;
    lastDate: number;
}

export class TasksCountManager {
    
    customsCount: {[id: string]: TasksSummary};
    sectionsCount: {[id: string]: TasksSummary};
    conv2Count: {[id: string]: TasksSummary};
    
    constructor(
        public session: mail.session.Session,
        public privateSection: mail.section.SectionService,
        public tasksPlugin: TasksPlugin,
        public sidebar: component.sidebar.SidebarController,
        public isRemote: boolean = false,
    ) {
        this.refresh();
    }
    
    refresh(): void {
        this.customsCount = {};
        this.sectionsCount = {};
        this.conv2Count = {};
    }
    
    getSectionElementsCount(section: mail.section.SectionService): number {
        return this.getSectionTasksSummary(section.getId()).count;
    }
    
    getConv2ElementsCount(conv2section: mail.section.Conv2Section): number {
        return this.getConv2TasksSummary(conv2section.id).count;
    }
    
    getCustomElementElementsCount(customElement: component.customelementlist.CustomElement): number {
        return this.getCustomTasksSummary(customElement.id).count;
    }
    
    getSectionLastDate(section: mail.section.SectionService): number {
        return this.getSectionTasksSummary(section.getId()).lastDate;
    }
    
    getConv2LastDate(conv2section: mail.section.Conv2Section): number {
        return this.getConv2TasksSummary(conv2section.id).lastDate;
    }
    
    getCustomElementLastDate(customElement: component.customelementlist.CustomElement): number {
        return this.getCustomTasksSummary(customElement.id).lastDate;
    }
    
    getSectionTasksSummary(id: string): TasksSummary {
        if (!(id in this.sectionsCount)) {
            this.sectionsCount[id] = this.getTasksSummaryInSection(id);
        }
        return this.sectionsCount[id];
    }
    
    getCustomTasksSummary(id: string): TasksSummary {
        if (!(id in this.customsCount)) {
            if (id == CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID) {
                let myId = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(task => task.isAssignedTo(myId) && !task.getIsTrashed());
            }
            else if (id == CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
                let myId = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(task => task.getCreatedBy() == myId && !task.getIsTrashed());
            }
            else if (id == CustomTasksElements.ALL_TASKS_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(task => !task.getIsTrashed());
            }
            else if (id == CustomTasksElements.TRASH_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(task => task.getIsTrashed());
            }
            else if (id == this.tasksPlugin.getPrivateSectionId()) {
                this.customsCount[id] = this.getTasksSummaryInSection(id);
            }
            else {
                this.customsCount[id] = {
                    tasks: {},
                    count: 0,
                    lastDate: 0
                };
            }
        }
        return this.customsCount[id];
    }
    
    getConv2TasksSummary(id: string): TasksSummary {
        if (!(id in this.conv2Count)) {
            let users = this.tasksPlugin.getConv2Users(this.session, id, true);
            this.conv2Count[id] = this.getTasksSummaryBy(task => this.tasksPlugin.isAssignedToUsers(task, users) && !task.getIsTrashed());
        }
        return this.conv2Count[id];
    }
    
    getTasksSummaryBy(filter: (task: Task) => boolean): TasksSummary {
        let summary: TasksSummary = {
            tasks: {},
            count: 0,
            lastDate: 0
        };
        for (let tId in this.tasksPlugin.tasks[this.session.hostHash]) {
            let task = this.tasksPlugin.tasks[this.session.hostHash][tId];
            if (!(task.getProjectId() in this.tasksPlugin.projects[this.session.hostHash])) {
                continue;
            }
            if (filter(task)) {
                summary.tasks[tId] = task;
                summary.count++;
                summary.lastDate = Math.max(summary.lastDate, task.getModifiedDateTime() || 0);
            }
        }
        return summary;
    }
    
    getTasksSummaryInSection(sectionId: string): TasksSummary {
        return this.getTasksSummaryBy(task => task.getProjectId() == sectionId && !task.getIsTrashed());
    }
    
    addTaskToSummary(taskId: string, summary: TasksSummary): boolean {
        if (taskId in summary.tasks) {
            return false;
        }
        let task = this.tasksPlugin.getTask(this.session, taskId);
        if (task == null) {
            return false;
        }
        summary.tasks[taskId] = task;
        summary.count++;
        summary.lastDate = Math.max(summary.lastDate, task.getModifiedDateTime() || 0);
        return true;
    }
    
    removeTaskFromSummary(taskId: string, summary: TasksSummary): boolean {
        if (!(taskId in summary.tasks)) {
            return false;
        }
        delete summary.tasks[taskId];
        summary.count--;
        summary.lastDate = 0;
        for (let id in summary.tasks) {
            let modDate = summary.tasks[id].getModifiedDateTime() || 0;
            if (modDate > summary.lastDate) {
                summary.lastDate = modDate;
            }
        }
        return true;
    }
    
    addTaskToCustomElement(id: string, taskId: string) {
        if (this.addTaskToSummary(taskId, this.getCustomTasksSummary(id))) {
            this.updateSidebarCustomElement(id);
        }
    }
    
    removeTaskFromCustomElement(id: string, taskId: string) {
        if (this.removeTaskFromSummary(taskId, this.getCustomTasksSummary(id))) {
            this.updateSidebarCustomElement(id);
        }
    }
    
    updateSidebarCustomElement(id: string) {
        if (this.isRemote) {
            return;
        }
        if (!this.sidebar) {
            return;
        }
        // let index = this.sidebar ? this.sidebar.customElementList.customElementsCollection.indexOfBy(x => x.id == id) : -1;
        // if (index != -1) {
        //     this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
        // }
        let element = this.sidebar ? this.sidebar.customElementList.customElementsCollection.find(x => x.id == id) : null;
        if (element) {
            this.sidebar.customElementList.customElementsCollection.triggerBaseUpdateElement(element);
        }
    }
    
    addTaskToSection(sectionId: string, taskId: string) {
        if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
    }
    
    removeTaskFromSection(sectionId: string, taskId: string) {
        if (this.removeTaskFromSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
    }
    
    updateSidebarSection(sectionId: string) {
        // let index = this.sidebar ? this.sidebar.sectionList.sortedCollection.collection.indexOfBy(x => x.getId() == sectionId) : -1;
        // if (index != -1) {
        //     this.sidebar.sectionList.sortedCollection.triggerBaseUpdateAt(index);
        // }
        if (!this.sidebar) {
            return;
        }
        let collection = this.sidebar.sectionList.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteSectionsLists[this.session.hostHash].sortedCollection;
        }
        let element = this.sidebar ? collection.find(x => x.getId() == sectionId) : null;
        if (element) {
            collection.triggerBaseUpdateElement(element);
        }
        this.updateSidebarHostElement();
    }
    
    addTaskToConv2(id: string, taskId: string) {
        if (this.addTaskToSummary(taskId, this.getConv2TasksSummary(id))) {
            this.updateSidebarConv2(id);
        }
    }
    
    removeTaskFromConv2(id: string, taskId: string) {
        if (this.removeTaskFromSummary(taskId, this.getConv2TasksSummary(id))) {
            this.updateSidebarConv2(id);
        }
    }
    
    updateSidebarConv2(c2sId: string) {
        // let index = this.sidebar ? this.sidebar.conv2List.sortedCollection.collection.indexOfBy(x => x.id == c2sId) : -1;
        // if (index != -1) {
        //     this.sidebar.conv2List.sortedCollection.triggerBaseUpdateAt(index);
        // }
        if (!this.sidebar) {
            return;
        }
        let collection = this.sidebar.conv2List.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteConv2Lists[this.session.hostHash].sortedCollection;
        }
        let element = this.sidebar ? collection.find(x => x.id == c2sId) : null;
        if (element) {
            collection.triggerBaseUpdateElement(element);
        }
        this.updateSidebarHostElement();
    }
    
    updateTasksCount(taskId: string, action: Action) {
        if (action == "added") {
            this.addTask(taskId);
        }
        else if (action == "modified") {
            this.modifyTask(taskId);
        }
        else if (action == "deleted") {
            this.deleteTask(taskId);
        }
        else if (action == "section-changed") {
            this.deleteTask(taskId);
        }
    }
    
    addTask(taskId: string): void {
        let task = this.tasksPlugin.getTask(this.session, taskId);
        if (task == null) {
            return;
        }
        if (task.getIsTrashed()) {
            this.addTaskToCustomElement(CustomTasksElements.TRASH_ID, taskId);
        }
        else {
            if (task.isAssignedTo(this.tasksPlugin.getMyId(this.session))) {
                this.addTaskToCustomElement(CustomTasksElements.TASKS_ASSIGNED_TO_ME_ID, taskId);
            }
            if (task.getCreatedBy() == this.tasksPlugin.getMyId(this.session)) {
                this.addTaskToCustomElement(CustomTasksElements.TASKS_CREATED_BY_ME_ID, taskId);
            }
            this.addTaskToCustomElement(CustomTasksElements.ALL_TASKS_ID, taskId);
            let sectionId = task.getProjectId();
            if (sectionId == this.tasksPlugin.getPrivateSectionId()) {
                this.addTaskToCustomElement(sectionId, taskId);
            }
            else {
                this.addTaskToSection(task.getProjectId(), taskId);
            }
            for (let c2sId in this.conv2Count) {
                let users = this.tasksPlugin.getConv2Users(this.session, c2sId, true);
                if (this.tasksPlugin.isAssignedToUsers(task, users)) {
                    this.addTaskToConv2(c2sId, taskId);
                }
            }
        }
    }
    
    deleteTask(taskId: string): void {
        for (let id in this.customsCount) {
            this.removeTaskFromCustomElement(id, taskId);
        }
        for (let id in this.sectionsCount) {
            this.removeTaskFromSection(id, taskId);
        }
        for (let id in this.conv2Count) {
            this.removeTaskFromConv2(id, taskId);
        }
    }
    
    modifyTask(taskId: string): void {
        this.deleteTask(taskId);
        this.addTask(taskId);
    }
    
    updateSidebarHostElement(): void {
        if (!this.isRemote) {
            return;
        }
        let element = this.sidebar.hostList.hostsSortedCollection.find(x => x.host == this.session.host);
        if (element) {
            this.sidebar.hostList.hostsSortedCollection.triggerBaseUpdateElement(element);
        }
    }
    
}
