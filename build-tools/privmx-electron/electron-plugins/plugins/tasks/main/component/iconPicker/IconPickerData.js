"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var IconPickerData = (function () {
    function IconPickerData() {
    }
    IconPickerData.splitIconStr = function (iconStr) {
        var icon = JSON.parse(iconStr);
        return {
            icon: icon.type == "fa" ? ('{"type":"fa","fa":"' + icon.fa + '"}') : ('{"type":"shape","shape":"' + icon.shape + '"}'),
            color: icon.color,
        };
    };
    IconPickerData.items = [
        null,
        '{"type":"fa","fa":"circle"}',
        '{"type":"fa","fa":"square"}',
        '{"type":"fa","fa":"star"}',
        '{"type":"fa","fa":"tag"}',
        '{"type":"fa","fa":"coffee"}',
        '{"type":"fa","fa":"exclamation"}',
        '{"type":"fa","fa":"flag"}',
        '{"type":"fa","fa":"globe"}',
        '{"type":"fa","fa":"wrench"}',
        '{"type":"fa","fa":"file-text"}',
        '{"type":"fa","fa":"suitcase"}',
        '{"type":"fa","fa":"home"}',
        '{"type":"fa","fa":"plane"}',
        '{"type":"fa","fa":"heart"}',
        '{"type":"fa","fa":"money"}',
        '{"type":"fa","fa":"users"}',
    ];
    IconPickerData.colors = [
        "var(--body-fg)",
        "var(--body-extra-info-fg)",
        "var(--color-warning)",
        "hsla(var(--task-status-inprogress-h), var(--task-status-inprogress-s), calc(var(--task-status-inprogress-l) - 10%), var(--task-status-inprogress-a))",
        "hsla(var(--task-status-done-h), var(--task-status-done-s), calc(var(--task-status-done-l) - 12%), var(--task-status-done-a))",
    ];
    return IconPickerData;
}());
exports.IconPickerData = IconPickerData;
IconPickerData.prototype.className = "com.privmx.plugin.tasks.component.iconPicker.IconPickerData";

//# sourceMappingURL=IconPickerData.js.map
