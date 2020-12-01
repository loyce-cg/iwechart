import {IUserService, SubidentitiesPriv2, SubidentyPrivDataEx2} from "../common/service/IUserService";
import * as Q from "q";
import {CommonApplication} from "../app/common/CommonApplication";
import {ApiMethod, ApiService} from "../utils/Decorators";
import {MailClientApi} from "../mail/MailClientApi";
import {SectionManager} from "../mail/section/SectionManager";
import {SubidentityService} from "../mail/subidentity/SubidentityService";

@ApiService
export class UserService implements IUserService {
    
    constructor(public app: CommonApplication) {
    }
    
    getMailClientApi(): MailClientApi {
        if (this.app.mailClientApi == null) {
            throw new Error("MailClientApi is null");
        }
        return this.app.mailClientApi;
    }
    
    getSubidentityService(): Q.Promise<SubidentityService> {
        return this.getMailClientApi().privmxRegistry.getSubidentityService();
    }
    
    getSectionManager(): Q.Promise<SectionManager> {
        return this.getMailClientApi().privmxRegistry.getSectionManager();
    }
    
    @ApiMethod
    getSubidentities(): Q.Promise<SubidentitiesPriv2> {
        return Q().then(() => {
            return this.getSubidentityService();
        })
        .then(ss => {
            return Q.all([
                ss.getSubidentities(),
                this.getSectionManager()
            ]);
        })
        .then(r => {
            let [subIds, sectionManager] = r;
            let res: SubidentitiesPriv2 = {};
            for (let pub in subIds) {
                res[pub] = <SubidentyPrivDataEx2>subIds[pub];
                let section = sectionManager.getSection(res[pub].sectionId);
                res[pub].sectionName = section ? section.getName() : null;
            }
            return res;
        });
    }
    
    @ApiMethod
    removeSubidentity(pub58: string): Q.Promise<void> {
        return Q().then(() => {
            return this.getSubidentityService();
        })
        .then(ss => {
            return ss.removeSubidentity(pub58);
        });
    }
}