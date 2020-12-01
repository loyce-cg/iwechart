import { app, mail, Types } from "pmc-mail";
import { i18n } from "../i18n/index";


export interface UpdateAppsSpinnersEvent extends Types.event.Event {
    type: "update-apps-spinners";
    state: boolean;
    sectionId?: string;
    moduleName?: string;
}
export class AppsPlugin {
    
    sectionsWithSpinner: { [id: string]: boolean } = {};
    pluginsWithSpinner: { [id: string]: boolean } = {};
    
    constructor(public app: app.common.CommonApplication) {
        this.app.addEventListener<Types.event.SetBubblesState>("set-bubbles-state", e => {
            let newState = e.markingAsRead;
            let id = e.scope.sectionId || "__all__";
            let moduleName = e.scope.moduleName || "__all__";
            this.sectionsWithSpinner[id] = newState;
            this.pluginsWithSpinner[moduleName] = newState;
            this.app.dispatchEvent<UpdateAppsSpinnersEvent>({
                type: "update-apps-spinners",
                state: e.markingAsRead,
                sectionId: e.scope.sectionId || undefined,
                moduleName: moduleName || undefined,
            });
        }, "apps", "ethernal");
    }
    
    registerTexts(localeService: mail.LocaleService): void {
        localeService.registerTexts(i18n, "plugin.apps.");
    }
    
    reset(): void {
        this.sectionsWithSpinner = {};
        this.pluginsWithSpinner = {};
    }
    
}
