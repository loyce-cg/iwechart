import {ComponentView} from "../base/ComponentView";
import {ExtListView, Options as ExtListOptions} from "../extlist/ExtListView";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
//import {PersonModelFull} from "../../main/ChatPlugin";
import {PersonsView} from "../persons/PersonsView";
import {func as listElementTemplate} from "../template/conversation.html";
import * as Types from "../../Types";

export class ConversationListView extends ComponentView {
    
    conversations: ExtListView<Types.webUtils.ConversationModel>;
    baseOnAfterRenderContactList: Function;
    
    constructor(parent: Types.app.ViewParent, public personsView: PersonsView, options: ExtListOptions<Types.webUtils.ConversationModel, void, MailClientViewHelper>) {
        super(parent);
        this.baseOnAfterRenderContactList = options.onAfterListRender;
        options.onAfterListRender = this.onAfterRenderContactList.bind(this);
        options.template = options.template || listElementTemplate;
        this.conversations = this.addComponent("conversations", new ExtListView(this, options));
        
        PersonsView.fixAvatarRenderInExtListUpdate(this.conversations);
    }
    
    init(): Q.Promise<void> {
        return this.conversations.triggerInit();
    }
    
    onAfterRenderContactList(): void {
        this.personsView.refreshAvatars();
        // Code which adds dividers in typeConversationSorter
        // let $container = this.$leftPanel.find("[data-container=chat-group-list]");
        // $container.children().removeClass("divider");
        // $container.find(".starred").last().next().addClass("divider");
        // $container.find(".contact").last().next().addClass("divider");
        if (this.baseOnAfterRenderContactList) {
            this.baseOnAfterRenderContactList();
        }
    }
}