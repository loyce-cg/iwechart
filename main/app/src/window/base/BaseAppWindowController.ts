import {BaseWindowController} from "./BaseWindowController";
import {ContainerWindowController} from "../container/ContainerWindowController";
import {NavBarController} from "../../component/navbar/NavBarController";
import {app} from "../../Types";
import {Dependencies} from "../../utils/Decorators";

@Dependencies(["navbar"])
export class BaseAppWindowController extends BaseWindowController {
    
    parent: ContainerWindowController;
    navBar: NavBarController;
    
    constructor(parent: ContainerWindowController, filename: string, dirname: string, settings?: app.Settings) {
        super(parent, filename, dirname, settings);
        this.ipcMode = true;
        this.navBar = this.addComponent("navBar", this.componentFactory.createComponent("navbar", [this]));
        this.openWindowOptions.showLoadingScreen = true;
    }
    
    setPluginViewAssets(pluginName: string) {
        super.setPluginViewAssets(pluginName);
        this.replaceViewStyle({path: "window/base/BaseWindow.css"}, {path: "window/base/BaseAppWindow.css"});
    }
    
    applyHistoryState(_processed: boolean, _state: string): void {
    }
    
    onChildTabSwitch(_child: BaseWindowController, shiftKey: boolean, ctrlKey: boolean): void {
        this.navBar.onTabSwitch(shiftKey, ctrlKey);
    }

    onActivate(): void {
        this.navBar.voiceChatControls.refreshModel();
    }
}
