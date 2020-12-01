import * as privfs from "privfs-client";
import {section} from "../../Types";
import * as Q from "q";

export class SectionApi {
    lastKnownSectionsLimit: number;
    lastKnownSectionCount: number;
    lastKnownSectionLimitUpdatedTimestamp: number;

    constructor(public gateway: privfs.gateway.RpcGateway) {
        privfs.core.ApiErrorCodes.codes["SECTION_DOESNT_EXIST"] = {code: 0x0061, message: "Section doesn't exist"};
        privfs.core.ApiErrorCodes.codes["SECTION_ALREADY_EXISTS"] = {code: 0x0062, message: "Section already exists"};
        privfs.core.ApiErrorCodes.codes["INVALID_VERSION"] = {code: 0x0063, message: "Invalid version"};
    }
    
    sectionGet(id: section.SectionId): Q.Promise<section.SectionData> {
        return this.gateway.request("sectionGet", {id: id});
    }
    
    sectionsGet(): Q.Promise<section.SectionData[]> {
        return this.gateway.request("sectionsGetEx", {})
        .then((res: {count: number, limit: number, sections: section.SectionData[]} ) => {
            return res.sections;
        });
    }
    
    sectionsGetAll(): Q.Promise<section.SectionData[]> {
        return this.gateway.request("sectionsGetAllEx", {})
        .then((res: {count: number, limit: number, sections: section.SectionData[]} ) => {
            return res.sections;
        });

    }

    sectionsGetEx(): Q.Promise<{count: number, limit: number, sections: section.SectionData[]}> {
        return this.gateway.request("sectionsGetEx", {})
        .then(res => {
            return res;
        })
    }
    
    sectionsGetAllEx(): Q.Promise<{count: number, limit: number, sections: section.SectionData[]}> {
        return this.gateway.request("sectionsGetAllEx", {})
        .then(res => {
            return res;
        })
    }


    _refreshSectionsCountAndLimits(): Q.Promise<void> {
        return Q().then(() => {
            let currentTime = new Date().getTime();
            return this.sectionsGetEx().then(res => {
                this.lastKnownSectionLimitUpdatedTimestamp = currentTime;
                this.lastKnownSectionCount = res.count;
                this.lastKnownSectionsLimit = res.limit;
            })
        })
    }

    isSectionsLimitReached(): Q.Promise<boolean> {
        return this.sectionsGetEx().then(res => res.limit != -1 && res.limit <= res.count);
    }    

    sectionCreate(section: section.SectionCreateModel): Q.Promise<section.SectionData> {
        let params: section.SectionCreateModel = {
            id: section.id,
            data: section.data,
            keyId: section.keyId,
            group: {
                type: section.group.type,
                users: section.group.users
            },
            state: section.state,
            acl: {
                createSubsections: section.acl.createSubsections,
                manage: section.acl.manage
            },
            primary: section.primary,
        };
        if (section.parentId) {
            params.parentId = section.parentId;
        }
        if (section.group.id) {
            params.group.id = section.group.id;
        }
        return this.gateway.request("sectionCreate", params);
    }
    
    sectionUpdate(section: section.SectionUpdateModel): Q.Promise<section.SectionData> {
        let params: section.SectionUpdateModel = {
            id: section.id,
            data: section.data,
            version: section.version,
            keyId: section.keyId,
            group: {
                type: section.group.type,
                users: section.group.users
            },
            state: section.state,
            acl: {
                createSubsections: section.acl.createSubsections,
                manage: section.acl.manage
            },
            primary: section.primary
        };
        if (section.parentId) {
            params.parentId = section.parentId;
        }
        return this.gateway.request("sectionUpdate", params);
    }
}