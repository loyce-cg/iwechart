import { component, mail } from "pmc-mail";
import { Task } from "privfs-mail-client-tasks-plugin/src/main/data/Task";
import { TasksPlugin } from "privfs-mail-client-tasks-plugin/src/main/TasksPlugin";
import { CustomTasksElements } from "./Types";
import { Action, TasksMap } from "privfs-mail-client-tasks-plugin/src/main/Types";
import { CalendarPlugin } from "./CalendarPlugin";
import { FileModel } from "../component/calendarPanel/CalendarPanelController";

export interface TasksSummary {
    tasks: { [id: string]: Task };
    files: { [id: string]: FileModel };
    count: number;
    lastDate: number;
}

export class CalendarTasksCountManager {
    
    customsCount: { [id: string]: TasksSummary };
    sectionsCount: { [id: string]: TasksSummary };
    conv2Count: { [id: string]: TasksSummary };
    
    constructor(
        public session: mail.session.Session,
        public privateSection: mail.section.SectionService,
        public calendarPlugin: CalendarPlugin,
        public tasksPlugin: TasksPlugin,
        public sidebar: component.sidebar.SidebarController,
        public countFiles: boolean,
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
                this.customsCount[id] = this.getTasksSummaryBy(task => this.isCalendarTask(task) && task.isAssignedTo(myId) && !task.getIsTrashed(), file => false);
            }
            else if (id == CustomTasksElements.TASKS_CREATED_BY_ME_ID) {
                let myId = this.tasksPlugin.getMyId(this.session);
                this.customsCount[id] = this.getTasksSummaryBy(task => this.isCalendarTask(task) && task.getCreatedBy() == myId && !task.getIsTrashed(), file => !file.trashed && file.createdBy == this.calendarPlugin.getMyId(this.session));
            }
            else if (id == CustomTasksElements.ALL_TASKS_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(task => this.isCalendarTask(task) && !task.getIsTrashed(), file => !file.trashed);
            }
            else if (id == CustomTasksElements.TRASH_ID) {
                this.customsCount[id] = this.getTasksSummaryBy(task => this.isCalendarTask(task) && task.getIsTrashed(), file => file.trashed);
            }
            else if (id == this.tasksPlugin.getPrivateSectionId()) {
                this.customsCount[id] = this.getTasksSummaryInSection(id);
            }
            else {
                this.customsCount[id] = {
                    tasks: {},
                    files: {},
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
            this.conv2Count[id] = this.getTasksSummaryBy(task => this.isCalendarTask(task) && this.tasksPlugin.isAssignedToUsers(task, users), file => false);
        }
        return this.conv2Count[id];
    }
    
    getTasksSummaryBy(filter: (task: Task) => boolean, fileFilter: (file: FileModel) => boolean): TasksSummary {
        let summary: TasksSummary = {
            tasks: {},
            files: {},
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
        this.buildFilesSummary(summary, fileFilter);
        return summary;
    }
    
    getTasksSummaryInSection(sectionId: string): TasksSummary {
        let extraSections = this.calendarPlugin.getExtraCalendars(this.session, sectionId) || [];
        return this.getTasksSummaryBy(
            task => this.isCalendarTask(task) && (task.getProjectId() == sectionId || extraSections.indexOf(task.getProjectId()) >= 0) && !task.getIsTrashed(),
            file => !file.trashed && (file.sectionId == sectionId || extraSections.indexOf(file.sectionId) >= 0)
        );
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
        if (id == this.calendarPlugin.getPrivateSectionId()) {
            let extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, id);
            for (let extraSectionId of extraSections) {
                if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(extraSectionId))) {
                    this.updateSidebarSection(extraSectionId);
                }
            }
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
        let index = this.sidebar ? this.sidebar.customElementList.customElementsCollection.indexOfBy(x => x.id == id) : -1;
        if (index != -1) {
            this.sidebar.customElementList.customElementsCollection.triggerUpdateAt(index);
        }
    }
    
    addTaskToSection(sectionId: string, taskId: string) {
        if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
        let extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, sectionId);
        for (let extraSectionId of extraSections) {
            if (this.addTaskToSummary(taskId, this.getSectionTasksSummary(extraSectionId))) {
                this.updateSidebarSection(extraSectionId);
            }
        }
    }
    
    removeTaskFromSection(sectionId: string, taskId: string) {
        if (this.removeTaskFromSummary(taskId, this.getSectionTasksSummary(sectionId))) {
            this.updateSidebarSection(sectionId);
        }
        let extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, sectionId);
        for (let extraSectionId of extraSections) {
            if (this.removeTaskFromSummary(taskId, this.getSectionTasksSummary(extraSectionId))) {
                this.updateSidebarSection(extraSectionId);
            }
        }
    }
    
    updateSidebarSection(sectionId: string) {
        if (!this.sidebar) {
            return;
        }
        let collection = this.sidebar.sectionList.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteSectionsLists[this.session.hostHash].sortedCollection;
        }
        let index = this.sidebar ? collection.collection.indexOfBy(x => x.getId() == sectionId) : -1;
        if (index != -1) {
            collection.triggerBaseUpdateAt(index);
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
        if (!this.sidebar) {
            return;
        }
        let collection = this.sidebar.conv2List.sortedCollection;
        if (this.isRemote) {
            collection = this.sidebar.remoteConv2Lists[this.session.hostHash].sortedCollection;
        }
        let index = this.sidebar ? collection.collection.indexOfBy(x => x.id == c2sId) : -1;
        if (index != -1) {
            collection.triggerBaseUpdateAt(index);
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
        if (!this.isCalendarTask(task)) {
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
    
    isCalendarTask(task: Task): boolean {
        return task && task.getStartTimestamp() != null;
    }
    
    buildFilesSummary(summary: TasksSummary, filter: (file: FileModel) => boolean): void {
        if (!summary) {
            return;
        }
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        for (let identifier in this.calendarPlugin.fileModels[this.session.hostHash]) {
            if (filter(this.calendarPlugin.fileModels[this.session.hostHash][identifier])) {
                this.addFileToSummary(this.calendarPlugin.fileModels[this.session.hostHash][identifier], summary);
            }
        }
    }
    
    addFile(identifier: string): void {
        if (!this.calendarPlugin.fileModels[this.session.hostHash]) {
            this.calendarPlugin.fileModels[this.session.hostHash] = {};
        }
        let model = this.calendarPlugin.fileModels[this.session.hostHash][identifier];
        if (!model) {
            return;
        }
        if (model.trashed) {
            this.addFileToSummary(model, this.customsCount[CustomTasksElements.TRASH_ID], () => this.updateSidebarCustomElement(CustomTasksElements.TRASH_ID));
        }
        else {
            this.addFileToSummary(model, this.customsCount[CustomTasksElements.ALL_TASKS_ID], () => this.updateSidebarCustomElement(CustomTasksElements.ALL_TASKS_ID));
            if (model.createdBy == this.calendarPlugin.getMyId(this.session)) {
                this.addFileToSummary(model, this.customsCount[CustomTasksElements.TASKS_CREATED_BY_ME_ID], () => this.updateSidebarCustomElement(CustomTasksElements.TASKS_CREATED_BY_ME_ID));
            }
            this.addFileToSummary(model, this.getFilesSummary(model.sectionId), () => {
                this.updateSidebarSection(model.sectionId);
                this.updateSidebarCustomElement(model.sectionId);
            });
            let extraSections = this.calendarPlugin.getSectionsForWhichIsExtra(this.session, model.sectionId);
            for (let extraSectionId of extraSections) {
                this.addFileToSummary(model, this.getFilesSummary(extraSectionId), () => {
                    this.updateSidebarSection(extraSectionId);
                    this.updateSidebarCustomElement(extraSectionId);
                });
            }
        }
    }
    
    removeFile(identifier: string): void {
        for (let k in this.customsCount) {
            this.removeFileFromSummary(identifier, this.customsCount[k], () => this.updateSidebarCustomElement(k));
        }
        for (let k in this.sectionsCount) {
            this.removeFileFromSummary(identifier, this.sectionsCount[k], () => this.updateSidebarSection(k));
        }
    }
    
    getFilesSummary(id: string): TasksSummary {
        if (id == this.calendarPlugin.getPrivateSectionId()) {
            return this.customsCount[id];
        }
        return this.sectionsCount[id];
    }
    
    protected addFileToSummary(model: FileModel, summary: TasksSummary, updateSidebar: () => void = () => {}): void {
        if (!this.countFiles || !summary || model.identifier in summary.files) {
            return;
        }
        summary.files[model.identifier] = model;
        summary.count++;
        updateSidebar();
    }
    
    protected removeFileFromSummary(identifier: string, summary: TasksSummary, updateSidebar: () => void = () => {}): void {
        if (!this.countFiles || !summary || !(identifier in summary.files)) {
            return;
        }
        delete summary.files[identifier];
        summary.count--;
        updateSidebar();
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
