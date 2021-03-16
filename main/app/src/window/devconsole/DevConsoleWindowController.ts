import {BaseWindowController} from "../base/BaseWindowController";
import * as Utils from "simplito-utils";
import * as Q from "q";
import {app, webUtils} from "../../Types";
import { LocaleService, MailConst } from "../../mail";
import { i18n } from "./i18n";
import { Users } from "../../app/common/mixins/Users";

export interface MsgBoxActionOptions {
    type?: string;
    result?: string;
    timeout?: number;
}


export interface DevConsoleOptions {
    alwaysOnTop?: boolean;
}


export class DevConsoleWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.devconsole.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    

    options: DevConsoleOptions;
    result: string;
    preventClose: boolean;

    constructor(parent: app.WindowParent, options: DevConsoleOptions) {
        super(parent, __filename, __dirname);
        this.setViewBasicFonts();
        let openOptions = Utils.fillByDefaults(this.options, {
            width: 800,
            height: 305,
            title: "DevConsole",
            focusOn: "",
        });
        this.ipcMode = true;

        this.openWindowOptions.position = "center-always";
        this.openWindowOptions.width = openOptions.width;
        this.openWindowOptions.height = openOptions.height;
        this.openWindowOptions.widget = false;
        this.openWindowOptions.draggable = true;
        this.openWindowOptions.resizable = true;
    }
    
    bindToEvents(): void {
    }


    onViewLoad(): void {
        this.bindToEvents();
    }


    getModel(): DevConsoleOptions {
        let options: any = {};
        for (let key in options) {
            let value = (<any>options)[key];
            if (typeof(value) != "function") {
                options[key] = value;
            }
        }
        return this.options;
    }
    
    onViewExecCmd(cmd: string, param?: any): void {
        if (cmd == "sendLogs") {
            this.sendLogs();
        }
        if (cmd == "gpuInfo") {
            this.getGpuInfo();
        }
        if (cmd == "mediaAccess") {
            this.checkMediaAccess();
        }
        if (cmd == "getInMemoryCacheSize") {
            const size = this.app.getInMemoryCacheSize();
            this.addLineInView("Size: " + size + " bytes");
        }
        if (cmd == "createUsersBatch") {
            const users = new Users(this.app);
            let session = this.app.sessionManager.getLocalSession();
            users.createUser(1, 20, false)
            .then(() => {
                this.addLineInView("done");
            })
        }
        if (cmd == "videoFrameSignatureVerificationRatio") {
            new Promise<void>(async () => {
                try {
                    await this.setVideoFrameRatio(Number(param));
                    this.addLineInView("Ratio set to: " + param);
                }
                catch (e) {
                    this.addLineInView("Error whilst processing request.");
                }
            })
        }
        if (cmd == "getvideoFrameSignatureVerificationRatio") {
            new Promise<void>(async () => {
                try {
                    let ratio = await this.getVideoFrameRatio();
                    this.addLineInView("Current ratio is: " + ratio);
                }
                catch (e) {
                    this.addLineInView("Error whilst processing request.");
                }
            })

        }
    }

    addLineInView(line: string): void {
        this.callViewMethod("addLine", line);
    }

    getGpuInfo(): void {
        const info = this.app.getGPUInfo();
        this.renderJSONInView(info);
    }

    async getVideoFrameRatio(): Promise<number> {
        if (this.app.isLogged()) {
            let preferences = await this.app.sessionManager.getLocalSession().mailClientApi.privmxRegistry.getUserPreferences();
            return preferences.getValue<number>(MailConst.UI_VIDEO_FRAME_SIGNATURE_VERIFICATION_RATIO_INVERSE, 1000);    
        }
        else {
            throw new Error("Not logged in");
        }    
    }

    async setVideoFrameRatio(ratio: number): Promise<void> {
        if (this.app.isLogged()) {
            let preferences = await this.app.sessionManager.getLocalSession().mailClientApi.privmxRegistry.getUserPreferences();
            await preferences.set(MailConst.UI_VIDEO_FRAME_SIGNATURE_VERIFICATION_RATIO_INVERSE, ratio, true);
        }
        else {
            throw new Error("Not logged in");
        }    
    }

    renderJSONInView(obj: any): void {
        this.callViewMethod("renderJSON", JSON.stringify(obj, null, 2));
    }

    sendLogs(): void {
        <Promise<void>>((<any>this.app).errorReporter.sendZippedErrorLog(this.onSendLogsProgress.bind(this))).then(() => {
            this.addLineInView("Done.");
        })
    }

    

    async checkMediaAccess(): Promise<void> {
        const mic = await this.app.askForMicrophoneAccess();
        const camera = await this.app.askForCameraAccess();
        this.addLineInView("Media access - camera: " + camera + " / microphone: " + mic);
    }

    onSendLogsProgress(data: {msg: string, args?: any[]}): void {
        if (data.msg == "compressed") {
            this.addLineInView("Uploading file...");
        }
        if (data.msg == "no-files") {
            this.addLineInView("There is no log files to upload. Exiting.");
        }
        if (data.msg == "logFile") {
            this.addLineInView("Found: " + data.args[0]);
            this.addLineInView("Compressing file...");
        }
    }
}
