import {BaseWindowController} from "../base/BaseWindowController";
import * as Q from "q";
import {app, utils} from "../../Types";
import { TreeController } from "../../component/tree/TreeController";
import { SectionManager } from "../../mail/section/SectionManager";
import { SectionService, VirtualSectionService } from "../../mail/section/SectionService";
import { MutableCollection } from "../../utils/collection/MutableCollection";
import { TransformCollection } from "../../utils/collection/TransformCollection";
import { WithActiveCollection } from "../../utils/collection/WithActiveCollection";
import { MergedCollection } from "../../utils/collection/MergedCollection";
import { SectionEntry, Model, State } from "../sections/SectionUITypes";
import {Inject, Dependencies} from "../../utils/Decorators"
import { FilteredCollection } from "../../utils/collection/FilteredCollection";
import { ExtListController } from "../../component/extlist/ExtListController";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";

@Dependencies(["tree"])
export class SectionPickerWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.sectionPicker.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    @Inject identityProvider: utils.IdentityProvider;
    static ROOT_ID = "virtual:root";
    deferred: Q.Deferred<SectionService>;
    sectionsTree: TreeController<SectionEntry>;
    sectionManager: SectionManager;
    activeCollection: WithActiveCollection<SectionService>;
    filteredCollection: FilteredCollection<SectionService>;
    sections: ExtListController<SectionEntry>;
    topLevelSelected: boolean;
    
    constructor(parent: app.WindowParent, public sourceSection: SectionService, options?: app.WindowOptions, public asSectionCreatorWindow: boolean = false) {
        super(parent, __filename, __dirname);
        this.ipcMode = true;
        this.openWindowOptions = {
            toolbar: false,
            maximized: false,
            show: false,
            position: "center",
            width: 440,
            height: 450,
            minWidth: 440,
            minHeight: 400,
            icon: "icon fa fa-cubes",
            title: this.i18n("window.sectionPicker.title" + (asSectionCreatorWindow ? ".asCreator" : ""))
        };
        if (options) {
            Object.keys(options).forEach( key => {
                if ((<any>options)[key]) {
                    (<any>this.openWindowOptions)[key] = (<any>options)[key];
                }
            });
        }
        this.deferred = Q.defer();
    }
    
    init(): Q.IWhenable<void> {
        return Q().then(() => {
            return this.app.mailClientApi.privmxRegistry.getSectionManager();
        })
        .then(sectionManager => {
            this.sectionManager = sectionManager;
            return this.sectionManager.load();
        })
        .then(() => {
            // let merged = new MergedCollection<SectionService>();
            // merged.addCollection(new MutableCollection<SectionService>([new VirtualSectionService({
            //     id: SectionPickerWindowController.ROOT_ID,
            //     name: this.i18n("window.sectionPicker.no_parent.label", this.identityProvider.getIdentity().host),
            //     editableMyBe: false,
            //     canCreateSubsection: this.identityProvider.isAdmin()
            // })]));
            // merged.addCollection(this.sectionManager.managabledCollection);
            this.filteredCollection = this.addComponent("filteredCollection", new FilteredCollection<SectionService>(this.sectionManager.managabledCollection, this.filterInvalidSections.bind(this)));

            this.registerChangeEvent(this.sectionManager.managabledCollection.changeEvent, this.onCollectionChange);
            this.activeCollection = this.addComponent("activeCollection", new WithActiveCollection(this.filteredCollection));
            if (this.filteredCollection.collection.list.length > 0) {
                this.activeCollection.setActive(this.filteredCollection.collection.list[0]);
            }
            let castCollection = this.addComponent("castCollection", new TransformCollection<SectionEntry, SectionService>(this.activeCollection, this.convertSection.bind(this)));
            this.sections = this.addComponent("sections", this.componentFactory.createComponent("extlist", [this, castCollection]));
            this.sections.ipcMode = true;
            this.setTopLevelSelected(this.identityProvider.isAdmin());
        });
    }
    
    filterInvalidSections(section: SectionService): boolean {
        return section.canCreateSubsection();
    }
    
    getSectionPromise(): Q.Promise<SectionService> {
        return this.deferred.promise;
    }
    
    onViewSelect(): void {
        if (this.topLevelSelected) {
            this.deferred.resolve(null);
        }
        else {
            this.deferred.resolve(this.activeCollection.getActive());
        }
        this.close();
    }
    
    convertSection(section: SectionService): SectionEntry {
        let parents: SectionService[] = [];
        let lastParent = section.getParent();
        while (lastParent) {
            parents.unshift(lastParent);
            lastParent = lastParent.getParent();
        }
        let breadcrumb = "";
        parents.forEach(p => {
            breadcrumb += p.getName() + " / ";
        });
                
        let parent = section.getParent();
        return {
            id: section.getId(),
            parentId: parent ? parent.getId() : (section.getId() == SectionPickerWindowController.ROOT_ID ? null : SectionPickerWindowController.ROOT_ID),
            enabled: section.isValid(),
            visible: section.userSettings ? section.userSettings.visible : true,
            name: section.getName(),
            scope: section.getScope(),
            isRoot: section.getId() == SectionPickerWindowController.ROOT_ID,
            breadcrumb: breadcrumb
        };
    }
    
    getActiveId(): string {
        let active = this.activeCollection.getActive();
        return active ? active.getId() : null;
    }
    
    getModel(): Model {
        return {
            state: this.getActiveState(),
            server: this.identityProvider.getIdentity().host,
            asCreator: this.asSectionCreatorWindow
        }
    }
        
    onViewClose(): void {
        this.close();
    }
    
    onViewSetActive(id: string) {
        let active = this.activeCollection.find(x => x.getId() == id);
        if (active == null) {
            return;
        }
        this.setActive(active);
    }
    
    setActive(active: SectionService): void {
        this.activeCollection.setActive(active);
        this.callViewMethod("setButtonsState", this.getActiveState());
    }

    isDestinationMyDescent(me: SectionService, dest: SectionService): boolean {
        if (!me) {
          return false;
        }
        return me.getDescantsAndMe().indexOf(dest) > -1;
    }

    getActiveState(): State {
        let canAdd: boolean = true;
        let active = this.activeCollection.getActive();
        if (active) {
            if (!(active instanceof VirtualSectionService)) {
                canAdd = canAdd && (! this.isDestinationMyDescent(this.sourceSection, active));
            }
            canAdd = canAdd && active.canCreateSubsection();
        }
        else {
            canAdd = false;
        }
        return {
            canAdd: canAdd,
            sectionsLimitReached: false,
            isAdmin: this.identityProvider.isAdmin(),
            
        };
    }
    
    onViewRefresh() {
        this.sectionManager.load().fail(this.logError);
    }
    
    onCollectionChange(event: utils.collection.CollectionEvent<SectionService>): void {
        if (event.type == "update" && event.element == this.activeCollection.getActive()) {
            if (event.element == this.activeCollection.getActive()) {
                this.setActive(event.element);
            }
        }
    }

    private setTopLevelSelected(selected: boolean): void {
        this.topLevelSelected = selected;
    }

    onViewTopLevelSelected(selected: boolean): void {
        this.setTopLevelSelected(selected);
    }
}
