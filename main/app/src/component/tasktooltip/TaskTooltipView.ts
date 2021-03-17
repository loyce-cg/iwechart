import * as Types from "../../Types";
import { TooltipView } from "../tooltip/web";
import {func as sectionTemplate} from "../template/custom-element.html";
import {func as personTemplate} from "../template/conversation.html";
import {func as iconTemplate} from "../template/icon.html";
import * as $ from "jquery";

interface TaskTooltipOptions {
    showCtrlClickInfo: boolean;
}

export class TaskTooltipView extends TooltipView {
    
    refreshAvatars: () => void = () => null;
    options: TaskTooltipOptions = {
        showCtrlClickInfo: false,
    };
    
    constructor(public parent: Types.app.ViewParent, options?: Partial<TaskTooltipOptions>) {
        super(parent);
        this.tooltipName = "task";
        this.options = $.extend({}, this.options, options);
    }
    
    setContent(taskId: string, cnt: string) {
        if (this.currTargetId != taskId) {
            return;
        }
        
        let allData = JSON.parse(cnt);
        if (!allData || allData.length == 0) {
            return;
        }
        
        let iconTpl = this.helper.createTemplate(iconTemplate);
        
        let html = "";
        
        let first = true;
        for (let data of allData) {
            let sectionHtml = this.templateManager.createTemplate(sectionTemplate).render({
                id: data.projectId,
                label: data.projectName,
                icon: {
                    type: data.projectIsPrivateSection ? "hashmail" : ("section" + (data.projectPublic ? "" : "-private")),
                    value: data.projectIsPrivateSection ? data.myHashmail : "",
                },
                private: data.projectIsPrivateSection,
                withBorder: false,
                unread: 0,
                unmutedUnread: 0,
                elementsCount: 0,
                searchCount: 0,
                allSearched: true,
                withSpinner: false,
                alternative: false,
                emphasized: false,
            }, { index: 0, isActive: false, listView: null });
            let msg = this.helper.formatRichMessage(data.description, "html");
            let lines = msg.split("<br>");
            let idx = lines[0].indexOf(">") + 1;
            let htmlTag = lines[0].substr(0, idx);
            let firstLine = lines[0].substr(idx);
            lines[0] = htmlTag + "<span class=\"task-description-first-line\">" + firstLine + "</span>";
            msg = lines.join("<br>");
            
            html += "<div class='task-tooltip-task" + (first ? " first" : " not-first") + "'>";
            html += "  <div class='task-tooltip-task-header " + data.labelClass + "-color'>";
            html += "    <span class='task-label " +  data.labelClass + "'>#" + data.id + "</span>";
            html += "    <span>" + this.helper.escapeHtml(data.statusStr) + "</span>";
            html += "    <div class='task-tooltip-project'>";
            html +=        sectionHtml;
            html += "    </div>";
            html += "  </div>";
            html += "  <div class='task-tooltip-task-description'>" + msg + "</div>";
            if (data.taskGroups.length > 0 || data.assignedTo.length > 0) {
                html += "  <div class='task-tooltip-below-description'>";
                html += "    <div class='task-tooltip-taskgroups'>";
                for (let tg of data.taskGroups) {
                    let escaped = this.helper.escapeHtml(tg.name);
                    let icon = tg.icon ? iconTpl.render(<Types.webUtils.IconBadgeIcon>{
                        type: "badgeIcon",
                        modelJsonStr: tg.icon,
                    }) : "";
                    html += '<span class="taskgroup-label ' + (tg.pinned ? "pinned" : "") + '" title="' + escaped + '"><span>' + icon + '</span><span>' + escaped + '</span></span>';
                }
                html += "    </div>";
                html += "    <div class='task-tooltip-assigned-to " + (data.assignedTo.length > 1 ? "multi" : "") + "'>";
                for (let person of data.assignedTo) {
                    html += this.templateManager.createTemplate(personTemplate).render({
                        id: person.id,
                        unread: 0,
                        unmutedUnread: 0,
                        elementsCount: 0,
                        searchCount: 0,
                        allSearched: true,
                        withSpinner: false,
                        isPinned: false,
                        withPin: false,
                        isSingleContact: true,
                        person: {
                            hashmail: person.avatar,
                            name: person.name,
                            description: null,
                            present: false,
                            starred: false,
                            isBasic: person.isBasic,
                        },
                        persons: null,
                    }, { index: 0, isActive: false, listView: null });
                }
                html += "    </div>";
                html += "    <div style='clear:both;'></div>";
                html += "  </div>";
            }
            if (data.attachments.length > 0) {
                html += "  <div class='task-tooltip-attachments'>";
                html += "    <h4>" + this.helper.escapeHtml(this.helper.i18n("component.taskTooltip.attachments")) + "</h4>";
                for (let i = 0; i < data.attachments.length; ++i) {
                    let attName = data.attachments[i];
                    let isLast = i + 1 == data.attachments.length;
                    html += "<span class='attachment'>" + this.helper.escapeHtml(attName) + "</span>" + (isLast ? "" : ", ");
                }
                html += "  </div>";
            }
            if (data.startTimestamp) {
                html += "  <div class='task-tooltip-in-calendar'>";
                let wholeDays = data.wholeDays;
                let startStr = this.helper.dateWithHourLocal(data.startTimestamp, false);
                let endStr = this.helper.dateWithHourLocal(data.endTimestamp, false);
                if (wholeDays) {
                    startStr = startStr.substr(0, startStr.length - 6);
                    endStr = endStr.substr(0, endStr.length - 6);
                }
                else if (startStr.substr(0, startStr.length - 6) == endStr.substr(0, endStr.length - 6)) {
                    endStr = endStr.substr(-5);
                }
                html += "    <h4>" + this.helper.escapeHtml(this.helper.i18n("component.taskTooltip.inCalendar")) + "</h4>";
                html += "    <div class='task-tooltip-datetime'>";
                html += "      <span><i class='fa privmx-icon privmx-icon-calendar'></i>" + startStr + "</span>";
                if (startStr != endStr) {
                    html += "      <span> - </span><span>" + endStr + "</span>";
                }
                html += "    </div>";
                html += "  </div>";
            }
            if (this.options.showCtrlClickInfo) {
                html += `    <div class="task-tooltip-click-to-open">${this.helper.escapeHtml(this.helper.i18n("core.hint.ctrlClickToOpen"))}</div>`
            }
            html += "</div>";
            
            first = false;
        }
        
        this.$tooltipContent.html(html);
        this.show();
        this.refreshAvatars();
    }
    
}