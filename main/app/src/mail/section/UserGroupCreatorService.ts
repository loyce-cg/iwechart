import * as privfs from "privfs-client";
import { LocaleService } from "../../mail";
import { ContactService } from "../../mail/contact/ContactService";
import { PersonService } from "../../mail/person/PersonService";
import { Conv2Service } from "../../mail/section/Conv2Service";

export class UserGroupCreatorService {
    
    constructor(
        private contactService: ContactService,
        private personService: PersonService,
        private localeService: LocaleService,
        private conv2Service: Conv2Service,
        private identity: privfs.identity.Identity
    ) {
    }
    
    async createSectionWithUser(username: string) {
        await this.contactService.getContactsDb();
        const sectionService = await this.conv2Service.createUserGroup([this.identity.user, username]);
        await sectionService.sendMessage({text: this.localeService.i18n("core.createuser.admin_message")});
        await this.personService.synchronizeWithUsernames();
    }
}