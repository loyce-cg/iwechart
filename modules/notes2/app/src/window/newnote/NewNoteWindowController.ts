import {app, component, utils, window, Q, Types, privfs, mail} from "pmc-mail";
import {Notes2Plugin} from "../../main/Notes2Plugin";
import { i18n } from "./i18n";
import Inject = utils.decorators.Inject;
import Dependencies = utils.decorators.Dependencies;

export type Result = {
    destination: string;
    content: privfs.lazyBuffer.IContent;
    openAfterCreate: boolean;
}

export interface Options {
    defaultDestination: string;
}

export interface ActionItemModel {
    id: string;
    labelKey: string;
    icon: string;
    defaultName: string;
}

export interface ChannelModel {
    id: string;
    name: string;
    scope: string;
}

export interface Model {
    defaultDestination: string;
    channels: ChannelModel[];
    hashmail: string;
    actions: ActionItemModel[];
}

export interface OrderedActions extends app.common.shelltypes.ShellAppActionOptions {
    order: number;
}

@Dependencies(["persons", "conversationlist"])
export class NewNoteWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.notes2.window.newNote.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    
    defaultDestination: string;
    defered: Q.Deferred<Result>;
    actions: OrderedActions[];
    content: privfs.lazyBuffer.IContent;
    conversations: component.conv2list.Conv2ListController;
    personsComponent: component.persons.PersonsController;
    notes2Plugin: Notes2Plugin;
    uploadAction: {actionId: string, fileName: string} = null;
    
    constructor(parentWindow: Types.app.WindowParent, options?: Options) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.defaultDestination = options ? options.defaultDestination : "";
        this.actions = <OrderedActions[]>this.app.shellRegistry.getActions(app.common.shelltypes.ShellActionType.CREATE);
        
        this.actions.forEach( action => {
            if (action.id.indexOf("text") > -1) {
                action.order = 0;
                action.labelKey = "plugin.notes2.window.newNote.fileType.text.label";
            } else
            if (action.id.indexOf("mind") > -1) {
                action.order = 1;
                action.labelKey = "plugin.notes2.window.newNote.fileType.mindmap.label";
            }
            else {
                action.order = 2;
            }
        })
        this.actions = this.actions.filter( x => { return x.id != "core.upload" && x.id != "core.upload-multi"});
        this.defered = Q.defer();
        this.setPluginViewAssets("notes2");
        this.notes2Plugin = this.app.getComponent("notes2-plugin");
        this.openWindowOptions = {
            modal: true,
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 496,
            height: 400,
            resizable: false,
            title: this.i18n("plugin.notes2.window.newNote.title")
        };
    }
    
    init() {
        this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
        this.conversations = this.addComponent("conversations", this.componentFactory.createComponent("conv2list", [this, {}]));
    }
    
    getResult(): Q.Promise<Result> {
        return this.defered.promise;
    }
    
    getModel(): Model {
        return {
            defaultDestination: this.defaultDestination,
            hashmail: this.identity.hashmail,
            channels: this.notes2Plugin.sectionManager.filteredCollection.findAll(x => x.isChatModuleEnabled() || x.isFileModuleEnabled()).map(x => {
                return {
                    id: x.getId(),
                    name: x.getName(),
                    scope: x.getScope()
                };
            }),
            actions: this.actions.sort((a, b) => a.order - b.order).map(x => {
                return {
                    id: x.id,
                    labelKey: x.labelKey,
                    icon: x.icon,
                    defaultName: x.defaultName
                };
            })
        };
    }
    
    onViewCreateFile(actionId: string, destination: string, fileName: string, openAfterCreate: boolean): void {
        if (this.content) {
            this.content = this.content.create(null, fileName);
            this.defered.resolve({destination: destination, content: this.content, openAfterCreate: openAfterCreate});
            this.close();
        }
        else {
            this.app.shellRegistry.callAppAction(actionId, fileName).then(content => {
                this.defered.resolve({destination: destination, content: content, openAfterCreate: openAfterCreate});
                this.close();
            })
            .fail(this.errorCallback);
        }
    }
    
    onViewChooseAction(actionId: string, fileName: string, fromClick?: boolean) {
        this.uploadAction = null;
        if (actionId.indexOf("upload") > -1 && !fromClick) {
            this.uploadAction = {actionId, fileName};
            return;
        }
        let appAction = this.app.shellRegistry.getAppAction(actionId);
        if (appAction.overwritesName) {
            this.app.shellRegistry.callAppAction(actionId, fileName).then(content => {
                this.content = content;
                this.callViewMethod("setName", this.content.getName())
            })
            .fail(this.errorCallback);
        }
        else {
            this.content = null;
        }
    }
    
    onViewUploadActionConfirmed() {
        if (this.uploadAction && !this.content) {
            let appAction = this.app.shellRegistry.getAppAction(this.uploadAction.actionId);
            if (appAction.overwritesName) {
                this.app.shellRegistry.callAppAction(this.uploadAction.actionId, this.uploadAction.fileName).then(content => {
                    this.content = content;
                    this.callViewMethod("setName", this.content.getName())
                })
                .fail(this.errorCallback);
            }
            else {
                this.content = null;
            }
        }
    }
    
    onViewCancel(): void {
        this.close();
    }
    
}
