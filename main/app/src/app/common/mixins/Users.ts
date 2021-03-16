import { ManagableUserCreator, CreateManagableUserResult } from "../../../mail/admin/userCreation/ManagableUserCreator";
import { AdminAddUserWindowController } from "../../../window/adminadduser/AdminAddUserWindowController";
import { CommonApplication } from "..";

export class Users {
    private managableUserCreator: ManagableUserCreator;
    
    constructor(private app: CommonApplication) {

    }

    public async createUser(usernamePostfixStart: number, usernamePostfixEnd: number, isAdmin: boolean = false): Promise<void> {
        const session = this.app.sessionManager.getLocalSession();
        this.managableUserCreator = await session.mailClientApi.privmxRegistry.getManagableUserCreator();

        let usersCredentials: CreateManagableUserResult[] = [];
        for (let i = usernamePostfixStart; i <= usernamePostfixEnd; i++) {
            const username = "user" + i;
            const email = "user" + i + "@privmx.com";
            const {context, job} = await this.managableUserCreator.createNormalUser({
                username: username,
                host: session.host,
                language: this.app.localeService.currentLang,
                email: email,
                description: "",
                admin: isAdmin,
                shareCommonKvdb: AdminAddUserWindowController.SHARE_COMMON_KVDB_KEY
            });
            usersCredentials.push(context);
        }
        usersCredentials.forEach(u => console.log(u.username, u.password));
    }
}