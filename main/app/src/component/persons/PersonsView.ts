import {ComponentView} from "../base/ComponentView";
import {AvatarService, Options as AvatarOptions} from "../../web-utils/AvatarService";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import * as Types from "../../Types";
import {Model} from "./PersonsController";
import * as $ from "jquery";
import { ExtListView } from "../extlist/ExtListView";
import { PersonProvider } from "../../web-utils/PersonProvider";

export class PersonsView extends ComponentView {
    
    avatarService: AvatarService;
    avatarOptions: AvatarOptions;
    $main: JQuery;
    personProvider: PersonProvider;
    
    constructor(parent: Types.app.ViewParent,
        public helper: MailClientViewHelper
    ) {
        super(parent);
        this.avatarOptions = {
            width: 30,
            height: 30,
            autoSize: true
        };
        this.personProvider = this.parent.viewManager.getPersonProvider();
        this.avatarService = this.parent.viewManager.getAvatarService();
    }
    
    init(model: Model) {
        for (let hashmail in model.persons) {
            this.setPerson(model.persons[hashmail]);
        }
    }
    
    setPerson(modelPerson: Types.webUtils.PersonModelFullOptymized): void {
        this.personProvider.setPerson(modelPerson);
    }
    
    getAvatarOptions($e: JQuery): AvatarOptions {
        let autoSize = $e.data("auto-size");
        return {
            width: $e.data("width") || this.avatarOptions.width,
            height: $e.data("height") || this.avatarOptions.height,
            autoSize: autoSize != null ? autoSize : this.avatarOptions.autoSize
        }
    }
    
    getPersonName(hashmail: string, defaultName?: string): string {
        return this.personProvider.getPersonName(hashmail, defaultName);
    }
    
    refreshPerson(person: Types.webUtils.PersonModelFullOptymized): void {
        this.setPerson(person);
        this.refreshPersonByHashmail(person.hashmail);
    }
    
    refreshPersonByHashmail(hashmail: string): void {
        let avatarService = this.avatarService;
        let person = this.getPerson(hashmail);
        this.$main.find('[data-hashmail-name="' + hashmail + '"][data-auto-refresh="true"]').each((i, e) => {
            let $e = $(e);
            let defaultName = $e.data("hashmail-default-name");
            $e.text(person.name || defaultName || person.hashmail);
        });
        this.$main.find('[data-hashmail-short-description="' + hashmail + '"][data-auto-refresh="true"]').each((i, e) => {
            let $e = $(e);
            let $parent = $e.closest("[data-description-indicator='true']");
            let maxLength = $e.data("max-length") || -1;
            let short = this.helper.shortDescription(person.description) || "";
            let hasDescription = !!short;
            $parent.toggleClass("with-description", hasDescription);
            $e.text(hasDescription && maxLength > 0 ? this.helper.truncate(short, maxLength) : short);
        });
        this.$main.find('canvas[data-hashmail-image="' + hashmail + '"][data-auto-refresh="true"]').each((i, e) => {
            avatarService.draw(<HTMLCanvasElement>e, hashmail, this.getAvatarOptions($(e)), false);
        });
    }
    
    refreshAvatars(): void {
        this.$main.find("canvas.not-rendered").each((i, e) => {
            let $e = $(e);
            $e.removeClass("not-rendered");
            $e.toggleClass("external", this.getPerson($e.data("tooltip-trigger")).isExternal);
            this.avatarService.draw(<HTMLCanvasElement>e, $e.data("hashmail-image"), this.getAvatarOptions($e), true);
        });
    }
    
    getPersonAvatarByHashmail(hashmail: string): Types.app.PersonAvatar {
        return this.personProvider.getPersonAvatarByHashmail(hashmail);
    }
    
    getPerson(hashmail: string): Types.webUtils.PersonModelFull {
        return this.personProvider.getPerson(hashmail);
    }
    
    static fixAvatarRenderInExtListUpdate<T>(extList: ExtListView<T>): void {
        let oldUpdate = extList.update.bind(extList);
        extList.update = (index: number, isActive: boolean, element: T) => {
            PersonsView.fixAvatarRender(extList.$container.children().eq(index), () => oldUpdate(index, isActive, element));
        };
    }
    
    static fixAvatarRender($container: JQuery, render: () => any): void {
        let canvasMap: {[hashmail: string]: JQuery} = {};
        $container.find("canvas[data-hashmail-image]").each((_i, e) => {
            let $e = $(e);
            canvasMap[$e.data("hashmail-image") + "[" + $e.data("width") + "x" + $e.data("height") + "]"] = $e;
        });
        render();
        $container.find("canvas[data-hashmail-image]").each((_i, e) => {
            let $e = $(e);
            let $oldCanvas = canvasMap[$e.data("hashmail-image") + "[" + $e.data("width") + "x" + $e.data("height") + "]"];
            if ($oldCanvas) {
                $e.replaceWith($oldCanvas);
            }
        });
    }
}