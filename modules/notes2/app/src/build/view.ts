import {Notes2WindowView} from "../window/notes2/Notes2WindowView";
import {NewNoteWindowView} from "../window/newnote/NewNoteWindowView";
import {RecentFilesWindowView} from "../window/recentfiles/RecentFilesWindowView";
import {HistoryWindowView} from "../window/history/HistoryWindowView";
import {FilesImporterWindowView} from "../window/filesimporter/FilesImporterWindowView";
import {FileConflictResolverWindowView} from "../window/fileconflictresolver/FileConflictResolverWindowView";
import {FileErrorWindowView} from "../window/fileerror/FileErrorWindowView";
import {FilesListView} from "../component/fileslist/FilesListView";
import {FileChooserWindowView} from "../window/filechooser/FileChooserWindowView";

import * as Web from "pmc-web";

Web.Starter.objectFactory.register(Notes2WindowView);
Web.Starter.objectFactory.register(NewNoteWindowView);
Web.Starter.objectFactory.register(RecentFilesWindowView);
Web.Starter.objectFactory.register(HistoryWindowView);
Web.Starter.objectFactory.register(FileConflictResolverWindowView);
Web.Starter.objectFactory.register(FileErrorWindowView);
Web.Starter.objectFactory.register(FileChooserWindowView);
Web.Starter.objectFactory.register(FilesImporterWindowView);


Web.Starter.addEventListener<Web.Types.event.InstanceRegisteredEvent<Web.window.sectionsummary.SectionSummaryWindowView>>("instanceregistered", event => {
    if (event.instance && event.instance.className == "com.privmx.core.window.sectionsummary.SectionSummaryWindowView") {
        let filesList = new FilesListView(event.instance, event.instance.personsComponent);
        filesList.$container = Web.JQuery('<div class="notes2-fileslist-component"></div>');
        event.instance.registerModule("notes2", filesList);
    }
}, "notes2", "ethernal");
