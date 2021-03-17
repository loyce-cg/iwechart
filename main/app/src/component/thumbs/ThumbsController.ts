import * as Types from "../../Types";
import * as Q from "q";
import * as privfs from "privfs-client";
import { ComponentController } from "../base/ComponentController";
import { CommonApplication } from "../../app/common";
import { Inject } from "../../utils/Decorators";
import { SectionManager } from "../../mail/section";
import { section } from "../../mail";
import { Session } from "../../mail/session/SessionManager";
import { ThumbGeneratedEvent } from "../../mail/thumbs/ThumbGenerator";

export enum MissingThumbAction {
    DO_NOTHING = "do-nothing",
    USE_ORIGINAL_IMAGE = "use-original-image",
}

export interface ThumbsOptions {
    missingThumbAction: MissingThumbAction;
}

export interface Model {
}

export class ThumbsController extends ComponentController {
    
    @Inject sectionManager: SectionManager;
    @Inject client: privfs.core.Client;
    options: ThumbsOptions = {
        missingThumbAction: MissingThumbAction.DO_NOTHING,
    };
    session: Session;
    protected watchedThumbDids: string[] = [];
    protected sectionIdsByDid: { [did: string]: string } = {};
    protected fileDidsByThumbDid: { [did: string]: string } = {};
    protected boundSections: { [sectionId: string]: section.SectionService } = {};
    
    constructor(parent: Types.app.IpcContainer, public app: CommonApplication, options: ThumbsOptions) {
        super(parent);
        this.bindEvent<ThumbGeneratedEvent>(this.app, "thumb-generated", event => {
            this.onViewRequestThumbImage(event.fileDid, event.sectionId);
        });
        this.ipcMode = true;
        for (let k in options) {
            (<any>this.options)[k] = (<any>options)[k];
        }
    }
    
    processThumbs(): void {
        this.callViewMethod("processThumbs");
    }
    
    setSession(session: Session): void {
        this.session = session;
        let client = this.session.sectionManager.client;
        this.registerPmxEvent(client.storageProviderManager.event, this.onStorageEvent);
    }
    
    onViewRequestThumbImage(did: string, sectionId: string, refreshing: boolean = false): void {
        this.sectionIdsByDid[did] = sectionId;
        let thumbDid: string;
        let session = this.session;
        Q().then(() => {
            let section = session.sectionManager.getSection(sectionId);
            if (!section) {
                return;
            }
            if (!(sectionId in this.boundSections)) {
                this.boundSections[sectionId] = section;
                section.getChatSinkIndex().then(si => {
                    si.sinkIndexManager.messagesCollection.changeEvent.add(e => {
                        if (e.type == "add" && e.element && e.element.source && e.element.source.data && e.element.source.data.sender
                            && e.element.source.data.sender.hashmail != this.app.identity.hashmail
                            && e.element.source.data.type == "chat-message" && e.element.source.data.contentType == "application/json"
                        ) {
                            let obj = JSON.parse(e.element.source.data.text);
                            if (obj.type == "save-file" && obj.path.startsWith("/.thumbs/")) {
                                let thumbFileName = obj.path.substr("/.thumbs/".length);
                                let fileDid = thumbFileName.split(".")[0];
                                this.onViewRequestThumbImage(fileDid, obj.sectionId, true);
                            }
                        }
                    });
                });
            }
            return this.app.thumbsManager.getThumbDid(section, did)
            .then(_thumbDid => {
                thumbDid = _thumbDid;
                this.sectionIdsByDid[thumbDid] = sectionId;
                if (this.watchedThumbDids.indexOf(thumbDid) < 0) {
                    this.watchedThumbDids.push(thumbDid);
                    this.fileDidsByThumbDid[thumbDid] = did;
                }
                return this.app.thumbsManager.getThumbContent(section, did);
            });
        })
        .then(content => {
            if (!content) {
                let section = session.sectionManager.getSection(sectionId);
                return section.getFileTree().then(tree => {
                    return tree.refreshDeep(true);
                })
                .then(() => {
                    return this.app.thumbsManager.getThumbContent(section, did);
                });
            }
            return content;
        })
        .then(content => {
            if (!content && this.options.missingThumbAction == MissingThumbAction.USE_ORIGINAL_IMAGE) {
                let section = session.sectionManager.getSection(sectionId);
                return this.app.thumbsManager.getOrigImageContent(section, did);
            }
            return content;
        })
        .then(content => {
            if (content) {
                let data: Types.app.BlobData = {
                    buffer: content.getBuffer(),
                    mimetype: content.getMimeType(),
                };
                this.callViewMethod("setThumbImage", did, data, !!refreshing);
            }
        });
    }
    
    onStorageEvent(event: privfs.types.descriptor.DescriptorNewVersionEvent): void {
        if (event.type == "descriptor-new-version" && this.watchedThumbDids.indexOf(event.descriptor.ref.did) >= 0 && this.sectionIdsByDid[event.descriptor.ref.did]) {
            this.onViewRequestThumbImage(this.fileDidsByThumbDid[event.descriptor.ref.did], this.sectionIdsByDid[event.descriptor.ref.did], true);
        }
    }
    
}
