import {Q, privfs} from "pmc-mail";

export interface TwofaEnableData {
    type: string;
    googleAuthenticatorKey: string;
    email: string;
    mobile: string;
}

export interface TwofaData extends TwofaEnableData {
    enabled: boolean;
}

export interface TwofaResult {
    methods: string[];
    data: TwofaData;
}


export interface EnableResult {
    attempts: number;
}

export class TwofaApi {
    
    static TWOFA_NOT_ENABLED = 0x7001;
    static TWOFA_INVALID_TYPE = 0x7002;
    static TWOFA_CODE_ALREADY_RESEND = 0x7003;
    static TWOFA_INVALID_GOOLGE_AUTHENTICATOR_SECRET = 0x7004;
    static TWOFA_EMAIL_REQUIRED = 0x7005;
    static TWOFA_MOBILE_REQUIRED = 0x7006;
    static TWOFA_INVALID_CODE = 0x7007;
    static TWOFA_VERIFICATION_FAILED = 0x7008;
    
    constructor(public gateway: privfs.gateway.RpcGateway) {
    }
    
    getData(): Q.Promise<TwofaResult> {
        return this.gateway.request("twofaGetData", {});
    }
    
    disable(): Q.Promise<TwofaData> {
        return this.gateway.request("twofaDisable", {});
    }
    
    enable(data: TwofaEnableData): Q.Promise<EnableResult>  {
        return this.gateway.request("twofaEnable", {data: data});
    }
    
    challenge(code: string, rememberDeviceId: boolean): Q.Promise<void>  {
        return this.gateway.request("twofaChallenge", {code: code, rememberDeviceId: rememberDeviceId})
    }
    
    resendCode(): Q.Promise<void>  {
        return this.gateway.request("twofaResendCode", {})
    }
}