import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import * as $ from "jquery";
import * as Q from "q";
import {DevConsoleOptions} from "./DevConsoleWindowController";
import {app} from "../../Types";
import { PfScroll } from "../../web-utils/PfScroll";

@WindowView
export class DevConsoleWindowView extends BaseWindowView<DevConsoleOptions> {
    


    options: DevConsoleOptions;
    $messages: JQuery;
    $inputBar: JQuery;
    $messagesContent: JQuery;
    $scroller: any;


    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    initWindow(model: DevConsoleOptions) {
        return Q().then(() => {
            this.options = model;
            // this.$main.on("click", "[data-action=retry]", this.onRetryFileUploadClick.bind(this));
            this.$main.find("input").on("keydown", this.onKeyDown.bind(this));
            this.$messages = this.$main.find(".messages");
            this.$scroller = this.$messages.pfScroll();
            this.$inputBar = this.$main.find("input");
            this.$messagesContent = this.$messages.find(".pf-content");
            this.welcomeMessage();
        })
    }     
    
    parseFunctionName(str: string): string {
        return str.substring(0, str.indexOf("(")).trim();
    }

    onKeyDown(e: KeyboardEvent): void {
        if (e.key == "Enter") {
            const value = this.getInput();
            this.clearInput();
            this.addLine(value);
            if (value == "sendLogs()") {
                this.triggerEvent("execCmd", "sendLogs");
            }
            else
            if (value == "gpuInfo()") {
                this.triggerEvent("execCmd", "gpuInfo");
            }
            else
            if (value == "mediaAccess()") {
                this.triggerEvent("execCmd", "mediaAccess");
            }
            else
            if (value == "createUsersBatch()") {
                this.triggerEvent("execCmd", "createUsersBatch");
            }
            else
            if (value == "getInMemoryCacheSize()") {
                this.triggerEvent("execCmd", "getInMemoryCacheSize");
            }
            else if (value == "clear") {
                this.$messagesContent.empty();
            }
            else if (value == "help") {
                this.printHelp();
            }
            else if (value == "") {
                return;
            }
            else {
                let reportError: string = "command not found";
                let funcName = this.parseFunctionName(value);
                let paramsExp = new RegExp(/\(\s*([^)]+?)\s*\)/);

                if (funcName == "videoFrameSignatureVerificationRatio") {
                    reportError = "Wrong params. Should be number in range: 1-1000";
                    let pVal = paramsExp.exec(value);
                    if (pVal && this.isNumber(pVal[1]) ) {
                        let value = Number(pVal[1]);
                        if (value >= 1 && value <= 1000) {
                            reportError = null;
                            this.triggerEvent("execCmd", funcName, value);
                        }
                    }
                    else {
                        this.triggerEvent("execCmd", "get" +funcName);
                        reportError = null;
                    }
                }
                if (reportError) {
                    this.addLine("Error: " + reportError);
                }
                
                    
            }
        }
    }


    isNumber(str: string): boolean {
        return /^\d+$/.test(str);
    }

    getInput(): string {
        return (this.$inputBar.val() as string);
    }

    clearInput(): void {
        this.$inputBar.val("");
    }

    addLine(line: string): void {
        console.log("addLine (view) called with", line);
        this.$messagesContent.append($("<div class='line'>"+line+"</div>"));
        this.$scroller.scrollToBottom();
    }

    renderJSON(json: string): void {
        this.$messagesContent.append($("<pre class='line'>"+json+"</pre>"));
        this.$scroller.scrollToBottom();
    }

    welcomeMessage(): void {
        this.addLine("PrivMX Dev Console");
    }

    printHelp(): void {
        this.addLine("Available commands:");
        this.addLine("sendLogs()\t\t - gets your error.log file, compress it and send it to us.");
        this.addLine("gpuInfo()\t\t - shows GPU information and settings.");
        this.addLine("videoFrameSignatureVerificationRatio([1..1000]) - sets or gets current video frames signatures verification ratio.");
        this.addLine("mediaAccess() - (macOS) check microphone / camera system permissions");
        this.addLine("clear\t\t - clear console");
    }
}
