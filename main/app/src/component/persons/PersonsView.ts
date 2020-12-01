import {ComponentView} from "../base/ComponentView";
import {AvatarService, Options as AvatarOptions} from "../../web-utils/AvatarService";
import {MailClientViewHelper} from "../../web-utils/MailClientViewHelper";
import * as Types from "../../Types";
import * as WebUtils from "../../web-utils";
import {Model} from "./PersonsController";
import * as $ from "jquery";
import { ExtListView } from "../extlist/ExtListView";

export class PersonsView extends ComponentView {
    
    avatarService: AvatarService;
    avatarOptions: AvatarOptions;
    persons: {[hashmail: string]: Types.webUtils.PersonModelFull};
    $main: JQuery;
    
    constructor(parent: Types.app.ViewParent,
        public helper: MailClientViewHelper
    ) {
        super(parent);
        this.persons = {};
        this.avatarOptions = {
            width: 30,
            height: 30,
            autoSize: true
        };
        this.avatarService = new AvatarService(this, this.helper);
    }
    
    init(model: Model) {
        for (let hashmail in model.persons) {
            this.persons[hashmail] = this.convertOptymizedToFull(model.persons[hashmail]);
        }
    }
    
    convertOptymizedToFull(modelPerson: Types.webUtils.PersonModelFullOptymized) : Types.webUtils.PersonModelFull {
        let person: Types.webUtils.PersonModelFull = {
            hashmail: modelPerson.hashmail,
            username: modelPerson.username,
            name: modelPerson.name,
            present: modelPerson.present,
            description: modelPerson.description,
            avatar: modelPerson.avatar ? WebUtils.WebUtils.createObjectURL(modelPerson.avatar) : null,
            lastUpdate: modelPerson.lastUpdate,
            isEmail: modelPerson.isEmail,
            isStarred: modelPerson.isStarred,
            isExternal: modelPerson.isExternal,
            deviceName: modelPerson.deviceName,
            client: modelPerson.client,
            isAdmin: modelPerson.isAdmin,
            lastSeen: modelPerson.lastSeen,
            loggedInSince: modelPerson.loggedInSince,
            ipAddress: modelPerson.ipAddress
        }
        return person;
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
        let person = this.persons[hashmail];
        return (person ? person.name : "") || defaultName || hashmail;
    }
    
    refreshPerson(person: Types.webUtils.PersonModelFullOptymized): void {
        this.persons[person.hashmail] = this.convertOptymizedToFull(person);
        let avatarService = this.avatarService;
        let avatarOptions = this.avatarOptions;
        let hashmail = person.hashmail;
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
            avatarService.draw(<HTMLCanvasElement>e, hashmail, this.getAvatarOptions($(e)));
        });
    }
    
    refreshAvatars(): void {
        this.$main.find("canvas.not-rendered").each((i, e) => {
            let $e = $(e);
            $e.removeClass("not-rendered");
            $e.toggleClass("external", this.getPerson($e.data("tooltip-trigger")).isExternal);
            this.avatarService.draw(<HTMLCanvasElement>e, $e.data("hashmail-image"), this.getAvatarOptions($e));
        });
    }
    
    getPersonAvatarByHashmail(hashmail: string): Types.app.PersonAvatar {
        let person = this.persons[hashmail];
        if (person == null) {
            return {
                hashmail: hashmail,
                avatar: null,
                lastUpdate: 0,
                isEmail: false
            };
        }
        return person;
    }
    
    getPerson(hashmail: string): Types.webUtils.PersonModelFull {
        let person = this.persons[hashmail];
        if (person == null) {
            return  {
                hashmail: hashmail,
                username: hashmail,
                name: hashmail,
                present: false,
                description: "",
                avatar: null,
                lastUpdate: 0,
                isEmail: false,
                isStarred: false,
                isExternal: false,
                deviceName: "",
                client: "",
                isAdmin: false,
                lastSeen: 0,
                loggedInSince: 0,
                ipAddress: ""
            };
        }
        return person;
    }
    
    static fixAvatarRenderInExtListUpdate<T>(extList: ExtListView<T>): void {
        let oldUpdate = extList.update.bind(extList);
        extList.update = (index: number, isActive: boolean, element: T) => {
            let canvasMap: {[hashmail: string]: JQuery} = {};
            extList.$container.children().eq(index).find("canvas[data-hashmail-image]").each((_i, e) => {
                let $e = $(e);
                canvasMap[$e.data("hashmail-image") + "[" + $e.data("width") + "x" + $e.data("height") + "]"] = $e;
            });
            oldUpdate(index, isActive, element);
            extList.$container.children().eq(index).find("canvas[data-hashmail-image]").each((_i, e) => {
                let $e = $(e);
                let $oldCanvas = canvasMap[$e.data("hashmail-image") + "[" + $e.data("width") + "x" + $e.data("height") + "]"];
                if ($oldCanvas) {
                    $e.replaceWith($oldCanvas);
                }
            });
        };
    }
}