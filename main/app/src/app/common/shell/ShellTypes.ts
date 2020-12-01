import * as privfs from "privfs-client";
import {app} from "../../../Types";
import * as Q from "q";
import {MimeType} from "../../../mail/filetree/MimeType";
import {BaseWindowController} from "../../../window/base/BaseWindowController";
import * as filetree from "../../../mail/filetree";
import { Window as AppWindow } from "./../window/Window";
import { Session } from "../../../mail/session/SessionManager";

export abstract class OpenableElement extends privfs.lazyBuffer.LazyContent {
    
    constructor(public content: privfs.lazyBuffer.IContent) {
        super(content.getMimeType(), content.getName(), content.getSize());
    }
    
    slice(start: number, end: number): Q.Promise<Buffer> {
        return Q().then(() => this.content.slice(start, end));
    }
    
    getBuffer(): Q.Promise<Buffer> {
        return Q().then(() => this.content.getBuffer());
    }
    
    create(_mimeType?: string, _name?: string): OpenableElement {
        throw new Error("Cannot create new OpenableElement");
    }
    
    isLocalFile(): boolean {
        let id = this.getElementId();
        return id && id.indexOf("/") == 0;
    }
    
    getBlobData(): Q.Promise<app.BlobData> {
        return this.getContent().then(content => {
            return {
                mimetype: content.getMimeType(),
                buffer: content.getBuffer()
            };
        });
    }
    
    getSliceableContent(): Q.Promise<privfs.lazyBuffer.IContent> {
        return Q(this);
    }
    
    abstract isEditable(): boolean;
    abstract save(data: privfs.lazyBuffer.IContent): Q.Promise<void>;
    abstract equals(ele: OpenableElement): boolean;
    abstract getCreateDate(): Date;
    abstract getModifiedDate(): Date;
    abstract hasElementId(): boolean;
    abstract getElementId(): string;
}

export class OpenableFile extends OpenableElement {
    
    createDate: Date;
    modifiedDate: Date;
    writable: boolean;
    handle: privfs.fs.descriptor.Handle;
        
    constructor(
        public fileSystem: privfs.fs.file.FileSystem,
        public path: string,
        public resolveMimeType: boolean,
        public cacheBlocksInfo?: boolean
    ) {
        super(privfs.lazyBuffer.Content.createEmpty());
    }
    
    static create(fileSystem: privfs.fs.file.FileSystem, path: string, resolveMimeType: boolean, cacheBlocksInfo?: boolean) {
        return Q().then(() => {
            let openable = new OpenableFile(fileSystem, path, resolveMimeType, cacheBlocksInfo);
            return openable.refresh().thenResolve(openable);
        });
    }
    
    getSliceableContent(): Q.Promise<privfs.lazyBuffer.IContent> {
        return Q().then(() => this.refresh()).then(() => this.content);
    }
    
    refresh() {
        return Q().then(() => {
            return this.fileSystem.openFile(this.path, privfs.fs.file.Mode.READ_ONLY);
        })
        .then(handle => {
            this.handle = handle;
            this.writable = this.handle.ref.hasWriteRights();
            this.createDate = this.handle.descriptor.creationDate;
            this.modifiedDate = this.handle.currentVersion.raw.serverDate;
            return this.handle.getBlocksInfo(this.cacheBlocksInfo);
        })
        .then(content => {
            content = content.create(null, filetree.Path.parsePath(this.path).name.original);
            if (this.resolveMimeType) {
                let mimeType = filetree.MimeType.resolve2(content.getName(), content.getMimeType());
                content = content.create(mimeType, null);
            }
            this.content = content;
            this.name = this.content.getName();
            this.size = this.content.getSize();
            this.mimeType = this.content.getMimeType();
        });
    }
    
    slice(start: number, end: number): Q.Promise<Buffer> {
        return Q().then(() => this.refresh()).then(() => this.content.slice(start, end));
    }
    
    getBuffer(): Q.Promise<Buffer> {
        return Q().then(() => this.refresh()).then(() => this.content.getBuffer());
    }
    
    isEditable(): boolean {
        return this.writable;
    }
    
    save(data: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q().then(() => {
            if (!this.isEditable()) {
                throw new Error("Element is not editable");
            }
            return this.fileSystem.save(this.path, data).thenResolve(null);
        });
    }
    
    equals(ele: OpenableElement): boolean {
        return this == ele || (ele instanceof OpenableFile && ele.handle.ref.id == this.handle.ref.id);
    }
    
    getCreateDate(): Date {
        return this.createDate;
    }
    
    getModifiedDate(): Date {
        return this.modifiedDate;
    }
    
    hasElementId(): boolean {
        return false;
    }
    
    getElementId(): string {
        return null;
    }
}

export class OpenableAttachment extends OpenableElement {
    
    constructor(
        content: privfs.lazyBuffer.IContent,
        public attachment: privfs.message.MessageAttachment
    ) {
        super(content);
    }
    
    static create(attachment: privfs.message.MessageAttachment, resolveMimeType: boolean, cache?: boolean) {
        let content = attachment.getBlocksInfo(cache);
        if (resolveMimeType) {
            let mimeType = MimeType.resolve2(content.getName(), content.getMimeType());
            content = content.create(mimeType, null);
        }
        return new OpenableAttachment(content, attachment);
    }
    
    getSliceableContent(): Q.Promise<privfs.lazyBuffer.IContent> {
        return Q(this.content);
    }
    
    isEditable(): boolean {
        return false;
    }
    
    save(_data: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q().then(() => {
            throw new Error("Message attachment is not editable");
        });
    }
    
    equals(ele: OpenableElement): boolean {
        return this == ele || (ele instanceof OpenableAttachment && ele.attachment == this.attachment);
    }
    
    getCreateDate(): Date {
        return this.attachment.message.createDate;
    }
    
    getModifiedDate(): Date {
        return this.getCreateDate();
    }
    
    hasElementId(): boolean {
        return true;
    }
    
    getElementId(): string {
        return OpenableAttachment.getElementIdEx(this.attachment);
    }
    
    static getElementIdEx(attachment: privfs.message.MessageAttachment): string {
        return OpenableAttachment.getElementId(attachment.message.sink.id, attachment.message.id, attachment.getAttachmentIndex());
    }
    
    static getElementId(sinkId: string, messageId: number, attachmentIndex: number): string {
        return sinkId + "/" + messageId + "/" + attachmentIndex;
    }
}

export class SimpleOpenableElement extends OpenableElement {
    
    date: Date;
    
    constructor(
        public data: privfs.lazyBuffer.IContent
    ) {
        super(data);
        this.date = new Date();
    }
    
    static create(content: privfs.lazyBuffer.IContent, resolveMimeType: boolean) {
        if (resolveMimeType) {
            let mimeType = MimeType.resolve2(content.getName(), content.getMimeType());
            content = content.create(mimeType, null);
        }
        return new SimpleOpenableElement(content);
    }
    
    getSliceableContent(): Q.Promise<privfs.lazyBuffer.IContent> {
        return Q(this.content);
    }
    
    isEditable(): boolean {
        return false;
    }
    
    save(_data: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q().then(() => {
            throw new Error("Message attachment source is not editable");
        });
    }
    
    equals(ele: OpenableElement): boolean {
        return this == ele || (ele instanceof SimpleOpenableElement && ele.data == this.data);
    }
    
    getCreateDate(): Date {
        return this.date;
    }
    
    getModifiedDate(): Date {
        return this.date;
    }
    
    hasElementId(): boolean {
        return false;
    }
    
    getElementId(): string {
        return null;
    }
}

export class DescriptorVersionElement extends OpenableElement {
    
    constructor(
        data: privfs.lazyBuffer.IContent,
        public version: privfs.fs.descriptor.Version
    ) {
        super(data);
    }
    
    static create(baseName: string, baseMimeType: string, readKey: Buffer, version: privfs.fs.descriptor.Version, resolveMimeType: boolean, cache?: boolean) {
        return Q.all([
            version.getExtra(readKey),
            version.getBlocksInfo(readKey, cache)
        ])
        .then(res => {
            let [extra, data] = res;
            let mimeType = resolveMimeType ? extra.meta.mimeType ? MimeType.resolve2(baseName, extra.meta.mimeType) : baseMimeType : data.getMimeType();
            data = data.create(mimeType, baseName);
            return new DescriptorVersionElement(data, version);
        });
    }
    
    getSliceableContent(): Q.Promise<privfs.lazyBuffer.IContent> {
        return Q(this.content);
    }
    
    isEditable(): boolean {
        return false;
    }
    
    save(_data: privfs.lazyBuffer.IContent): Q.Promise<void> {
        return Q().then(() => {
            throw new Error("Element is not editable");
        });
    }
    
    equals(ele: OpenableElement): boolean {
        return this == ele || (ele instanceof DescriptorVersionElement && ele.version.raw.signature == this.version.raw.signature);
    }
    
    getCreateDate(): Date {
        return this.version.descriptor.creationDate;
    }
    
    getModifiedDate(): Date {
        return this.version.raw.serverDate;
    }
    
    hasElementId(): boolean {
        return false;
    }
    
    getElementId(): string {
        return null;
    }
}

export interface ApplicationBinding {
    applicationId: string;
    mimeType?: string;
    action?: ShellOpenAction;
    default?: boolean;
}

export interface ShellOpenOptions {
    element?: OpenableElement,
    applicationId?: string,
    docked?: boolean,
    parent?: app.WindowParentEx,
    action?: ShellOpenAction,
    session: Session,
    editorOptions?: any,
    onClose?: (result: ShellOpenResult, data?: any) => void,
}

export interface RegisteredApplication {
    id: string;
    open(options: ShellOpenOptions): Q.Promise<BaseWindowController>;
}

export enum ShellActionType {
    CREATE = 1
}

export interface ShellAppActionOptions {
    id: string;
    type: ShellActionType;
    labelKey?: string;
    icon?: string;
    defaultName?: string;
    overwritesName?: boolean;
    onCall?: (filename?: string, parentWindow?: AppWindow) => Q.IWhenable<privfs.lazyBuffer.IContent>;
    onCallMulti?: (filenames?: string[], parentWindow?: AppWindow) => Q.IWhenable<privfs.lazyBuffer.IContent[]>;
}

export enum ShellOpenAction {
    OPEN = 1,
    PREVIEW = 2,
    DOWNLOAD = 4,
    EXTERNAL = 8,
    DIRECT_DOWNLOAD = 16,
    PRINT = 32,
    ANY = 1024
}

export enum ShellOpenResult {
    DISMISS = 1,
    SAVE = 2,
    NEW = 4
}

export class ShellUnsupportedError extends Error {
    
    __proto__: Error;
    
    constructor(message?: string) {
        const trueProto = new.target.prototype;
        super(message);
        this.__proto__ = trueProto;
    }
}

export interface ShellReusableOpener {
    
    reopen(openableElement: OpenableElement): void;
    release(): void;
}