import * as Mail from "pmc-mail";
import { WatchedTaskItem } from "./Types";
import { TasksPlugin } from "./TasksPlugin";


export class SettingsStorage extends Mail.mail.KvdbListSettingsStorage<WatchedTaskItem> {
    mergeValues(a: WatchedTaskItem[], b: WatchedTaskItem[]): WatchedTaskItem[] {
        let map: {[id: string]: WatchedTaskItem} = {};
        a.forEach(x => map[x.id] = x);
        b.forEach(x => {
            let found = map[x.id];
            if ((found && x.lastWatched > found.lastWatched) || !found) {
                map[x.id] = x;
            }
        });
        let list: WatchedTaskItem[] = [];
        for (let tId in map) {
            list.push(map[tId]);
        }
        return list;
    }
    
    constructor(session: Mail.mail.session.Session, sectionPrefix: string, kvdb: Mail.mail.kvdb.KvdbCollection<Mail.mail.kvdb.KvdbSettingEntry>, tasksPlugin: TasksPlugin) {
        super(kvdb, sectionPrefix);
        kvdb.collection.changeEvent.add(event => {
            if (!event || !event.element || !event.element.secured) {
                return;
            }
            if (event.element.secured.key.indexOf("plugin.tasks.watchedTasksHistory-") != 0) {
                return;
            }
            let data = JSON.parse(event.element.secured.value);
            if (!data) {
                return;
            }
            for (let entry of data) {
                if (entry) {
                    tasksPlugin.updateWatchedStatus(session, entry);
                }
            }
        });
    }
}