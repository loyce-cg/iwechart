import { window, utils, Q, mail, component } from "pmc-mail";
import { Types } from "pmc-mail";
import { TasksPlugin } from "../../main/TasksPlugin";
import Dependencies = utils.decorators.Dependencies;
import { i18n } from "./i18n/index";
import { IconPickerData } from "../../component/iconPicker/IconPickerData";

export interface Result {
    cancelled: boolean;
    iconStr: string;
}

export interface Model {
}

@Dependencies(["extlist"])
export class IconPickerWindowController extends window.base.BaseWindowController {
    
    static textsPrefix: string = "plugin.tasks.window.iconPicker.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    deferred: Q.Deferred<Result> = Q.defer();
    tasksPlugin: TasksPlugin;
    mutableIconsCollection: utils.collection.MutableCollection<string>;
    transformIconsCollection: utils.collection.TransformCollection<string, string>;
    activeIconsCollection: utils.collection.WithActiveCollection<string>;
    iconsExtList: component.extlist.ExtListController<string>;
    mutableColorsCollection: utils.collection.MutableCollection<string>;
    activeColorsCollection: utils.collection.WithActiveCollection<string>;
    transformColorsCollection: utils.collection.TransformCollection<string, string>;
    colorsExtList: component.extlist.ExtListController<string>;
    
    constructor(parentWindow: Types.app.WindowParent, public iconStr: string) {
        super(parentWindow, __filename, __dirname);
        this.ipcMode = true;
        this.setPluginViewAssets("tasks");
        this.openWindowOptions.modal = true;
        this.openWindowOptions.title = this.i18n("plugin.tasks.window.iconPicker.title");
        this.openWindowOptions.icon = "icon fa fa-tasks";
        this.openWindowOptions.width = 550;
        this.openWindowOptions.height = 160;
        
        this.tasksPlugin = this.app.getComponent("tasks-plugin");
        this.mutableIconsCollection = this.addComponent("mutableIconsCollection", new utils.collection.MutableCollection());
        this.transformIconsCollection = this.addComponent("transformIconsCollection", new utils.collection.TransformCollection(this.mutableIconsCollection, this.addIconColor.bind(this)));
        this.activeIconsCollection = this.addComponent("activeIconsCollection", new utils.collection.WithActiveCollection(this.transformIconsCollection));
        this.iconsExtList = this.addComponent("iconsExtList", this.componentFactory.createComponent("extlist", [this, this.activeIconsCollection]));
        this.mutableColorsCollection = this.addComponent("mutableColorsCollection", new utils.collection.MutableCollection());
        this.transformColorsCollection = this.addComponent("transformColorsCollection", new utils.collection.TransformCollection(this.mutableColorsCollection, this.colorToIcon.bind(this)));
        this.activeColorsCollection = this.addComponent("activeColorsCollection", new utils.collection.WithActiveCollection(this.transformColorsCollection));
        this.colorsExtList = this.addComponent("colorsExtList", this.componentFactory.createComponent("extlist", [this, this.activeColorsCollection]));
        
        this.mutableColorsCollection.addAll(IconPickerData.colors);
        this.mutableIconsCollection.addAll(IconPickerData.items);
        
        this.setActiveColor(0);
        this.setActiveIcon(0);
        
        if (this.iconStr) {
            let icon = this.iconStr ? IconPickerData.splitIconStr(this.iconStr) : null;
            if (icon) {
                this.activeColorsCollection.setActive(this.colorToIcon(icon.color));
                this.transformIconsCollection.rebuild();
                this.activeIconsCollection.setActive(this.addIconColor(icon.icon));
            }
        }
    }
    
    addIconColor(iconStr: string): string {
        let icon = JSON.parse(iconStr);
        if (!icon) {
            return null;
        }
        icon.color = this.mutableColorsCollection.get(this.getActiveColorIndex());
        return JSON.stringify(icon);
    }
    
    colorToIcon(color: string): string {
        return '{"type":"fa","fa":"tint","color":"' + color + '"}';
    }
    
    getPromise(): Q.Promise<Result> {
        return this.deferred.promise;
    }
    
    resolve(cancelled: boolean) {
        let idx = this.getActiveIconIndex();
        let activeIcon = this.mutableIconsCollection.get(idx);
        this.deferred.resolve({
            cancelled: cancelled,
            iconStr: activeIcon == "none" ? null : this.addIconColor(activeIcon),
        });
    }
    
    getModel(): Model {
        return {
        };
    }
    
    onViewClose(): void {
        this.cancel();
    }
    
    onViewCancel(): void {
        this.cancel();
    }
    
    onViewSave(): void {
        this.save();
    }
    
    cancel(): void {
        this.resolve(true);
        this.close();
    }
    
    save(): void {
        this.resolve(false);
        this.close();
    }
    
    onViewChangeIcon(idx: number): void {
        this.setActiveIcon(idx);
    }
    
    onViewChangeColor(idx: number): void {
        this.setActiveColor(idx);
        
        let iconIdx = this.getActiveIconIndex();
        this.transformIconsCollection.rebuild();
        this.setActiveIcon(iconIdx);
    }
    
    getActiveIconIndex(): number {
        let idx = this.activeIconsCollection.getActiveIndex();
        return idx < 0 ? 0 : idx;
    }
    
    getActiveColorIndex(): number {
        let idx = this.activeColorsCollection.getActiveIndex();
        return idx < 0 ? 0 : idx;
    }
    
    setActiveIcon(idx: number): void {
        this.activeIconsCollection.setActive(this.activeIconsCollection.get(idx == 0 ? 1 : 0));
        this.activeIconsCollection.setActive(this.activeIconsCollection.get(idx));
    }
    
    setActiveColor(idx: number): void {
        this.activeColorsCollection.setActive(this.activeColorsCollection.get(idx));
    }
    
}