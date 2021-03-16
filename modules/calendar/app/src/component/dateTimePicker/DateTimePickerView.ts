import { component, window as wnd, JQuery as $, Q, Types, webUtils } from "pmc-web";
import { Model } from "./DateTimePickerController";
import { func as mainTemplate } from "./template/main.html";
import { DateUtils } from "../../main/DateUtils";

export class DateTimePickerView extends component.base.ComponentView {
    
    $container: JQuery;
    $main: JQuery;
    parent: wnd.base.BaseWindowView<any>;
    model: Model;
    customSelectMonth: component.customselect.CustomSelectView;
    customSelectYear: component.customselect.CustomSelectView;
    dragStartLeft: number = null;
    dragStartTop: number = null;
    dragStartMouseX: number = null;
    dragStartMouseY: number = null;
    documentMouseMoveBound: any = null;
    documentMouseUpBound: any = null;
    
    constructor(parent: Types.app.ViewParent) {
        super(parent);
        
        this.customSelectMonth = this.addComponent("customSelectMonth", new component.customselect.CustomSelectView(this, {}));
        this.customSelectYear = this.addComponent("customSelectYear", new component.customselect.CustomSelectView(this, {}));
        
        this.documentMouseDownBound = this.onDocumentMouseDown.bind(this);
        this.documentKeyDownBound = this.onDocumentKeyDown.bind(this);
    }
    
    init(modelStr: string): any {
        let model: Model = JSON.parse(modelStr);
        this.setModel(model);
        
        this.bindEvents();
        
        this.customSelectMonth.onChange(str => {
            if (!str) {
                return;
            }
            this.model.visibleMonth = Number(str);
            this.triggerEvent("changeMonth", this.model.visibleMonth);
        });
        this.customSelectYear.onChange(str => {
            if (!str) {
                return;
            }
            this.model.visibleYear = Number(str);
            this.triggerEvent("changeYear", this.model.visibleYear);
        });
        
        return Q.all([
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
        this.$container.on("click", "[data-dmy]", this.onDayClick.bind(this));
        this.$container.on("click", ".time-item", this.onTimeClick.bind(this));
        this.$container.on("mousewheel", this.onMouseWheel.bind(this));
        this.$container.on("mousedown", ".popup", this.onPopupMouseDown.bind(this));
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
            this.$main = this.$container.children(".date-time-picker-component");
            this.customSelectMonth.setContainer(this.$container.find(".month-container"));
            this.customSelectYear.setContainer(this.$container.find(".year-container"));
        }
    }
    
    setDateTimes(visibleDay: number, visibleMonth: number, visibleYear: number, selectedDay: number, selectedMonth: number, selectedYear: number, time: number): void {
        this.model.visibleDay = visibleDay;
        this.model.visibleMonth = visibleMonth;
        this.model.visibleYear = visibleYear;
        this.model.selectedDay = selectedDay;
        this.model.selectedMonth = selectedMonth;
        this.model.selectedYear = selectedYear;
        this.model.selectedTime = time;
        this.fillCalendar();
    }
    
    onPrevBtnClick(): void {
        this.triggerEvent("prev");
    }
    
    onNextBtnClick(): void {
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
    
    onDayClick(e: MouseEvent): void {
        let el = <HTMLElement>e.currentTarget;
        let dmy = el.getAttribute("data-dmy");
        let [d, m, y] = dmy.split(".").map(x => parseInt(x));
        --m;
        
        let dt = new Date(y, m, d, 0, 0, 0, this.model.selectedTime);
        let ts = dt.getTime();
        this.setTimestamp(ts);
    }
    
    onTimeClick(e: MouseEvent): void {
        let el = <HTMLElement>e.currentTarget;
        let str = el.getAttribute("data-val");
        if (!str) {
            if (this.model) {
                this.model.selectedTime = null;
                this.triggerEvent("changeTime", this.model.selectedTime);
            }
            return;
        }
        let [hs, ms] = str.split(":").map(x => parseInt(x));
        this.model.selectedTime = (hs * 3600 + ms * 60) * 1000;
        this.triggerEvent("changeTime", this.model.selectedTime);
    }
    
    onMouseWheel(e: MouseWheelEvent): void {
        let $tc = this.$container.find(".time-container");
        if ($.contains($tc[0], <HTMLElement>e.target)) {
            return;
        }
        if (e.deltaY < 0) {
            this.triggerEvent("next");
        }
        else {
            this.triggerEvent("prev");
        }
    }
    
    onPopupMouseDown(e: MouseEvent): void {
        let $el = $(e.target);
        if (!$el.is(".popup, .popup-buttons, .date, .time, .left, .right, .pf-content, .pf-scroll-panel, .flex-container")) {
            return;
        }
        let $popup = this.$container.find(".popup");
        if ($popup.length == 0) {
            return;
        }
        this.dragStartLeft = parseInt($popup.css("left"));
        this.dragStartTop = parseInt($popup.css("top"));
        this.dragStartMouseX = e.screenX;
        this.dragStartMouseY = e.screenY;
        this.documentMouseMoveBound = this.onDocumentMouseMove.bind(this);
        this.documentMouseUpBound = this.onDocumentMouseUp.bind(this);
        $(document).on("mouseup", this.documentMouseUpBound);
        $(document).on("mousemove", this.documentMouseMoveBound);
    }
    
    onDocumentMouseMove(e: MouseEvent): void {
        let $popup = this.$container.find(".popup");
        $popup.css({
            left: this.dragStartLeft + (e.screenX - this.dragStartMouseX),
            top: this.dragStartTop + (e.screenY - this.dragStartMouseY),
        });
    }
    
    onDocumentMouseUp(): void {
        $(document).off("mouseup", this.documentMouseUpBound);
        $(document).off("mousemove", this.documentMouseMoveBound);
    }
    
    
    
    
    
    
    /****************************************
    ***************** Popup *****************
    *****************************************/
    popupVisible: boolean = false;
    documentMouseDownBound: any = null;
    documentKeyDownBound: any = null;
    show($target: JQuery, $container: JQuery, newTimestamp: number = null, wholeDays: boolean = false): void {
        if (this.popupVisible) {
            return;
        }
        if (newTimestamp) {
            this.setTimestamp(newTimestamp);
        }
        else {
            this.setTimestamp(new Date().getTime());
        }
        this.$main.toggleClass("whole-days", wholeDays);
        this.$main.addClass("popup-visible");
        
        let containerPadding = 5;
        let pxs = {
            container: {
                x: containerPadding,
                y: containerPadding,
                width: $container.offset().left + $container.width() - containerPadding * 2,
                height: $container.offset().top + $container.height() - containerPadding * 2,
            },
            target: {
                x: $target.offset().left,
                y: $target.offset().top,
                width: $target.width(),
                height: $target.height(),
            },
            popup: {
                x: 0,
                y: 0,
                width: this.$main.width(),
                height: this.$main.height(),
            },
        };
        
        pxs.popup.x = pxs.target.x + pxs.target.width / 2 - pxs.popup.width / 2;
        pxs.popup.y = pxs.target.y + pxs.target.height / 2 - pxs.popup.height / 2;
        
        // Fit into container
        pxs.popup.x = Math.max(containerPadding, pxs.popup.x);
        pxs.popup.y = Math.max(containerPadding, pxs.popup.y);
        let popupRight = pxs.popup.x + pxs.popup.width;
        let popupTop = pxs.popup.y + pxs.popup.height;
        let containerRight = pxs.container.x + pxs.container.width;
        let containerTop = pxs.container.y + pxs.container.height;
        if (popupRight > containerRight) {
            pxs.popup.x -= (popupRight - containerRight) + 2 * containerPadding;
        }
        if (popupTop > containerTop) {
            pxs.popup.y -= (popupTop - containerTop) + 2 * containerPadding;
        }
        const minPopupWidth = 380;
        if (pxs.popup.x + minPopupWidth > containerRight) {
            pxs.popup.x = containerRight - minPopupWidth;
        }
        
        this.$main.css({
            left: pxs.popup.x,
            top: pxs.popup.y,
            width: `${minPopupWidth}px`,
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
    
    fillCalendar(): void {
        let currMonth = this.model.visibleMonth;
        let currYear = this.model.visibleYear;
        let prevMonth = currMonth == 0 ? 11 : (currMonth - 1);
        let prevYear = currMonth == 0 ? (currYear - 1) : currYear;
        let nextMonth = currMonth == 11 ? 0 : (currMonth + 1);
        let nextYear = currMonth == 11 ? (currYear + 1) : currYear;
        
        let dt = new Date(currYear, currMonth, 1);
        let numDays = DateUtils.numDaysInMonth(currMonth, currYear);
        let lastDayOfPrevMonth = DateUtils.numDaysInMonth(prevMonth, prevYear);
        let firstDayOfWeek = (dt.getDay() + 6) % 7;
        if (firstDayOfWeek == 0) {
            firstDayOfWeek = 7;
        }
        
        let container = this.$container.find(".day-container")[0];
        for (let i = 0, n = 7 * 6; i < n; ++i) {
            let el = container.children[i];
            let d: number, m: number, y: number;
            if (i < firstDayOfWeek) {
                // Prev month
                d = lastDayOfPrevMonth - (firstDayOfWeek - i) + 1;
                m = prevMonth;
                y = prevYear;
                el.className = "prev-month";
                el.textContent = d.toString();
            }
            else if (i >= firstDayOfWeek + numDays) {
                // Next month
                d = i - firstDayOfWeek - numDays + 1;
                m = nextMonth;
                y = nextYear;
                el.className = "next-month";
                el.textContent = d.toString();
            }
            else {
                // Curr month
                d = i - firstDayOfWeek + 1;
                m = currMonth;
                y = currYear;
                el.className = "curr-month";
                el.textContent = d.toString();
            }
            let now = new Date();
            let isToday = d == now.getDate() && m == now.getMonth() && y == now.getFullYear();
            let isSelected = d == this.model.selectedDay && m == this.model.selectedMonth && y == this.model.selectedYear;
            el.classList.toggle("today", isToday);
            el.classList.toggle("selected", isSelected);
            el.setAttribute("data-dmy", d + "." + (m + 1) + "." + y);
        }
    }
    
    updateTimeItems(itemsStr: string): void {
        let items: component.customselect.CustomSelectItem[] = JSON.parse(itemsStr);
        let $tc = this.$container.find(".time-container");
        if ($tc.find(".pf-content").length == 0) {
            (<any>$tc).pfScroll();
        }
        let $cont = $tc.find(".pf-content");
        $cont.html("");
        for (let item of items) {
            $cont.append("<div class='time-item item" + (item.selected ? " selected" : "") + "' data-val='" + item.value + "'>" + item.text + "</div>");
        }
        let $selected = $cont.find(".item.selected");
        if ($selected.length > 0) {
            webUtils.UI.scrollViewIfNeeded($cont[0], $selected[0]);
        }
    }
    
}
