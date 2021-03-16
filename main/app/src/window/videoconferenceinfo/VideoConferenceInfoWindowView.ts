import { BaseWindowView, WindowView } from "../base/BaseWindowView";
import { func as mainTemplate } from "./template/main.html";
import { Model } from "./VideoConferenceInfoWindowController";
import { app } from "../../Types";
import { PersonsView } from "../../component/persons/web";

@WindowView
export class VideoConferenceInfoWindowView extends BaseWindowView<Model> {
    
    private model: Model;
    personsComponent: PersonsView;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.mainTemplate.helper));
    }
    
    async initWindow(model: Model): Promise<void> {
        this.model = model;
        
        this.$main.on("click", `[data-action="join"]`, this.onJoinClick.bind(this));
        this.$main.on("click", `[data-action="close"]`, this.onCloseClick.bind(this));
        this.$main.on("click", `[data-action="show-chat"]`, this.onShowChatClick.bind(this));
        
        this.personsComponent.$main = this.$main;
        await this.personsComponent.triggerInit();
        this.personsComponent.refreshAvatars();
    }
    
    onJoinClick(): void {
        this.triggerEvent("join");
    }
    
    onCloseClick(): void {
        this.triggerEvent("close");
    }
    
    onShowChatClick(): void {
        this.triggerEvent("showChat");
    }
    
}
