export namespace user {
    export type ApplicationCode = string;
}
export namespace company {
    export type CompanyName = string;
}
export namespace server {
    export type ServerPrefix = string;
    export type RegistrationToken = string;
}
export namespace core {
    export type Url = string;
    export type OK = boolean;
    export type Email = string;
}

export namespace api {
    export namespace auth {
        export interface RegisterByAppCode {
            applicationCode: user.ApplicationCode;
            companyName: company.CompanyName;
            prefix: server.ServerPrefix;
        }
        
        export interface RegisterByAppCodeResult {
            registrationLink: core.Url;
            registrationToken: server.RegistrationToken;
        }

        export interface ControlCenterTokenResult {
            email: string;
            url: string;
        }

        export interface ServerInfoResult {
            url: string;
            sign: string;
            timestamp: number;
        }
    }
}

