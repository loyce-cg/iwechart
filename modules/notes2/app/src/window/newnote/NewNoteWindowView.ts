import {component, JQuery as $, webUtils, window, Types, Q} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";
import {func as channelTemplate} from "./template/channel.html";
import {Model} from "./NewNoteWindowController";

export class NewNoteWindowView extends window.base.BaseWindowView<Model> {
    
    conversations: component.conv2list.Conv2ListView;
    personsComponent: component.persons.PersonsView;
    currentActionId: string;
    inputModified: boolean = false;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));
        
        this.conversations = this.addComponent("conversations", new component.conv2list.Conv2ListView(this, {
            personsView: this.personsComponent,
            extList: {
                template: null
            }
        }));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        return Q().then(() => {
            this.$main.on("click", ".type", this.onTypeClick.bind(this));
            this.$main.on("click", "[data-action=create]", this.onCreateClick.bind(this));
            this.$main.on("click", "[data-action=cancel]", this.onCancelClick.bind(this));
            this.$main.on("click", "[data-conversation-id]", this.onConversationClick.bind(this));
            this.$body.on("keydown", this.onKeyDown.bind(this));
            this.$main.find(".type").first().click();
            this.$main.find(".name input").on("input", () => {
                this.inputModified = true;
            })
            this.personsComponent.$main = this.$main;
            return this.personsComponent.triggerInit();
        })
        .then(() => {
            this.conversations.conversations.$container = this.$main.find(".conversations");
            return this.conversations.triggerInit();
        })
        .then(() => {
            let $channels = this.$main.find(".channels");
            let channelTmpl = this.templateManager.createTemplate(channelTemplate);
            model.channels.forEach(c => {
                $channels.append(channelTmpl.renderToJQ(c));
            });
            this.setActive(model.defaultDestination);
            this.bindKeyPresses();
            this.focusOnInput();
        })
    }
    
    onTypeClick(event: MouseEvent): void {
        let $e = $(event.target).closest(".type");
        if ($e.hasClass("disabled")) {
            return;
        }
        this.$main.find(".types .type").removeClass("active");
        $e.addClass("active");
        this.currentActionId = $e.data("action-id");
        this.triggerEvent("chooseAction", $e.data("action-id"), undefined, true);
        this.setName($e.data("default-name"));
        this.focusOnInput();
    }

    getCurrentSelectedType() {
        return this.$main.find(".types .type.active");
    }

    onTypeSwitch(): void {
        let $current = this.getCurrentSelectedType();
        let $list = $current.parent().find(".type");
        let index = $list.index($current);
        
        index++;
        if (index >= $list.length) {
            index = 0;
        }
        let $e = $($list.get(index));
        if ($e.hasClass("disabled")) {
            return;
        }
        this.$main.find(".types .type").removeClass("active");
        $e.addClass("active");
        this.triggerEvent("chooseAction", $e.data("action-id"));
        this.currentActionId = $e.data("action-id");
        this.setName($e.data("default-name"));
        this.focusOnInput();
    }

    
    onCancelClick(): void {
        this.triggerEvent("cancel");
    }
    
    onCreateClick(): void {
        this.createFile();
    }
    
    onKeyDown(event: KeyboardEvent): void {
        if (event.keyCode == 13) {
            event.preventDefault();
            this.createFile();
        }
    }
    
    onConversationClick(event: MouseEvent) {
        let $e = $(event.target).closest("[data-conversation-id]");
        this.setActive($e.data("conversation-id"));
    }
    
    setActive(active: string) {
        this.$main.find("[data-conversation-id]").removeClass("active");
        let $e = this.$main.find("[data-conversation-id='" + active + "']");
        if ($e.length == 0) {
            $e = this.$main.find("[data-conversation-id='my']");
        }
        $e.addClass("active");
        let dests = this.$main.find(".destinations")[0];
        dests.scrollTop = $e[0].offsetTop - dests.offsetTop;
    }
    
    setName(name: string) {
        if (! this.inputModified) {
            this.$main.find(".name input").val(name);
        }
    }
    
    createFile(): void {
        let $input = this.$main.find(".name input");
        let name = <string>$input.val();
        let actionId = this.$main.find(".types .type.active").data("action-id");
        if (!name) {
            $input.focus();
            return;
        }
        let destination = this.$main.find(".active[data-conversation-id]").data("conversation-id");
        let openAfterCreate = this.$main.find("[data-action=check]").is(":checked");
        this.triggerEvent("createFile", actionId, destination, name, openAfterCreate);
    }

    focusOnInput(): void {
        let $ele = this.$main.find(".name input");
        let filename:string = (<HTMLInputElement>$ele.get(0)).value;
        if (!this.inputModified) {

            if (filename.indexOf(".") != -1) {
                $ele.focus();
                (<HTMLInputElement>$ele.get(0)).setSelectionRange(0, filename.lastIndexOf("."));
            }
            else {
                $ele.focus().select();
            }
          
        } else {
            $ele.focus();
        }
    }
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == webUtils.KEY_CODES.tab) {
                e.preventDefault();
                this.onTypeSwitch();
            } else
            if (e.keyCode == webUtils.KEY_CODES.enter && this.currentActionId.indexOf("upload") > -1) {
                e.preventDefault();
                this.triggerEvent("uploadActionConfirmed");
            } else
            if (e.keyCode == webUtils.KEY_CODES.escape) {
                e.preventDefault();
                this.triggerEvent("cancel");
            }
        });
    }
    
}
