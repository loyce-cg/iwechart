import {app, component, mail, utils, window, Q, Types, privfs} from "pmc-mail";
import {Notes2Plugin, ClipboardFileEntry} from "../../main/Notes2Plugin";
import { i18n } from "./i18n";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;

export interface Model {
    icon: string;
    name: string;
    path: string;
}

export interface DescriptorVersion {
    signature: string;
    modifier: string;
    serverDate: number;
    createDate: number;
    modifiedDate: number;
    path: string;
    fileName: string;
    icon: string;
    size: number;
}

@Dependencies(["persons", "notification", "extlist"])
export class HistoryWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.history.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    // @Inject identity: privfs.identity.Identity;
    identity: privfs.identity.Identity;

    personsComponent: component.persons.PersonsController;
    notes2Plugin: Notes2Plugin;
    entry: {
        name: string;
        path: string;
        mimeType: string;
        icon: string;
        fileSystem: privfs.fs.file.FileSystem,
        ref: privfs.fs.descriptor.ref.DescriptorRefRead;
    };
    versionsCollection: utils.collection.MutableCollection<DescriptorVersion>;
    activeCollection: utils.collection.WithActiveCollection<DescriptorVersion>;
    versions: component.extlist.ExtListController<DescriptorVersion>;
    notifications: component.notification.NotificationController;
    descriptor: privfs.types.descriptor.DescriptorWithVersionResult;
    
    constructor(parentWindow: Types.app.WindowParent, public session: mail.session.Session, fileSystem: privfs.fs.file.FileSystem, path: string) {
        super(parentWindow, __filename, __dirname);
        
        this.ipcMode = true;
        
        this.identity = session.sectionManager.identity;
        this.setPluginViewAssets("notes2");
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.entry = {
            name: mail.filetree.Path.parsePath(path).name.original,
            path: path,
            mimeType: "",
            icon: "",
            fileSystem: fileSystem,
            ref: null
        }
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            minWidth: 440,
            width: 440,
            height: 400,
            resizable: true,
            icon: "icon fa fa-book",
            title: this.i18n("plugin.notes2.window.history.title") + " " + this.entry.name
        };
    }
    
    init() {
        return Q().then(() => {
            return this.entry.fileSystem.openFile(this.entry.path, privfs.fs.file.Mode.READ_ONLY).then(handle => {
                this.entry.ref = <privfs.fs.descriptor.ref.DescriptorRefRead>handle.ref;
                return handle.getMeta().then(meta => {
                    this.entry.mimeType = mail.filetree.MimeType.resolve2(this.entry.name, meta.mimeType)
                    this.entry.icon = this.app.shellRegistry.resolveIcon(this.entry.mimeType);
                    return this.entry.fileSystem.fsd.manager.getDescriptorVersions(this.entry.ref);
                });
            });
        })
        .then(descriptor => {
            this.descriptor = descriptor;
            return Q.all(this.descriptor.versions.map(x => x.getExtra(this.entry.ref.readKey)));
        })
        .then(extraList => {
            let data = this.descriptor.versions.map((x, i) => {
                let res: DescriptorVersion = {
                    signature: x.raw.signature,
                    serverDate: x.raw.serverDate.getTime(),
                    createDate: extraList[i].meta.createDate,
                    modifiedDate: extraList[i].meta.modifiedDate,
                    modifier: x.raw.modifier && x.raw.modifier != "guest" ? x.raw.modifier + "#" + this.identity.host : "",
                    path: this.entry.path,
                    fileName: this.entry.name,
                    icon: this.entry.icon,
                    size: extraList[i].meta.size
                };
                return res;
            });
            if (data.length > 1 && data[0].size == 0) {
                data = data.slice(1);
            }
            data = data.reverse();
            this.versionsCollection = this.addComponent("versionsCollection", new utils.collection.MutableCollection(data));
            this.activeCollection = this.addComponent("activeCollection", new utils.collection.WithActiveCollection(this.versionsCollection));
            this.activeCollection.setActive(this.activeCollection.get(0));
            this.versions = this.addComponent("versions", this.componentFactory.createComponent("extlist", [this, this.activeCollection]));
            this.versions.ipcMode = true;
            this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
            this.notifications = this.addComponent("notifications", this.componentFactory.createComponent("notification", [this]));
        });
    }
    
    getModel(): Model {
        return {
            icon: this.entry.icon,
            name: this.entry.name,
            path: this.entry.path
        };
    }
    
    onViewSetActive(signature: string) {
        let active = this.activeCollection.find(x => x.signature == signature);
        if (active != null) {
            this.activeCollection.setActive(active);
        }
    }
    
    onViewOpenSelectedVersion() {
        let active = this.activeCollection.getActive();
        if (active == null) {
            return;
        }
        let version = utils.Lang.find(this.descriptor.versions, x => x.raw.signature == active.signature);
        if (version == null) {
            return;
        }
        app.common.shelltypes.DescriptorVersionElement.create(this.entry.name, this.entry.mimeType, this.entry.ref.readKey, version, true).then(element => {
            this.app.shellRegistry.shellOpen({
                element: element,
                action: app.common.shelltypes.ShellOpenAction.PREVIEW,
                session: this.session
            });
        });
    }
    
    onViewCopySelectedVersion() {
        let active = this.activeCollection.getActive();
        if (active == null) {
            return;
        }
        let version = utils.Lang.find(this.descriptor.versions, x => x.raw.signature == active.signature);
        if (version == null) {
            return;
        }
        app.common.shelltypes.DescriptorVersionElement.create(this.entry.name, this.entry.mimeType, this.entry.ref.readKey, version, true).then(element => {
            let clipboardEntry: ClipboardFileEntry = {
                element: element,
                cut: false,
                hostHash: this.session.hostHash,
            };
            this.app.clipboard.set({file: clipboardEntry});
            this.notifications.showNotification(this.i18n("plugin.notes2.window.history.notifier.copied-to-clipboard"));
        });
    }
    
    onViewSelectUp() {
        if (this.activeCollection.active) {
            let currentIndex = this.activeCollection.active.index;
            if (currentIndex > 0) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex - 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    }
    
    onViewSelectDown() {
        if (this.activeCollection.active) {
            let currentIndex = this.activeCollection.active.index;
            if (currentIndex < this.activeCollection.size() - 1) {
                this.activeCollection.setActive(this.activeCollection.get(currentIndex + 1));
            }
        }
        else {
            this.activeCollection.setActive(this.activeCollection.get(0));
        }
    }
    
    onViewClose() {
        this.close();
    }
}
