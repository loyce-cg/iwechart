"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pmc_mail_1 = require("pmc-mail");
var LocalFS_1 = require("./LocalFS");
var Notes2Utils = (function () {
    function Notes2Utils() {
    }
    Notes2Utils.isFsFileEntry = function (entry) {
        return entry instanceof pmc_mail_1.mail.filetree.nt.Entry;
    };
    Notes2Utils.isAttachmentEntry = function (entry) {
        return entry.attachment !== undefined;
    };
    Notes2Utils.isLocalEntry = function (entry) {
        return entry instanceof LocalFS_1.LocalEntry;
    };
    Notes2Utils.isParentEntry = function (entry) {
        return entry.id == "parent";
    };
    Notes2Utils.isEntryFromSession = function (entry, session) {
        if (!entry || !entry.tree || !entry.tree.section) {
            return false;
        }
        var entrySection = entry.tree.section;
        var entrySectionManager = entrySection.manager;
        var sessionSectionManager = session.sectionManager;
        return entrySectionManager == sessionSectionManager;
    };
    return Notes2Utils;
}());
exports.Notes2Utils = Notes2Utils;
Notes2Utils.prototype.className = "com.privmx.plugin.notes2.main.Notes2Utils";

//# sourceMappingURL=Notes2Utils.js.map
