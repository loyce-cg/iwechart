export class DataMigration {
    
    static DATA_VERSION_KEY = "__data_version__";
    static CURR_VERSION = 3;
    
    static migrateTask(task: any): void {
        let dataVersion = this.getVersion(task);
        if (dataVersion == 1) {
            task.status = task.status + 1;
            for (let entry of task.history) {
                if (entry.what == "modified" && entry.arg == "status") {
                    entry.oldVal = entry.oldVal + 1;
                    entry.newVal = entry.newVal + 1;
                }
            }
            this.setVersion(task);
        }
    }
    
    static migrateTaskGroup(taskGroup: any): void {
        let dataVersion = this.getVersion(taskGroup);
        if (dataVersion == 1) {
            this.setVersion(taskGroup);
        }
    }
    
    static migrateProject(project: any): void {
        let dataVersion = this.getVersion(project);
        if (dataVersion <= 2) {
            project.taskStatuses = ["Idea", "[Todo]", "In progress", "Done"];
            this.setVersion(project);
        }
    }
    
    static getVersion(obj: any) {
        return obj[this.DATA_VERSION_KEY] || 1;
    }
    
    static setVersion(obj: any, version: number = null) {
        obj[this.DATA_VERSION_KEY] = version ? version : this.CURR_VERSION;
    }
    
}
