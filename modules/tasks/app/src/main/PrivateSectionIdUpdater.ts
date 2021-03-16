import { mail } from "pmc-mail";
import { Task } from "./data/Task";
import { TaskGroup } from "./data/TaskGroup";

export class PrivateSectionIdUpdater {
    
    static readonly PRIVATE_SECTION_PREFIX: string = "private:";
    
    constructor(public privateSection: mail.section.SectionService) {
    }
    
    fixProjectId(id: string): string {
        if (this.privateSection && id.startsWith(PrivateSectionIdUpdater.PRIVATE_SECTION_PREFIX)) {
            return this.privateSection.getId();
        }
        return id;
    }
    
    fixTaskGroup(tg: { projectId: string }): void {
        tg.projectId = this.fixProjectId(tg.projectId);
    }
    
    fixTask(t: { projectId: string }): void {
        t.projectId = this.fixProjectId(t.projectId);
    }
    
}
