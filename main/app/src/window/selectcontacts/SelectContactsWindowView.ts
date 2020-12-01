import {BaseWindowView, WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {func as userTemplate} from "./template/user.html";
import {func as groupTemplate} from "./template/group.html";
import {func as sectionTemplate} from "./template/section.html";
import {func as userGroupTemplate} from "./template/userGroup.html";
import * as $ from "jquery";
import {Model, ContactEntry} from "./SelectContactsWindowController";
import {app} from "../../Types";
import {KEY_CODES} from "../../web-utils/UI";
import { PersonsView } from "../../component/persons/PersonsView";
import { NotificationView } from "../../component/notification/NotificationView";
import { SearchFilter } from "../../app/common/SearchFilter";

enum FocusedList {
    chooser = 0,
    choosen = 1,
}

@WindowView
export class SelectContactsWindowView extends BaseWindowView<Model> {
    
    static readonly MIN_FILTER_WORD_LENGTH: number = 2;
    state: Model;
    $filter: JQuery;
    $choosenList: JQuery;
    $choosenAny: JQuery;
    $chooserList: JQuery;
    $chooserAny: JQuery;
    currentFilter: string;
    personsComponent: PersonsView;
    notifications: NotificationView;
    focusedList: FocusedList = FocusedList.chooser;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new PersonsView(this, this.helper));
        this.notifications = this.addComponent("notifications", new NotificationView(this, {xs: true}));
    }
    
    initWindow(model: Model): Q.Promise<void> {
        this.personsComponent.$main = this.$main;
        return this.personsComponent.triggerInit().then(() => {
            this.state = model;
            this.$main.on("click", "[data-action=confirm]", this.onConfirmClick.bind(this));
            this.$main.on("click", "[data-action=cancel]", this.onCancelClick.bind(this));
            this.$main.on("click", "[data-action=remove-contact]", this.onRemoveContactClick.bind(this));
            this.$main.find(".tab-index-guard").on("focus", this.onTabIndexGuardFocus.bind(this));
            this.$main.on("click", "[data-action=add-contact]", this.onAddContactClick.bind(this));
            this.$filter = this.$main.find(".filter input");
            this.$choosenList = this.$main.find(".choosen .list");
            this.$choosenAny = this.$main.find(".choosen .any");
            this.$chooserList = this.$main.find(".chooser .list");
            this.$chooserAny = this.$main.find(".chooser .any");
            this.currentFilter = "";
            this.$filter.on("input", this.onFilterInput.bind(this));
            this.$filter.on("keydown", this.onFilterKeyDown.bind(this));
            this.bindKeyPresses();
            
            this.state.choosenContacts.forEach(contact => {
                this.renderChoosenElement(contact, this.state.editable);
            });
            this.state.othersContacts.forEach(contact => {
                this.renderChooserElement(contact);
            });
            this.refreshVisibility();
            this.$filter.focus().select();
            this.notifications.$container = this.$main.find(".notifications-container-wrapper");
            return this.notifications.triggerInit();
        });
    }
        
    renderChoosenElement(contact: ContactEntry, editable: boolean): void {
        if(!contact) {
            return;
        }
        
        if (contact.type == "contact") {
            let model = this.personsComponent.getPerson(contact.hashmail);
            let $user = this.templateManager.createTemplate(userTemplate).renderToJQ(model, editable ? "choosen" :  "choosen-not-editable");
            $user.data("contact", contact);
            $user.data("search", contact.displayName);
            this.applyFilter($user);
            this.$choosenList.append($user);
        }
        else if (contact.type == "group") {
            let $user = this.templateManager.createTemplate(groupTemplate).renderToJQ(contact, editable ? "choosen" :  "choosen-not-editable");
            $user.data("contact", contact);
            $user.data("search", contact.displayName);
            this.applyFilter($user);
            this.$choosenList.append($user);
        }
        else if (contact.type == "section") {
            let $user = this.templateManager.createTemplate(sectionTemplate).renderToJQ(contact, editable ? "choosen" :  "choosen-not-editable");
            $user.data("contact", contact);
            $user.data("search", contact.displayName);
            this.applyFilter($user);
            this.$choosenList.append($user);
        }
        else if (contact.type == "userGroup") {
            let $userGroup = this.templateManager.createTemplate(userGroupTemplate).renderToJQ(contact, editable ? "choosen" :  "choosen-not-editable");
            $userGroup.data("contact", contact);
            $userGroup.data("search", contact.displayName);
            this.applyFilter($userGroup);
            this.$choosenList.append($userGroup);
        }
        this.sortLists();
    }
    
    renderChooserElement(contact: ContactEntry) {
        if(!contact) {
            return;
        }
            
        if (contact.type == "contact") {
            let model = this.personsComponent.getPerson(contact.hashmail);
            let $user = this.templateManager.createTemplate(userTemplate).renderToJQ(model, "toChoose");
            $user.data("contact", contact);
            $user.data("search", contact.displayName);
            this.applyFilter($user);
            this.$chooserList.append($user);
        }
        else if (contact.type == "group") {
            let $user = this.templateManager.createTemplate(groupTemplate).renderToJQ(contact, "toChoose");
            $user.data("contact", contact);
            $user.data("search", contact.displayName);
            this.applyFilter($user);
            this.$chooserList.append($user);
        }
        else if (contact.type == "section") {
            let $user = this.templateManager.createTemplate(sectionTemplate).renderToJQ(contact, "toChoose");
            $user.data("contact", contact);
            $user.data("search", contact.displayName);
            this.applyFilter($user);
            this.$chooserList.append($user);
        }
        else if (contact.type == "userGroup") {
            let $userGroup = this.templateManager.createTemplate(userGroupTemplate).renderToJQ(contact, "toChoose");
            $userGroup.data("contact", contact);
            $userGroup.data("search", contact.displayName);
            this.applyFilter($userGroup);
            this.$chooserList.append($userGroup);
        }
        this.sortLists();
    }
    
    applyFilter($user: JQuery): void {
        $user.removeClass("active");
        if (SearchFilter.prepareHaystack($user.data("search")).indexOf(this.currentFilter) != -1) {
            let $name = $user.find(".name");
            let raw = $name.text();
            if (this.currentFilter.length > 0) {
                let text = "";
                let lowerCase = SearchFilter.prepareHaystack(raw);
                let index = 0;
                while (true) {
                    let newIndex = lowerCase.indexOf(this.currentFilter, index);
                    if (newIndex == -1) {
                        break;
                    }
                    text += raw.substring(index, newIndex);
                    text += "<b>" + raw.substr(newIndex, this.currentFilter.length) + "</b>";
                    index = newIndex + this.currentFilter.length;
                }
                $name.html(text + raw.substr(index));
            }
            else {
                $name.html(raw);
            }
            $user.removeClass("hide");
        }
        else {
            $user.addClass("hide");
        }
    }
    
    refreshVisibility(): void {
        this.refreshChoosenVisibility();
        this.refreshChooserVisibility();
        let $list = this.focusedList == FocusedList.choosen ? this.$choosenList : this.$chooserList;
        if ($list.children().length == 0) {
            let $otherList = this.focusedList == FocusedList.chooser ? this.$choosenList : this.$chooserList;
            if ($otherList.children().length > 0) {
                this.focusedList = this.focusedList == FocusedList.choosen ? FocusedList.chooser : FocusedList.choosen;
            }
        }
    }
    
    refreshChoosenVisibility(): void {
        if (this.$choosenList.children().not(".hide").length > 0) {
            this.$choosenList.removeClass("hide");
            this.$choosenAny.addClass("hide");
        }
        else {
            this.$choosenList.addClass("hide");
            this.$choosenAny.removeClass("hide");
        }
    }
    
    refreshChooserVisibility(): void {
        if (this.$chooserList.children().not(".hide").length > 0) {
            this.$chooserList.removeClass("hide");
            this.$chooserAny.addClass("hide");
        }
        else {
            this.$chooserList.addClass("hide");
            this.$chooserAny.removeClass("hide");
        }
    }
    
    onConfirmClick(): void {
        let contacts: ContactEntry[] = [];
        this.$choosenList.children().each((_i, e) => {
            contacts.push($(e).data("contact"));
        });
        if (contacts.length == 0 && !this.state.allowEmpty) {
            return;
        }
        this.triggerEvent("confirm", contacts);
    }
    
    onCancelClick(): void {
        this.triggerEvent("cancel");
    }
    
    onAddContactClick(event: MouseEvent): void {
        event.stopPropagation();
        this.addContact($(<HTMLElement>event.target).closest(".contact-item"));
        this.$filter.val("");
        this.$filter.focus().select();
        this.onFilterInput();
    }
    
    addContact($old: JQuery): void {
        let contact = <ContactEntry>$old.data("contact");
        if (!this.isContactAllowed(contact)) {
            this.triggerEvent("notifyNotAllowed");
            return;
        }
        this.renderChoosenElement(contact, true);
        $old.remove();
        this.removeConflictingContactsOf(contact);
        this.refreshVisibility();
    }
    
    isContactAllowed(contact: ContactEntry): boolean {
        let isSection = contact.type == "section";
        let isUserGroup = contact.type == "userGroup";
        let hasContactsSelected = false;
        let hasSectionsSelected = false;
        let hasUserGroupSelected = false;
        this.$choosenList.children().each((_i, e) => {
            let contact2 = $(e).data("contact");
            if (contact2.type == "section") {
                hasSectionsSelected = true;
            }
            else if (contact2.type == "userGroup") {
                hasUserGroupSelected = true;
            }
            else {
                hasContactsSelected = true;
            }
        });
        if (hasSectionsSelected || hasUserGroupSelected) {
            return false;
        }
        if (isSection && hasContactsSelected) {
            return false;
        }
        if (isUserGroup && hasContactsSelected) {
            return false;
        }
        return true;
    }
    
    removeContact($old: JQuery): void {
        let contact = <ContactEntry>$old.data("contact");
        this.renderChooserElement(contact);
        $old.remove();
        this.refreshVisibility();
    }
    
    removeConflictingContactsOf(contact: ContactEntry): void {
        let toRemove: string;
        if (contact.id == "<admins>") {
            toRemove = "<local>";
        }
        else
        if (contact.id == "<local>") {
            toRemove = "<admins>"
        }
        else {
            return;
        }
        let $elemToMove = this.$choosenList.find(".contact-item[data-id='" + toRemove + "']");
        this.renderChooserElement(<ContactEntry>$elemToMove.data("contact"));
        $elemToMove.remove();
    }

    onRemoveContactClick(event: MouseEvent): void {
        event.stopPropagation();
        this.removeContact($(<HTMLElement>event.target).closest(".contact-item"));
        this.$filter.focus().select();
    }
    
    onFilterInput(): void {
        this.currentFilter = SearchFilter.prepareNeedle(<string>this.$filter.val()).trim();
        this.currentFilter = this.currentFilter.length >= SelectContactsWindowView.MIN_FILTER_WORD_LENGTH ? this.currentFilter : "";
        this.$chooserList.children().each((_i, e) => {
            this.applyFilter($(e));
        });
        // this.$choosenList.children().each((_i, e) => {
        //     this.applyFilter($(e));
        // });
        this.refreshChooserVisibility();
        // this.refreshChoosenVisibility();
    }
    
    onFilterKeyDown(event: KeyboardEvent): void {
        if (event.key == "ArrowUp") {
            this.selectPrev();
        }
        else if (event.key == "ArrowDown") {
            this.selectNext();
        }
        else if (event.key == "ArrowRight" && this.focusedList == FocusedList.chooser) {
            this.addActive();
        }
        else if (event.key == "ArrowLeft" && this.focusedList == FocusedList.choosen) {
            this.addActive();
        }
    }
    
    isAnyActive(): boolean {
        let $list = this.focusedList == FocusedList.choosen ? this.$choosenList : this.$chooserList;
        return $list.children(".active").length > 0;
    }
    
    addActive(): void {
        let $list = this.focusedList == FocusedList.choosen ? this.$choosenList : this.$chooserList;
        let $active = $list.children(".active");
        if ($active.length > 0) {
            if (this.focusedList == FocusedList.chooser) {
                this.addContact($active);
            }
            else {
                this.removeContact($active);
            }
            this.$filter.val("");
            this.onFilterInput();
        }
    }
    
    selectPrev(): void {
        let $list = this.focusedList == FocusedList.choosen ? this.$choosenList : this.$chooserList;
        let $active = $list.children(".active");
        if ($active.length > 0) {
            let $prev = this.jqFirstPrev($active);
            if ($prev.length > 0) {
                $active.removeClass("active");
                $prev.addClass("active");
                this.scrollTo($prev);
            }
        }
    }
    
    selectNext(): void {
        let $list = this.focusedList == FocusedList.choosen ? this.$choosenList : this.$chooserList;
        let $active = $list.children(".active");
        if ($active.length > 0) {
            let $next = this.jqFirstNext($active);
            if ($next.length > 0) {
                $active.removeClass("active");
                $next.addClass("active");
                this.scrollTo($next);
            }
        }
        else {
            let $current = $list.children(":not(.hide)").first();
            if ($current.length > 0) {
                $current.addClass("active");
                this.scrollTo($current);
            }
        }
    }
    
    scrollTo($ele: JQuery): void {
        let ch = this.$chooserList[0];
        let eBB = $ele[0].getBoundingClientRect();
        let lBB = ch.getBoundingClientRect();
        if (eBB.bottom > lBB.bottom) {
            ch.scrollTo(0, ch.scrollTop + (eBB.bottom - lBB.bottom));
        }
        if (eBB.top < lBB.top) {
            ch.scrollTo(0, ch.scrollTop - (lBB.top - eBB.top));
        }
    }
    
    onTabIndexGuardFocus(): void {
        this.$main.find("[tabindex=1]").focus();
    }
    
    jqFirst($e: JQuery, fncName: string): JQuery {
        while (true) {
            $e = <JQuery>(<any>$e)[fncName]();
            if ($e.length == 0) {
                break;
            }
            if ($e.not(".hide").length > 0) {
                return $e;
            }
        }
        return $();
    }
    
    jqFirstPrev($e: JQuery): JQuery {
        return this.jqFirst($e, "prev");
    }
    
    jqFirstNext($e: JQuery): JQuery {
        return this.jqFirst($e, "next");
    }
    
    bindKeyPresses(): void {
        $(document).on("keydown", e => {
            if (e.keyCode == KEY_CODES.enter) {
                e.preventDefault();
                if (this.isAnyActive() && !e.ctrlKey) {
                    this.addActive();
                }
                else {
                    this.onConfirmClick();
                }
            }
            else if (e.keyCode == KEY_CODES.escape) {
                e.preventDefault();
                this.onCancelClick();
            }
            else if (e.keyCode == KEY_CODES.tab) {
                e.preventDefault();
                let $prevList = this.focusedList == FocusedList.choosen ? this.$choosenList : this.$chooserList;
                let $list = this.focusedList == FocusedList.chooser ? this.$choosenList : this.$chooserList;
                if ($list.children().length > 0) {
                    this.focusedList = this.focusedList == FocusedList.choosen ? FocusedList.chooser : FocusedList.choosen;
                    $prevList.children(".active").removeClass("active");
                    $list.children().first().addClass("active");
                }
            }
        });
    }
    
    sortLists(): void {
        this.sortList(this.$chooserList);
        this.sortList(this.$choosenList);
    }
    
    sortList($list: JQuery): void {
        let els = $list.children().toArray().map(el => {
            let $el = $(el);
            let userName = $el.find(".name").text().trim();
            return {
                isUser: $el.hasClass("window-select-contacts-user") && ! $el.hasClass("user-group"), 
                isSection: $el.hasClass("window-select-contacts-section"),
                isGroup: $el.hasClass("window-select-contacts-group"),
                isUsersGroup: $el.hasClass("user-group"),
                isExternal: userName.indexOf("@") >= 0,
                name: userName,
                $el: $el,
            };
        });
        els.sort((a, b) => {
            if (a.isUser && b.isUsersGroup) {
                return -1;
            }
            if (a.isUsersGroup && b.isUser) {
                return 1;
            }
            if (a.isSection != b.isSection) {
                return (b.isSection ? 1 : 0) - (a.isSection ? 1 : 0);
            }
            if (a.isGroup != b.isGroup) {
                return (b.isGroup ? 1 : 0) - (a.isGroup ? 1 : 0);
            }
            if (a.isUser != b.isUser) {
                return (a.isUser ? 1 : 0) - (b.isUser ? 1 : 0);
            }
            if (a.isExternal != b.isExternal) {
                return (a.isExternal ? 1 : 0) - (b.isExternal ? 1 : 0);
            }
            if (a.isUsersGroup != b.isUsersGroup) {
                return (a.isUsersGroup ? 1 : 0) - (b.isUsersGroup ? 1 : 0);
            }
            if (a.isUsersGroup && b.isUsersGroup) {
                return a.name.split(",").length - b.name.split(",").length;
            }


            return a.name.localeCompare(b.name);
        });
        $list.children().detach();
        for (let el of els) {
            $list.append(el.$el);
        }
    }
}
