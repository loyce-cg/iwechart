"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PrivateSectionIdUpdater = (function () {
    function PrivateSectionIdUpdater(privateSection) {
        this.privateSection = privateSection;
    }
    PrivateSectionIdUpdater.prototype.fixProjectId = function (id) {
        if (this.privateSection && id.startsWith(PrivateSectionIdUpdater.PRIVATE_SECTION_PREFIX)) {
            return this.privateSection.getId();
        }
        return id;
    };
    PrivateSectionIdUpdater.prototype.fixTaskGroup = function (tg) {
        tg.projectId = this.fixProjectId(tg.projectId);
    };
    PrivateSectionIdUpdater.prototype.fixTask = function (t) {
        t.projectId = this.fixProjectId(t.projectId);
    };
    PrivateSectionIdUpdater.PRIVATE_SECTION_PREFIX = "private:";
    return PrivateSectionIdUpdater;
}());
exports.PrivateSectionIdUpdater = PrivateSectionIdUpdater;
PrivateSectionIdUpdater.prototype.className = "com.privmx.plugin.tasks.main.PrivateSectionIdUpdater";

//# sourceMappingURL=PrivateSectionIdUpdater.js.map
