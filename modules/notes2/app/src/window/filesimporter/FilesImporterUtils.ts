import { app } from "pmc-mail";
import { LocalFS, LocalEntry } from "../../main/LocalFS";
// import { FileEntry } from "./FilesImporterWindowController";
import { Notes2Utils } from "../../main/Notes2Utils";

export class FilesImporterUtils {
    constructor(public app: app.common.CommonApplication) {}
    
//     convertEntry(x: LocalEntry): FileEntry {
//         if (x.id == "/") {
//             return {
//                 parentId: "root",
//                 id: x.id,
//                 type: x.type,
//                 name: x.name,
//                 mimeType: "",
//                 size: x.size,
//                 icon: "fa-folder",
//                 modificationDate: x.mtime.getTime(),
//                 renamable: LocalFS.isRenamable(x.id),
//                 deletable: LocalFS.isDeletable(x.id),
//                 hasHistory: false,
//                 printable: false,
//                 canSaveAsPdf: false,
//                 modifier: null,
//                 unread: false,
//                 selected: false,
//                 opened: true
//             };

//         }
//         if (Notes2Utils.isLocalEntry(x)) {
//             let parent = (<LocalEntry>x).parent;
//             if (x.type == "directory") {
//                 return {
//                     parentId: parent ? parent.id : null,
//                     id: x.id,
//                     type: x.type,
//                     name: x.name,
//                     mimeType: "",
//                     size: x.size,
//                     icon: "fa-folder",
//                     modificationDate: x.mtime.getTime(),
//                     renamable: LocalFS.isRenamable(x.id),
//                     deletable: LocalFS.isDeletable(x.id),
//                     hasHistory: false,
//                     printable: false,
//                     canSaveAsPdf: false,
//                     modifier: null,
//                     unread: false,
//                     selected: false,
//                     opened: false
//                 };
//             }
            
//             return {
//                 parentId: parent ? parent.id : null,
//                 id: x.id,
//                 type: x.type,
//                 name: x.name,
//                 mimeType: x.mime,
//                 size: x.size,
//                 icon: this.app.shellRegistry.resolveIcon(x.mime),
//                 modificationDate: x.mtime.getTime(),
//                 renamable: LocalFS.isRenamable(x.id),
//                 deletable: LocalFS.isDeletable(x.id),
//                 hasHistory: false,
//                 printable: false,
//                 canSaveAsPdf: false,
//                 modifier: null,
//                 unread: false,
//                 selected: false
//             };
//         }
//     }
}