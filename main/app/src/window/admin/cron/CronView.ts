import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {AdminWindowView} from "../AdminWindowView";
import * as privfs from "privfs-client"

export class CronView extends BaseView<privfs.types.core.ConfigEx> {
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "cron",
            priority: 400,
            groupId: "misc",
            icon: "cog",
            labelKey: "window.admin.menu.cron"
        };
    }
}
