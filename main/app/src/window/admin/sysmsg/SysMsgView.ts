import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as sysMsgSummaryTemplate} from "./template/sys-msg-summary.html";
import {Scope} from "../../../web-utils/Scope";
import * as $ from "jquery";
import {AdminWindowView} from "../AdminWindowView";
import {SendResult, ProgressModel} from "./SysMsgController";
import {ProgressViewContainer} from "../../../component/channel/ProgressViewContainer";

export interface ScopeData {
    title: string;
    text: string;
    send: () => void;
}

export class SysMsgView extends BaseView<void> {
    
    sysMsg: Scope<ScopeData>;
    
    constructor(parent: AdminWindowView) {
        super(parent, mainTemplate, true);
        this.menuModel = {
            id: "sysmsg",
            priority: 300,
            groupId: "misc",
            icon: "send-o",
            labelKey: "window.admin.menu.sysmsg"
        };
    }
    
    initTab(): void {
        this.sysMsg = new Scope(this.$main, {
            title: "",
            text: "",
            send: this.onSendSysMsgClick.bind(this)
        });
        this.$main.on("click", "[data-action=close-summary]", this.onCloseSummaryClick.bind(this));
    }
    
    showSendSysMsgResults(results: SendResult[]): void {
        let $html = this.templateManager.createTemplate(sysMsgSummaryTemplate).renderToJQ(results);
        this.$main.append($html);
    }
    
    removeSendSysMsgResults(): void {
        this.$main.find(".sys-msg-summary").remove();
    }
    
    onCloseSummaryClick(): void {
        this.removeSendSysMsgResults();
    }
    
    onSendSysMsgClick(event: Event): ProgressViewContainer {
        this.removeSendSysMsgResults();
        return this.triggerEventWithProgressCore("sendSysMsg", this.sysMsg.data.title, this.sysMsg.data.text).addButton($(<HTMLElement>event.target)).addNotifier(this.$main.find(".progress-info"), (progress: ProgressModel) => {
            return progress.type == "mail-info" ? this.helper.i18n("window.admin.sysmsg.info", progress.i + 1, progress.size, progress.username) : false;
        });
    }
}
