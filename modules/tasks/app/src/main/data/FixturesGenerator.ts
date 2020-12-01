import { TasksPlugin } from "../TasksPlugin";
import { Task } from "../data/Task";
import { Q } from "pmc-mail";

export class FixturesGenerator {
    
    
    constructor(public tasksPlugin: TasksPlugin) {
    }
    
    createPerformanceTestsTasks(sectionId: string, n: number = 1000): Q.Promise<void> {
        let session = this.tasksPlugin.app.sessionManager.getLocalSession();
        let t0 = new Date().getTime();
        console.log("Creating " + n + " tasks in section " + sectionId + "...");
        let chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890..,,            ()-_\n";
        let prom = Q();
        let myId = this.tasksPlugin.getMyId(session);
        let statuses = Task.getStatuses();
        for (let i = 0; i < n; ++i) {
            let descr = "";
            let len = Math.floor(Math.random() * 1000) + 100;
            for (let j = 0; j < len; ++j) {
                descr += chars[Math.floor(Math.random() * chars.length)];
            }
            descr = descr.replace(/\n/g, "<br>");
            prom = prom.then(() => {
                return this.tasksPlugin.createTask(session, sectionId, [], descr, statuses[Math.floor(Math.random() * 3)], t => {
                    t.addAssignedTo(myId);
                }).then(() => {
                    console.log("    " + (i + 1) + " / " + n);
                    return null;
                });
            });
        }
        prom = prom.then(() => {
            let t1 = new Date().getTime();
            console.log("    Created " + n + " tasks in section " + sectionId + " in " + ((t1 - t0) / 1000) + " seconds.");
        });
        return prom;
    }
    
}
