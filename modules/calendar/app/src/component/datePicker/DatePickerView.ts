import { component, window as wnd, JQuery as $, Q, Types } from "pmc-web";
import { Model } from "./DatePickerController";
import { func as mainTemplate } from "./template/main.html";

export class DatePickerView extends component.base.ComponentView {
    
    $container: JQuery;
    $main: JQuery;
    parent: wnd.base.BaseWindowView<any>;
    model: Model;
    customSelectDay: component.customselect.CustomSelectView;
    customSelectMonth: component.customselect.CustomSelectView;
    customSelectYear: component.customselect.CustomSelectView;
    overridePrevNextAbsDelta: () => number = null;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent);
        
        this.customSelectDay = this.addComponent("customSelectDay", new component.customselect.CustomSelectView(this, {}));
        this.customSelectMonth = this.addComponent("customSelectMonth", new component.customselect.CustomSelectView(this, {}));
        this.customSelectYear = this.addComponent("customSelectYear", new component.customselect.CustomSelectView(this, {}));
        
        this.documentMouseDownBound = this.onDocumentMouseDown.bind(this);
        this.documentKeyDownBound = this.onDocumentKeyDown.bind(this);
    }
    
    init(modelStr: string): any {
        let model: Model = JSON.parse(modelStr);
        this.setModel(model);
        
        this.bindEvents();
        
        this.customSelectDay.onChange(str => {
            if (!str) {
                return;
            }
            this.model.selectedDay = Number(str);
            this.triggerEvent("changeDay", this.model.selectedDay);
        });
        this.customSelectMonth.onChange(str => {
            if (!str) {
                return;
            }
            this.model.selectedMonth = Number(str);
            this.triggerEvent("changeMonth", this.model.selectedMonth);
        });
        this.customSelectYear.onChange(str => {
            if (!str) {
                return;
            }
            this.model.selectedYear = Number(str);
            this.triggerEvent("changeYear", this.model.selectedYear);
        });
        
        return Q.all([
            this.customSelectDay.triggerInit(),
            this.customSelectMonth.triggerInit(),
            this.customSelectYear.triggerInit(),
        ]);
    }
    
    bindEvents(): void {
        if (!this.$container || this.$container.length == 0 || this.$container.data("events-bound")) {
            return;
        }
        this.$container.on("click", ".prev-btn", this.onPrevBtnClick.bind(this));
        this.$container.on("click", ".next-btn", this.onNextBtnClick.bind(this));
        this.$container.on("click", ".ok-btn", this.onOkBtnClick.bind(this));
        this.$container.on("click", ".cancel-btn", this.onCancelBtnClick.bind(this));
        this.$container.data("events-bound", "1");
    }
    
    setModel(model: Model) {
        this.model = model;
        if (model) {
        }
        this.render();
    }
    
    setData(modelStr: string): void {
        this.setModel(JSON.parse(modelStr));
    }
    
    render(): void {
        this.$container.empty();
        if (this.model) {
            this.bindEvents();
            this.$container.append(this.templateManager.createTemplate(mainTemplate).renderToJQ(this.model));
            this.$main = this.$container.children(".date-picker-component");
            this.customSelectDay.setContainer(this.$container.find(".day-container"));
            this.customSelectMonth.setContainer(this.$container.find(".month-container"));
            this.customSelectYear.setContainer(this.$container.find(".year-container"));
        }
    }
    
    setSelectedDate(day: number, month: number, year: number): void {
        this.model.selectedDay = day;
        this.model.selectedMonth = month;
        this.model.selectedYear = year;
    }
    
    onPrevBtnClick(): void {
        if (this.overridePrevNextAbsDelta) {
            this.triggerEvent("prev", this.overridePrevNextAbsDelta());
            return;
        }
        this.triggerEvent("prev");
    }
    
    onNextBtnClick(): void {
        if (this.overridePrevNextAbsDelta) {
            this.triggerEvent("next", this.overridePrevNextAbsDelta());
            return;
        }
        this.triggerEvent("next");
    }
    
    onOkBtnClick(): void {
        this.hide();
        this.triggerEvent("commitPopup");
    }
    
    onCancelBtnClick(): void {
        this.hide();
        this.triggerEvent("cancelPopup");
    }
    
    setTimestamp(ts: number): void {
        this.triggerEvent("setTimestamp", ts);
    }
    
    setDuration(duration: number): void {
        this.triggerEvent("setDuration", duration);
    }
    
    
    
    
    
    
    /****************************************
    ***************** Popup *****************
    *****************************************/
    popupVisible: boolean = false;
    documentMouseDownBound: any = null;
    documentKeyDownBound: any = null;
    show($target: JQuery, newTimestamp: number = null): void {
        if (this.popupVisible) {
            return;
        }
        if (newTimestamp) {
            if (this.model.options.duration) {
                this.setDuration(newTimestamp);
            }
            else {
                this.setTimestamp(newTimestamp);
            }
        }
        let target = $target[0];
        this.$main.addClass("popup-visible");
        this.$main.css({
            left: target.offsetLeft - 50,
            top: target.offsetTop - 8,
        });
        (<any>document)._preventClose = true;
        $(document).on("mousedown", this.documentMouseDownBound);
        $(document).on("keydown", this.documentKeyDownBound); 
        this.popupVisible = true;
    }
    
    hide(): void {
        if (!this.popupVisible) {
            return;
        }
        this.$main.removeClass("popup-visible");
        delete (<any>document)._preventClose;
        $(document).off("mousedown", this.documentMouseDownBound);
        $(document).off("keydown", this.documentKeyDownBound);
        this.popupVisible = false;
    }
    
    onDocumentMouseDown(e: MouseEvent): void {
        let $el = <JQuery>$(e.target);
        if ($.contains(this.$container[0], $el[0])) {
            return;
        }
        this.hide();
        this.triggerEvent("commitPopup");
    }
    
    onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key == "Escape") {
            this.hide();
            this.triggerEvent("cancelPopup");
        }
        else if (e.key == "Enter") {
            this.hide();
            this.triggerEvent("commitPopup");
        }
    }
    
}
