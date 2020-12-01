import * as Mail from "pmc-mail";
import { ViewSetting } from "./ViewSettings";

export class ViewSettingsStorage extends Mail.mail.KvdbListSettingsStorage<ViewSetting> {
    
    mergeValues(a: ViewSetting[], b: ViewSetting[]): ViewSetting[] {
        let map: {[id: string]: ViewSetting} = {};
        a.forEach(x => map[x.key] = x);
        b.forEach(x => {
            let found = map[x.key];
            if ((found && x.setDT > found.setDT) || !found) {
                map[x.key] = x;
            }
        });
        let list: ViewSetting[] = [];
        for (let pId in map) {
            list.push(map[pId]);
        }
        return list;
    }
    
    constructor(sectionPrefix: string, kvdb: Mail.mail.kvdb.KvdbCollection<Mail.mail.kvdb.KvdbSettingEntry>) {
        super(kvdb, sectionPrefix);
    }
    
}
