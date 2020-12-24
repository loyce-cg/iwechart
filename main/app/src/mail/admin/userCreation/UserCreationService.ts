import { UserCreationParams, UserCreationContext } from "./Types";
import { UserCreationApi } from "./api/UserCreationApi";
import { AddUserModelBuilder } from "./api/AddUserModelBuilder";
import { UserCreationContextBuilder } from "./UserCreationContextBuilder";

export class UserCreationService {
    
    constructor(
        private userCreationContextBuilder: UserCreationContextBuilder,
        private addUserModelBuilder: AddUserModelBuilder,
        private userCreationApi: UserCreationApi
    ) {
    }
    
    async createUser(params: UserCreationParams): Promise<UserCreationContext> {
        const context = await this.userCreationContextBuilder.build(params);
        const model = this.addUserModelBuilder.build(context);
        await this.userCreationApi.addUserEx(model);
        return context;
    }
}
