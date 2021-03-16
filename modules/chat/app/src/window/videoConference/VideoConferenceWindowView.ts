import { component, window as wnd, Q, JQuery as $, Types, Logger as RootLogger } from "pmc-web";
import { func as mainTemplate } from "./template/main.html";
import { Model } from "./VideoConferenceWindowController";
import { VideoConferenceView } from "../../component/videoconference/VideoConferenceView";
let Logger = RootLogger.get("chat-plugin.window.chat.VideoConferenceWindowView");

export enum FocusedElement {
    SIDEBAR,
    MESSAGES
}

export interface HostEntryModel {
    host: string;
    sectionsList: component.remotesectionlist.RemoteSectionListView;
    conv2List: component.remoteconv2list.RemoteConv2ListView;
}

export class VideoConferenceWindowView extends wnd.base.BaseWindowView<Model> {
    
    personsComponent: component.persons.PersonsView;
    personTooltip: component.persontooltip.PersonTooltipView;
    videoConference: VideoConferenceView;
    $videoConferenceComponentContainer: JQuery;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        this.videoConference = this.addComponent("videoConference", new VideoConferenceView(this, this.personsComponent));
        this.personTooltip = new component.persontooltip.PersonTooltipView(this.templateManager, this.personsComponent);
        $(window).on("resize", () => {
            this.updateControlsContainerMiniState();
        });
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.turnTimeAgoRefresher();
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.$videoConferenceComponentContainer = this.$main.find(".videoconference-component-container");
            this.videoConference.$container = this.$videoConferenceComponentContainer;
            return this.videoConference.triggerInit();
        })
        .then(() => {
            this.updateControlsContainerMiniState();
            this.personTooltip.init(this.$main);
            this.personsComponent.refreshAvatars();
        });
    }
    
    refreshAvatars(): void {
        this.personsComponent.refreshAvatars();
    }
    
    updateControlsContainerMiniState(): void {
        if (this.videoConference) {
            this.videoConference.updateControlsContainerMiniState();
        }
    }
    
}
