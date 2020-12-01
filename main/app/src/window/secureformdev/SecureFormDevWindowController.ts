import {BaseWindowController} from "../base/BaseWindowController";
import {SettingsWindowController} from "../settings/SettingsWindowController";
import * as Q from "q";
import * as privfs from "privfs-client";
import {Inject} from "../../utils/Decorators"
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

export interface Options {
    sid: string;
    testOpener: {
        openFormTest(sinkID: string): void;
    };
}

export interface Model {
    sinkID: string;
    clientUrl: string;
    host: string;
}

export class SecureFormDevWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.secureFormDev.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identity: privfs.identity.Identity;
    
    parentWindow: SettingsWindowController;
    options: Options;
    clientUrl: string;
    host: string;
    
    constructor(parent: SettingsWindowController, options: Options) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.addViewScript({path: "build/highlight.js"});
        this.openWindowOptions.position = "center";
        this.openWindowOptions.width = 800;
        this.openWindowOptions.height = 600;
        this.openWindowOptions.title = this.i18n("window.secureFormDev.title");
        this.options = options;
        this.host = this.identity.host;
    }
    
    init(): Q.IWhenable<void> {
        return privfs.core.PrivFsRpcManager.discoverHostConfiguration(this.host)
        .then(config => {
            this.clientUrl = config.defaultEndpoint + "/secure-form/assets.php?f=privmx-client";
        });
    }
    
    getModel(): Model {
        return {
            sinkID: this.options.sid,
            clientUrl: this.clientUrl,
            host: this.host
        };
    }
    
    onViewOpenFormTest(): void {
        this.options.testOpener.openFormTest(this.options.sid);
    }
}
