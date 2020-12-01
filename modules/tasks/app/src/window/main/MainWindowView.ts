import * as web from "pmc-web";
import * as mail from "pmc-mail";
import { func as mainTemplate } from "./template/main.html";

export class MainWindowView extends web.window.base.BaseAppWindowView<void> {
    
    constructor(parent: web.Types.app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    openIframe(id: number, load: mail.Types.app.WindowLoadOptions): void {
        let iframe = web.Starter.registerDockedWindow(id, load, this.$mainContainer[0]);
        iframe.setAttribute("id", "iframe-" + id);
    }
    
}
