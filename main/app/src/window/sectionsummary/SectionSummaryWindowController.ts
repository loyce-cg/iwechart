import {BaseWindowController} from "../base/BaseWindowController";
import {app} from "../../Types";
import { SectionService } from "../../mail/section/SectionService";
import Q = require("q");
import {Inject, Dependencies} from "../../utils/Decorators";
import { SplitterController } from "../../component/splitter/SplitterController";
import { Settings } from "../../utils/Settings";
import { LocaleService } from "../../mail";
import { i18n } from "./i18n";
import { PersonsController } from "../../component/persons/PersonsController";
import { Session } from "../../mail/session/SessionManager";

export interface Model {
    name: string;
    activeModules: string[];
    singleMode: boolean;
}

export interface ModuleController {
    init(): Q.IWhenable<void>;
    setSection(section: SectionService): Q.Promise<boolean>;
    setSession(session: Session): Q.Promise<void>;
}

@Dependencies(["splitter", "persons"])
export class SectionSummaryWindowController extends BaseWindowController {
    
    static textsPrefix: string = "window.sectionSummary.";
    
    static registerTexts(localeService: LocaleService): void {
        localeService.registerTexts(i18n, this.textsPrefix);
    }
    
    static INITIAL_COLUMN_WIDTH: number = 400;
    personsComponent: PersonsController;
    onModalClose: () => void;
    parent: app.WindowParent;
    leftSplitter: SplitterController;
    rightSplitter: SplitterController;
    modules: {[id: string]: ModuleController};
    activeModules: string[];
    splitters: SplitterController[] = [];
    constructor(parent: app.WindowParent, public session: Session, public section: SectionService, public loadSingleModule?: string, public mainWindowWidth?: number) {
        super(parent, __filename, __dirname, {
            isPublic: false,
            subs: {
                "splitter-0": {defaultValue: "50%"},
                "splitter-1": {defaultValue: "50%"},
                "chat-splitter-horizontal": {defaultValue: 170},
                "enter-sends": {defaultValue: true}
            }
        });
        this.addViewScript({path: "build/twemoji/twemoji/2/twemoji.min.js"});
        this.parent = parent;
        let windowWidth: number = 1200;
        if (loadSingleModule) {
            windowWidth = mainWindowWidth ? Math.round(mainWindowWidth * 65 / 100) : 500;
        }
        this.openWindowOptions = {
            modal: false,
            alwaysOnTop: false,
            showInactive: false,
            toolbar: false,
            maximized: false,
            maximizable: true,
            minimizable: true,
            show: false,
            minWidth: this.loadSingleModule ? 380 : 800,
            minHeight: 715,
            width: windowWidth,
            height: 715,
            resizable: true,
            title: this.getNameWithBreadcrumb(this.section),
            icon: ""
        };
        this.modules = {};
    }
    
    getModel(): Model {
        return {
            name: this.section ? this.section.getName() : "",
            activeModules: this.activeModules,
            singleMode: this.loadSingleModule != null
        };
    }
    
    getNameWithBreadcrumb(section: SectionService): string {
        let breadcrumb = "";
        if (section == null) {
            return "";
        }
        if (section.isUserGroup() && section.sectionData && section.sectionData.group && section.sectionData.group.users) {
            let customName = this.session.conv2Service.sectionManager.customSectionNames.getCustomSectionName(section);
            if (customName) {
                return customName;
            }
            let [myId, host] = this.session.userData.identity.hashmail.split("#");
            let people = section.sectionData.group.users
                .filter(x => x != myId)
                .map(x => this.session.conv2Service.personService.getPerson(x + "#" + host))
                .map(x => x.getName());
            return people.join(", ");
        }
        if (section.getParent() == null) {
            return section.getName();
        }
        let parents: SectionService[] = [];
        let lastParent = section.getParent();
        while (lastParent) {
          parents.unshift(lastParent);
          lastParent = lastParent.getParent();
        }
        parents.forEach(p => {
          breadcrumb += p.getName() + " / ";
        });
        return breadcrumb + section.getName();
    }
    
    registerModule(id: string, moduleController: ModuleController) {
        if (id in this.modules) {
            throw new Error("Already registered under id " + id);
        }

        if ((this.loadSingleModule && this.loadSingleModule == id) || (!this.loadSingleModule && id != "calendar") ) {
            this.modules[id] = this.addComponent("module-component-" + id, moduleController);
        }


    }
    
    init(): Q.IWhenable<void> {
        return Q().then(() => {
            return this.loadSettings();
        })
        .then(() => {
            this.personsComponent = this.addComponent("personsComponent", this.componentFactory.createComponent("persons", [this]));
            let promises: Q.Promise<void>[] = [];
            for (let id in this.modules) {
                promises.push(Q().then(() => {
                    return Q().then(() => {
                        if (this.modules[id].setSession) {
                            return this.modules[id].setSession(this.session);
                        }
                    })
                    .then(() => {
                        return this.modules[id].init ? this.modules[id].init() : null;
                    });
                }));
            }
            return Q.all(promises);
        })
        .then(() => {
            return this.setSection(this.section);
        })
        .then(() => {
            this.registerChangeEvent(this.section.manager.filteredCollection.changeEvent, event => {
                if (event.type == "remove" && event.element && event.element.getId() == this.section.getId()) {
                    this.close();
                }
            });
            this.callViewMethod("refreshAvatars");
            return;
        })
    }
    
    setSection(section: SectionService) {
        return Q().then(() => {
            this.activeModules = [];
            let promises: Q.Promise<void>[] = [];
            for (let id in this.modules) {
                promises.push(Q().then(() => {
                    return this.modules[id].setSection(section);
                })
                .then(success => {
                    if (success) {
                      this.activeModules.push(id);
                      return;
                    }
                }));
            }
            return Q.all(promises);
        })
        .then(() => {
            return this.initSplitters();
        })
        .then(() => {
            this.callViewMethod("refreshAvatars");
            return;
        })
    }

    initSplitters() {
        let activeCount = this.activeModules.length;
        let firstWidth = Math.round(Number(this.openWindowOptions.width) / activeCount);
        this.settings.subSettings["splitter-0"].currentValue = firstWidth.toString();
        let secondWidth = Math.round((Number(this.openWindowOptions.width) - firstWidth) / 2);
        this.settings.subSettings["splitter-1"].currentValue = secondWidth.toString();
        
        for (let x = 0; x < 2; x++) {
            let splitter = this.addComponent("splitter-" + x, this.componentFactory.createComponent("splitter", [this, this.settings.create("splitter-" + x)]));
            this.splitters.push(splitter);
        }
    }
    
    onViewOpen(): void {
    }
    
    onViewLoad(): void {
    }
    
    onViewClose(): void {
        this.close();
    }
    
    showModal(onModalClose: () => void) {
        this.onModalClose = onModalClose;
        this.open();
        this.nwin.focus();
    }
    
    
    onViewDontShowAgain(): void {
    }
    
    
    
    onViewOk() {
        if (this.onModalClose) {
            this.onModalClose();
            this.close();
        }
    }
    
}
