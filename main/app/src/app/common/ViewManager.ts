import {Container} from "../../utils/Container";
import {TemplateManager} from "../../web-utils/template/Manager";
import {func as resetSummaryTemplate} from "../../window/adminedituser/template/resetSummary.html"
import {app, ipc} from "../../Types";
import {Starter} from "../../window/base/Starter";
import {IpcService} from "../../ipc/IpcService";
import * as RootLogger from "simplito-logger";
import { AvatarService, AssetsProvider } from "../../web-utils/AvatarService";
import { PersonProvider } from "../../web-utils/PersonProvider";
import { MailClientViewHelper } from "../../web-utils/MailClientViewHelper";
let Logger = RootLogger.get("privfs-mail-client.app.common.ViewManager");

export class ViewManager extends Container implements app.ViewParent {
    
    parent: Starter;
    viewManager: ViewManager;
    templateManager: TemplateManager;
    ipc: ipc.IpcRenderer;
    preventLinkOpenage: boolean;
    servicesDefinitions: ipc.IpcServicesDefinitions;
    services: {[name: string]: any};
    controllerId: number;
    private personProvider: PersonProvider;
    private avatarService: AvatarService;
    
    constructor(parent: Starter) {
        super(parent);
        this.viewManager = this;
        this.preventLinkOpenage = false;
        this.services = {};
    }
    
    getTemplateManager(): TemplateManager {
        if (this.templateManager == null) {
            this.templateManager = new TemplateManager();
            this.templateManager.registeredTemplates["adminEditUserResetSummaryTemplate"] = resetSummaryTemplate;
        }
        return this.templateManager;
    }
    
    getService<T = any>(serviceName: string): T {
        if (!(serviceName in this.services)) {
            let definition = this.servicesDefinitions[serviceName];
            if (definition == null) {
                throw new Error("Service with name '" + serviceName + "' does not exist");
            }
            let ipc = this.ipc || this.parent.ipc;
            if (ipc == null) {
                throw new Error("Cannot get IpcService, ipc is not present");
            }
            this.services[serviceName] = IpcService.create(ipc, definition);
        }
        return this.services[serviceName];
    }
    
    addIpcListener(channel: string, callback: ipc.IpcRendererListener): void {
        let ipc = this.ipc || this.parent.ipc;
        if (ipc == null) {
            Logger.warn("Cannot add ipc listener " + channel);
        }
        else {
            ipc.on(channel, callback);
        }
    }
    
    removeIpcListener(channel: string, callback: ipc.IpcRendererListener): void {
        let ipc = this.ipc || this.parent.ipc;
        if (ipc == null) {
            Logger.warn("Cannot remove ipc listener " + channel);
        }
        else {
            ipc.removeListener(channel, callback);
        }
    }
    
    sendIpcMessage(channel: string, message: any): void {
        let ipc = this.ipc || this.parent.ipc;
        if (ipc == null) {
            Logger.warn("Cannot send ipc message " + channel, message);
        }
        else {
            ipc.send(channel, message);
        }
    }
    
    getPersonProvider(): PersonProvider {
        if (this.personProvider == null) {
            this.personProvider = new PersonProvider();
        }
        return this.personProvider;
    }
    
    getAvatarService(): AvatarService {
        if (this.avatarService == null) {
            this.avatarService = new AvatarService(this.getPersonProvider(), this.getAssetsProvider());
        }
        return this.avatarService;
    }
    
    private getAssetsProvider(): AssetsProvider {
        return this.getMailClientViewHelper();
    }
    
    private getMailClientViewHelper() {
        return <MailClientViewHelper>this.templateManager.getHelper("com.privmx.core.web-utils.MailClientViewHelper");
    }
}
