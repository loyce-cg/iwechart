import {component, JQuery as $, window, Types, Q, webUtils} from "pmc-web";
import {func as mainTemplate} from "./template/main.html";

import {Model} from "./FilesImporterWindowController";
import { ViewTreeItem } from "./TreeItem";
import { SectionsPickerPanelView } from "./pickerpanel/SectionsPickerPanelView";
import { SectionEntryModel, FileEntryModel } from "./pickerpanel/Types";
import { FilesPickerPanelView } from "./pickerpanel/FilesPickerPanelView";
import { FilesToImportPanelView } from "./pickerpanel/FilesToImportPanelView";

export class FilesImporterWindowView extends window.base.BaseWindowView<Model> {
    
    static DOUBLE_CLICK_TIME = 400;
    
    // files: component.tree.TreeView<FileEntry>;
    sizeCounter: number;
    $sizeCounterContainer: JQuery;
    $countContainer: JQuery;
    personsComponent: component.persons.PersonsView;
    sectionsPicker: SectionsPickerPanelView<SectionEntryModel>;
    filesPicker: FilesPickerPanelView<FileEntryModel>;
    choosenFiles: FilesToImportPanelView<FileEntryModel>;
    panelsSplitter: component.splitter.SplitterView;
    $topBarRightPanel: JQuery;
    $topBarLeftPanel: JQuery;

    $bottomBarRightPanel: JQuery;
    $bottomBarLeftPanel: JQuery;

    constructor(parent: Types.app.ViewParent) {
        super(parent, mainTemplate);
        this.personsComponent = this.addComponent("personsComponent", new component.persons.PersonsView(this, this.helper));

        this.sectionsPicker = this.addComponent("sectionsPicker", new SectionsPickerPanelView(this, null));
        this.sectionsPicker.ipcMode = true;

        this.filesPicker = this.addComponent("filesPicker", new FilesPickerPanelView(this, null));
        this.filesPicker.ipcMode = true;

        this.choosenFiles = this.addComponent("choosenFiles", new FilesToImportPanelView(this, null));
        this.choosenFiles.ipcMode = true;


        this.panelsSplitter = this.addComponent("panelsSplitter", new component.splitter.SplitterView(this, {
            firstPanelMinSize: 200,
            secondPanelMinSize: () => {
                return 200
            },
            type: "vertical",
            handlePlacement: "right",
            handleDot: false,
        }));
        this.panelsSplitter.addEventListener("handleMove", this.onHandleMove.bind(this));
    }
    
    initWindow(_model: Model): Q.Promise<void> {
        this.$main.on("click", "[data-action=import]", this.onImportSelected.bind(this));
        this.$main.on("click", "[data-action=close]", this.onClose.bind(this));
        this.$main.find("input[name=hidden-files]").change(this.onHiddenChange.bind(this));

        return Q().then(() => {
            $(document).on("keydown", this.onKeyDown.bind(this));

            this.panelsSplitter.$container = this.$main.find(".content");
            return this.panelsSplitter.triggerInit();
        })
        .then(() => {
            // this.sectionsPicker.$container = this.panelsSplitter.$left;
            this.filesPicker.$container = this.panelsSplitter.$left;
            this.choosenFiles.$container = this.panelsSplitter.$right;
            this.personsComponent.$main = this.$main;

            this.$sizeCounterContainer = this.$main.find(".bottom-bar .totalSize");        
            this.$countContainer = this.$main.find(".bottom-bar .count");        

            return Q.all([
                this.choosenFiles.triggerInit(),
                this.filesPicker.triggerInit(),
                this.personsComponent.triggerInit()
            ]);
        })
        .then(() => {
            this.$topBarRightPanel = this.$main.find(".top-bar .right");
            this.$topBarLeftPanel = this.$main.find(".top-bar .left");

            this.$bottomBarRightPanel = this.$main.find(".bottom-bar .right");
            this.$bottomBarLeftPanel = this.$main.find(".bottom-bar .left");

            const handlePos = this.panelsSplitter.$handle.css("left");
            this.setPanelsPos(handlePos);
            this.hidePathIfRoot(_model.destDirectory);
            this.personsComponent.refreshAvatars();
            this.$main.focus();
        });
    }

    onHiddenChange(event: Event): void {
        this.triggerEvent("hiddenChanged", this.$main.find("input[name=hidden-files]").prop("checked"));
    }

    // onDirectoryClick(event: MouseEvent): void {
    //     event.stopPropagation();
    //     let element = ViewTreeItem.fromEvent(event);

    //     if (element.type != "directory") {
    //         return;
    //     }
    //     this.triggerEvent("directoryClick", element.id, element.parentId);
    // }

    // onSelectionChange(event: Event): void {
    //     let element = ViewTreeItem.fromEvent(event);
    //     if (element.type == "directory") {
    //         if (element.checked) {
    //             element.$el.find(".on-progress").append($('<i class="fa fa-circle-o-notch fa-spin"></i>'));
    //         }
    //         else {
    //             element.$el.find(".on-progress").empty();
    //         }
    //     }
    //     let serialized = element.serialize();
    //     this.triggerEvent("itemSelectionChange", serialized);
    // }

    onKeyDown(e: KeyboardEvent): void {
        if (e.keyCode === webUtils.KEY_CODES.escape) {
            e.preventDefault();
            this.triggerEvent("close");
        }
    }

    onImportSelected(): void {
        this.setImportButtonLocked(true);
        this.triggerEvent("importFiles");
    }

    setImportButtonLocked(locked: boolean): void {
        this.$main.find("[data-action=import]").toggleClass("disabled", locked);
    }

    toggle(elementId: string, show: boolean): void {
        this.$main.find(".file-entry[data-id='"+elementId+"'] .tree-children").toggleClass("hide", !show);
    }
        
    onCloseClick() {
        this.triggerEvent("close");
    }
    
    onAfterFilesListRender() {
        this.scrollTo(this.$main.find(".active"));
    }
    
    scrollTo($ele: JQuery): void {
        if ($ele.length == 0) {
            return;
        }
        let ch = this.$main.find(".table-container")[0];
        let eBB = $ele[0].getBoundingClientRect();
        let lBB = ch.getBoundingClientRect();
        if (eBB.bottom > lBB.bottom) {
            ch.scrollTo(0, ch.scrollTop + (eBB.bottom - lBB.bottom));
        }
        if (eBB.top < lBB.top) {
            ch.scrollTo(0, ch.scrollTop - (lBB.top - eBB.top));
        }
    }

    resetSizeCounter(): void {
        this.sizeCounter = 0;
        this.$sizeCounterContainer.text(this.sizeCounter);
    }

    addSizeToCounter(size: number): void {
        this.sizeCounter += size;
        this.$sizeCounterContainer.text(this.helper.bytesSize2(this.sizeCounter));

    }
    updateFilesTotal(count: number, size: number): void {
        this.$sizeCounterContainer.text(this.helper.bytesSize2(size));
        this.$countContainer.text(count);
    }

    doneProcessing(entryId: string): void {
        let element = ViewTreeItem.fromId(this.$main[0], entryId);
        if (element) {
            element.$el.find(".on-progress").empty();
        }
    }

    onClose(): void {
        this.triggerEvent("close");
    }

    private setPanelsPos(position: number|string): void {
        let posString = typeof position == "number" ? position.toString() : position;
        let posPx = posString.includes("px") ? posString : posString + "px"; 
        this.$topBarLeftPanel.css("width", posPx);
        this.$bottomBarLeftPanel.css("width", posPx);
    }

    private hidePathIfRoot(path: string): void {
        if (path == "/") {
            this.$topBarRightPanel.toggleClass("with-path", false);
        }
    }

    onHandleMove(event: any): void {
        this.setPanelsPos(event.position);
    }

    updateCurrentDir(dir: string): void {
        this.$topBarLeftPanel.find(".current-path").text(dir);
    }
}
