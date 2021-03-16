import { component, window as wnd, Q, Types, webUtils, JQuery as $ } from "pmc-web";
import { func as mainTemplate } from "./template/main.html";
import { func as tabTemplate } from "./template/tab.html";
import { func as itemTemplate } from "./template/item.html";
import { ItemModel, Model, TabModel } from "./DesktopPickerController";
import { DesktopSharingSource, JitsiMeetScreenObtainerOptions } from "../../main/videoConference/jitsi/JitsiMeetScreenObtainer";

declare function electronRequire(name: string): any;

interface ElectronNativeImage {
    toDataURL(options?: { scaleFactor?: number }): string;
}

interface ElectronDesktopCapturerSource {
    id: string;
    name: string;
    thumbnail: ElectronNativeImage;
    appIcon?: ElectronNativeImage;
}

export interface DesktopPickerResult {
    sourceId: string;
    sourceType: DesktopSharingSource;
    screenShareAudio: boolean;
}

export type DesktopPickerState = "hidden"|"loading"|"loaded";

export class DesktopPickerView extends component.base.ComponentView {
    
    $container: JQuery;
    $main: JQuery;
    $scrollableContent: JQuery;
    $tabsContainers: JQuery;
    _model: Model;
    private userChoiceDeferred: Q.Deferred<DesktopPickerResult|null> = null;
    
    protected mainTemplate: webUtils.template.Template<Model, void, webUtils.MailClientViewHelper>;
    protected tabTemplate: webUtils.template.Template<TabModel, void, webUtils.MailClientViewHelper>;
    protected itemTemplate: webUtils.template.Template<ItemModel, void, webUtils.MailClientViewHelper>;
    private state: DesktopPickerState = "hidden";
    
    constructor(public parent: Types.app.ViewParent) {
        super(parent);
        this.mainTemplate = this.templateManager.createTemplate(mainTemplate);
        this.tabTemplate = this.templateManager.createTemplate(tabTemplate);
        this.itemTemplate = this.templateManager.createTemplate(itemTemplate);
    }
    
    init(model: Model): Q.Promise<void> {
        return Q()
        .then(() => {
            this.$main = this.mainTemplate.renderToJQ(model);
            this.$container.empty();
            this.$container.append(this.$main);
            this.$scrollableContent = this.$main.find(".scrollable-content");
            this.$tabsContainers = this.$main.find(".tabs--containers");
            (<any>this.$scrollableContent).pfScroll();
            
            this.$container.on("click", ".desktop-picker-item", this.onItemClick.bind(this));
            this.$container.on("click", "[data-action='cancel']", this.onCancelClick.bind(this));
            $(document).on("keydown", this.onKeyDown.bind(this));
        });
    }
    
    onItemClick(e: MouseEvent): void {
        let sourceId = $(e.currentTarget).data("sourceId");
        let sourceType = $(e.currentTarget).data("sourceType");
        let isScreenShareAudioChecked = this.$main.find("[data-option='share-desktop-audio']").prop("checked");
        let tab = this._model.tabs.find(x => x.id == sourceType);
        this.userChoiceDeferred.resolve({
            sourceId: sourceId,
            sourceType: sourceType,
            screenShareAudio: tab.canShareDesktopAudio ? isScreenShareAudioChecked : false,
        });
    }
    
    onCancelClick(): void {
        this.userChoiceDeferred.resolve(null);
    }
    
    onKeyDown(e: KeyboardEvent): void {
        if (this.state == "hidden") {
            return;
        }
        if (e.key == "Escape") {
            this.userChoiceDeferred.resolve(null);
        }
    }
    
    async showPickerAndGetUserChoice(): Promise<DesktopPickerResult|null> {
        if (this.state != "hidden") {
            return null;
        }
        this.userChoiceDeferred = Q.defer<DesktopPickerResult|null>();
        await this.load();
        const result = await this.userChoiceDeferred.promise;
        this.userChoiceDeferred = null;
        this.setState("hidden");
        return result;
    }
    
    private async load(): Promise<void> {
        this.setState("loading");
        for (let tab of this._model.tabs) {
            let tabSources = await this.listSources(tab.id);
            let $tab = this.$tabsContainers.children(`[data-tab-id="${tab.id}"]`);
            let $itemsContainer = $tab.find(".items");
            $itemsContainer.empty();
            for (let item of tabSources) {
                let $item = this.itemTemplate.renderToJQ({
                    label: item.name,
                    icon: item.appIcon ? item.appIcon.toDataURL() : null,
                    thumbnail: item.thumbnail ? item.thumbnail.toDataURL() : null,
                    sourceId: item.id,
                    sourceType: tab.id,
                });
                $itemsContainer.append($item);
            }
        }
        this.setState("loaded");
    }
    
    private setState(state: DesktopPickerState): void {
        this.state = state;
        this.setHtmlElementData(this.$main, "state", this.state);
    }
    
    protected setHtmlElementData($element: JQuery, dataKey: string, dataValue: string): void {
        $element.data(dataKey, dataValue);
        $element.attr(`data-${dataKey}`, dataValue);
    }
    
    private async listSources(sourceType: DesktopSharingSource): Promise<ElectronDesktopCapturerSource[]> {
        const electron = electronRequire("electron");
        let options: JitsiMeetScreenObtainerOptions = {
            desktopSharingSources: [sourceType],
            
        };
        return await electron.desktopCapturer.getSources({
            types: options.desktopSharingSources,
            thumbnailSize: { width: 300, height: 300 },
            fetchWindowIcons: true,
        });
    }
    
}