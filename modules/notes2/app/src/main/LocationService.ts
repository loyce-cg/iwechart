import * as Mail from "pmc-mail";
import Q = Mail.Q;

export interface Locations {
    [refId: string]: LocationInfo
}

export interface LocationInfo {
    type: string;
    locationName: string;
    tree?: Mail.mail.filetree.nt.Tree;
    scope?: string;
    section: Mail.mail.section.SectionService;
}

export interface FilesMeta {
    [id: string]: FileInfo;
}

export interface FileInfo {
    icon: string;
    meta: {
        size: number,
        modifiedDate: number
    };
    name?: string;
}

export class LocationService {
    
    constructor(
        public app: Mail.app.common.CommonApplication,
        public sectionManager: Mail.mail.section.SectionManager,
        public sinkIndexManager: Mail.mail.SinkIndexManager,
        public conversationService: Mail.mail.conversation.ConversationService
    ) {
    }
    
    getLocationsInfo(): Q.Promise<Locations> {
        let trees: Locations = {};
        
        return Q().then(() => {
            let privateSection = this.sectionManager.getMyPrivateSection();
            let promises = !privateSection ? [Q()] : [privateSection.getFileTree().then(myTree => {
                let locationInfo: LocationInfo = {
                    type: "my",
                    locationName: "my",
                    tree: myTree,
                    section: privateSection
                }
                trees[myTree.root.ref.id] = locationInfo;
                return myTree.refreshDeep(true);
            })];
            this.sectionManager.filteredCollection.forEach(section => {
                if (section.isFileModuleEnabled()) {
                    promises.push(section.getFileTree().then(tree => {
                        let locationInfo: LocationInfo = {
                            type: "channel",
                            scope: section.getScope(),
                            locationName: section.getName(),
                            tree: tree,
                            section: section
                        }
                        trees[tree.root.ref.id] = locationInfo;
                        return tree.refreshDeep(true);
                    }));
                }
            })
            return Q.all(promises);
        })
        .then(() => {
            return trees;
        });
    }
    
    getLocationByEntryId(id: string, locations: Locations): Q.Promise<LocationInfo> {
        return Q().then(() => {
            let parsed = Mail.mail.filetree.nt.Entry.parseId(id);
            if (parsed) {
                for (let refId in locations) {
                    let loc = locations[refId];
                    if (loc.tree && loc.tree.section.getId() == parsed.sectionId) {
                        return loc;
                    }
                }
                return;
            }
            else if (id.indexOf("ref://") == 0) {
                let index = id.indexOf("/", 6);
                let rootId = id.substring(6, index);
                return locations[rootId];
            }
            else {
                let splitted = id.split("/");
                
                let sinkIndex = this.sinkIndexManager.getSinkIndexById(splitted[0]);
                if (sinkIndex == null) {
                  return;
                }
                
                let entry = sinkIndex.getEntry(parseInt(splitted[1]));
                if (entry == null) {
                    return;
                }
                return <LocationInfo> {
                    type: "conversation",
                    locationName: this.conversationService.getConversationId(entry)
                }
            }
        });
    }
    
    getFilesMetaByIds(ids: string[], dids: string[], locations: Locations): Q.Promise<FilesMeta>  {
        return Q().then(() => {
            let meta: FilesMeta = {};
            let metaPromises: Q.Promise<any>[] = [];
            ids.forEach((id, idx) => {
                let did = dids[idx];
                let parsed = Mail.mail.filetree.nt.Entry.parseId(id);
                let isRef = id.indexOf("ref://") == 0;
                if (parsed ||isRef) {
                    let tree: Mail.mail.filetree.nt.Tree;
                    let path: string;
                    if (isRef) {
                        let index = id.indexOf("/", 6);
                        let rootId = id.substring(6, index);
                        path = id.substring(index);
                        tree = locations[rootId].tree;
                    }
                    else {
                        for (let refId in locations) {
                            let loc = locations[refId];
                            if (loc.tree && loc.tree.section.getId() == parsed.sectionId) {
                                path = parsed.path;
                                tree = loc.tree;
                                break;
                            }
                        }
                    }
                    if (tree == null) {
                        return;
                    }
                    let fileByDid = did ? tree.collection.find(x => x.ref.did == did) : null;
                    if (fileByDid) {
                        path = fileByDid.path;
                    }
                    metaPromises.push(tree.fileSystem.stat(path, true).then(m => {
                        let mimeType = Mail.mail.filetree.MimeType.resolve2(Mail.mail.filetree.Path.parsePath(path).name.original, m.meta.mimeType);
                        meta[id] = {
                            icon: this.app.shellRegistry.resolveIcon(mimeType),
                            meta: m.meta,
                            name: m.entry.name,
                        };
                    }).fail(() => {
                        return Q();
                    }));
                }
                else {
                    let splitted = id.split("/");
                    let sinkIndex = this.sinkIndexManager.getSinkIndexById(splitted[0]);
                    if (sinkIndex == null) {
                        return;
                    }
                    let entry = sinkIndex.getEntry(parseInt(splitted[1]));
                    if (entry == null) {
                        return;
                    }
                    let attachment = entry.getMessage().attachments[parseInt(splitted[2])];
                    if (attachment == null) {
                        return;
                    }
                    meta[id] = {
                        icon: this.app.shellRegistry.resolveIcon(attachment.getMimeType()),
                        meta: {
                            modifiedDate: entry.getMessage().createDate.getTime(),
                            size: attachment.getSize()
                        },
                    };
                }
            });
            return Q.all(metaPromises).thenResolve(meta);
        })
    }
}