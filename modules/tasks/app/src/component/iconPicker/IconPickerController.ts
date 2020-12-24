import { Q, component, mail, Types } from "pmc-mail";
import app = Types.app;
import { TaskGroupIcon } from "../../main/Types";
import { IconPickerData } from "./IconPickerData";
import { i18n } from "./i18n/index";

export interface Model {
    items: string[];
    colors: string[];
    selectedItemIndex: number;
    selectedColorIndex: number;
}

export class IconPickerController extends component.base.ComponentController {
    
    static textsPrefix: string = "plugin.tasks.component.iconPicker.";
    
    static registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    selectedItemIndex: number = 0;
    selectedColorIndex: number = 0;
    onChangeHandler: () => void = null;
    
    constructor(parent: app.IpcContainer) {
        super(parent);
        this.ipcMode = true;
    }
    
    init(): Q.Promise<any> {
        return Q.resolve();
    }
    
    getModel(): Model {
        return {
            items: IconPickerData.items,
            colors: IconPickerData.colors,
            selectedItemIndex: this.selectedItemIndex,
            selectedColorIndex: this.selectedColorIndex,
        };
    }
    
    setData(selectedItemIndex: number, selectedColorIndex: number): void {
        this.selectedItemIndex = selectedItemIndex;
        this.selectedColorIndex = selectedColorIndex;
        this.callViewMethod("setModel", this.getModel());
    }
    
    onViewSelectedItemIndexChanged(selectedItemIndex: number) {
        this.selectedItemIndex = selectedItemIndex;
        this.emitChanged();
    }
    
    onViewSelectedColorIndexChanged(selectedColorIndex: number) {
        this.selectedColorIndex = selectedColorIndex;
        this.emitChanged();
    }
    
    setIcon(icon: TaskGroupIcon): void {
        if (!icon) {
            this.setData(0, 0);
            return;
        }
        let str = icon.type == "shape" ? '{"type":"shape","shape":"' + icon.shape + '"}' : '{"type":"fa","fa":"' + icon.fa + '"}';
        let selectedItemIndex = IconPickerData.items.indexOf(str);
        let selectedColorIndex = IconPickerData.colors.indexOf(icon.color);
        selectedItemIndex = selectedItemIndex < 0 ? 0 : selectedItemIndex;
        selectedColorIndex = selectedColorIndex < 0 ? 0 : selectedColorIndex;
        this.setData(selectedItemIndex, selectedColorIndex);
    }
    
    getIcon(): TaskGroupIcon {
        let item = JSON.parse(IconPickerData.items[this.selectedItemIndex]);
        if (!item) {
            return null;
        }
        let color = IconPickerData.colors[this.selectedColorIndex];
        let icon: TaskGroupIcon = {
            type: item.type,
            shape: <never>item.shape,
            fa: item.fa,
            color: color,
        };
        return icon;
    }
    
    onChanged(handler: () => void) {
        this.onChangeHandler = handler;
    }
    
    emitChanged(): void {
        if (this.onChangeHandler) {
            this.onChangeHandler();
        }
    }
    
}