import {subidentity} from "../../Types";

export interface SubidentyPrivDataEx2 extends subidentity.SubidentyPrivDataEx {
    sectionName: string;
}
export type SubidentitiesPriv2 = {[pub: string]: SubidentyPrivDataEx2};

export interface IUserService {
    getSubidentities(): Q.Promise<SubidentitiesPriv2>;
    removeSubidentity(pub58: string): Q.Promise<void>;
}
