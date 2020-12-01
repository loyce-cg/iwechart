import {mail, privfs, Types} from "pmc-mail";
import { LocalEntry } from "./LocalFS";

export interface FsFileEntry {
    section: mail.section.SectionService;
    fileSystem: privfs.fs.file.FileSystem;
    path: string;
    entry: privfs.types.descriptor.PathMapEntry;
}

export type FileEntryBase = Types.mail.AttachmentEntry|mail.filetree.nt.Entry|LocalEntry;

export interface ParentDirEntry {
    id: "parent";
}

export type FileEntryBaseEx = FileEntryBase|ParentDirEntry;

export class Notes2Utils {
    
    static isFsFileEntry(entry: FileEntryBaseEx): entry is mail.filetree.nt.Entry {
        return entry instanceof mail.filetree.nt.Entry;
    }
    
    static isAttachmentEntry(entry: FileEntryBaseEx): entry is Types.mail.AttachmentEntry {
        return (<Types.mail.AttachmentEntry>entry).attachment !== undefined;
    }
    
    static isLocalEntry(entry: FileEntryBaseEx): entry is LocalEntry {
        return entry instanceof LocalEntry;
    }
    
    static isParentEntry(entry: FileEntryBaseEx): entry is ParentDirEntry {
        return (<ParentDirEntry>entry).id == "parent";
    }
    
    static isEntryFromSession(entry: mail.filetree.nt.Entry, session: mail.session.Session): boolean {
        if (!entry || !entry.tree || !entry.tree.section) {
            return false;
        }
        let entrySection = entry.tree.section;
        let entrySectionManager = entrySection.manager;
        let sessionSectionManager = session.sectionManager;
        return entrySectionManager == sessionSectionManager;
    }
    
}
