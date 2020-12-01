import { TaskModel, TaskGroupModel, ProjectModel } from "../component/taskGroupsPanel/TaskGroupsPanelController";

interface SizeAndString {
    size: number;
    str: string;
}

interface Comparable {
    origId: string;
    id: number;
    pinned: number;
    detached: number;
    order: number;
}

export class TaskGroupsSorter {
    
    static sort(taskGroups: { tg: TaskGroupModel, tasks: TaskModel[] }[], projects: { [id: string]: ProjectModel }): { tg: TaskGroupModel, tasks: TaskModel[] }[] {
        let sortable: Comparable[] = [];
        let map: { [taskId: string]: { tg: TaskGroupModel, tasks: TaskModel[] } } = {};
        for (let tg of taskGroups) {
            let proj = projects[tg.tg.projectId];
            let id = parseInt(tg.tg.id);
            let origId = tg.tg.projectId + "/" + tg.tg.id;
            sortable.push({
                origId: origId,
                id: isNaN(id) ? 999999999 : id,
                pinned: proj ? (proj.pinnedTaskGroupIds.indexOf(tg.tg.id) >= 0 ? 1 : 0) : 0,
                detached: tg.tg.isDetached ? 1 : 0,
                order: proj ? proj.taskGroupsOrder.indexOf(tg.tg.id) : 0,
            });
            map[origId] = tg;
        }
        
        sortable.sort((a, b) => {
            if (a.detached != b.detached) {
                let ad = a.detached ? 1 : 0;
                let bd = b.detached ? 1 : 0;
                return ad - bd;
            }
            if (a.pinned != b.pinned) {
                let ap = a.pinned ? 1 : 0;
                let bp = b.pinned ? 1 : 0;
                return bp - ap;
            }
            if (a.order != b.order) {
                return a.order - b.order;
            }
            return b.id - a.id;
        });
        
        let sorted: { tg: TaskGroupModel, tasks: TaskModel[] }[] = [];
        for (let entry of sortable) {
            sorted.push(map[entry.origId]);
        }
        return sorted;
    }
    
}
