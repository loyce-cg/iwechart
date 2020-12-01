import * as Web from "pmc-web";
import * as Mail from "pmc-mail";

export class EditorViewHelper extends Web.webUtils.MailClientViewHelper {
    
    constructor(framework: Web.webUtils.template.TemplateManager, model: Mail.Types.app.MailClientViewHelperModel) {
        super(framework, model);
    }
    
    getAvailableNotesStyles(): {[name: string]: string} {
        return {
            'default': 'Default',
            'terminal': 'Terminal',
            'black-on-white': 'Black on white',
            'white-on-black': 'White on black',
            'papyrus': 'Papyrus'
        };
    }
}