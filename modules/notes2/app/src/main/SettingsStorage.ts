import * as Mail from "pmc-mail";
import { WatchedFileItem } from "./Common";


export class SettingsStorage extends Mail.mail.KvdbListSettingsStorage<WatchedFileItem> {
    mergeValues(a: WatchedFileItem[], b: WatchedFileItem[]): WatchedFileItem[] {
        let map: {[id: string]: WatchedFileItem} = {};
        a.forEach(x => map[x.id] = x);
        b.forEach(x => {
            let found = map[x.id];
            if ((found && x.lastWatched > found.lastWatched) || !found) {
                map[x.id] = x;
            }
        });
        let list: WatchedFileItem[] = [];
        for (let tId in map) {
            list.push(map[tId]);
        }
        return list;
    }
    
    constructor(sectionPrefix: string, kvdb: Mail.mail.kvdb.KvdbCollection<Mail.mail.kvdb.KvdbSettingEntry>) {
        super(kvdb, sectionPrefix);
    }
}