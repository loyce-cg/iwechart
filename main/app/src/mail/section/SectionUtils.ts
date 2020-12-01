import * as privfs from "privfs-client";
import {section} from "../../Types";
import {MultiProvider} from "../../utils/Utils"
import {SectionService} from "./SectionService";
import { Lang } from "../../utils/Lang";

export class SectionUtils {
    
    static PUBLIC_KEY_ID = "public";
    static ADMINS_GROUP = "<admins>";
    static LOCAL_USERS_GROUP = "<local>";
    
    static GROUP_TYPE_ADMIN = "admin";
    static GROUP_TYPE_ALL_LOCAL_USERS = "local";
    static GROUP_TYPE_SELECTED_USERS = "usernames";
    
    static isGroupTypePublic(groupType: string): boolean {
        return groupType == SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS;
    }
    
    static hasUsersGroup(list: string[], group: string): boolean {
        return list.indexOf(group) > -1;
    }
    
    static hasAnyPublicUsersGroupsIn(groups: string[]): boolean {
        let hasPublicGroups: boolean = false;
        let availPublicGroups = SectionUtils.getPredefinedGroups(undefined, true);
        groups.forEach(x => {
            if (availPublicGroups.indexOf(x) > -1) {
                hasPublicGroups = true;
                return;
            }
        });
        return hasPublicGroups;
    }
    
    static getAclForGroup(groupId: string): privfs.types.descriptor.DescriptorAcl {
        return groupId == null ? null : {
            manage: "group:" + groupId,
            read: "group:" + groupId,
            write: "group:" + groupId,
            delete: "group:" + groupId
        };
    }
    
    static getKvdbOptionsForGroup(groupId: string): privfs.types.db.KeyValueDbOptions {
        return groupId == null ? {} : {
            acl: {
                manage: "group:" + groupId,
                read: "group:" + groupId,
                write: "group:" + groupId
            }
        };
    }
    
    static getPrivateSectionId(username: string) {
        return "private:" + username;
    }
    
    static serializeAcl(acl: section.SectionAcl): section.SectionRawAcl {
        return {
            createSubsections: SectionUtils.serializeAclEntry(acl.createSubsections) ,
            manage: SectionUtils.serializeAclEntry(acl.manage)
        };
    }
    
    static deserializeAcl(acl: section.SectionRawAcl): section.SectionAcl {
        return {
            createSubsections: SectionUtils.deserializeAclEntry(acl.createSubsections) ,
            manage: SectionUtils.deserializeAclEntry(acl.manage)
        };
    }
    
    static serializeAclEntry(aclEntry: section.AclEntry): string {
        let res = aclEntry.admins || aclEntry.users.indexOf(SectionUtils.ADMINS_GROUP) > -1 ? "<admin>" : "";
        aclEntry.all || aclEntry.users.indexOf(SectionUtils.LOCAL_USERS_GROUP) > -1 ? res += (res ? "|" : "") + SectionUtils.LOCAL_USERS_GROUP : "";
        aclEntry.users.filter(x => x != SectionUtils.ADMINS_GROUP && x != SectionUtils.LOCAL_USERS_GROUP).forEach(user => {
            res += (res ? "|" : "") + user;
        });
        return res;
    }
    
    static deserializeAclEntry(raw: string): section.AclEntry {
        let res: section.AclEntry = {admins: false, all: false, users: []};
        let users: string[] = [];
        raw.split("|").forEach(x => {
            if (x == "<admin>") {
                res.admins = true;
                users.push(SectionUtils.ADMINS_GROUP);
            }
            else
            if (x == SectionUtils.LOCAL_USERS_GROUP) {
                res.all = true;
                users.push(SectionUtils.LOCAL_USERS_GROUP);
            }
            else if (x) {
                users.push(x);
            }
        });
        res.users = Lang.unique(users);
        return res;
    }
    
    static getPredefinedGroups(rights?: string[], publicGroups?: boolean): string[] {
        let groups: {id: string, right: string, publicGroup: boolean}[] = [
            {id: SectionUtils.ADMINS_GROUP, right: "normal", publicGroup: false},
            {id: SectionUtils.LOCAL_USERS_GROUP, right: "normal", publicGroup: true},
            // {id: "<basic>", right: "normal", public: true}
        ]
        return groups.map( x => {
            return ((rights && rights.indexOf(x.right) > -1) || !rights) && ( (publicGroups && x.publicGroup == publicGroups) || !publicGroups ) ? x.id : null;
        });
    }
    
    static getProperGroupType(groups: string[]): string {
        let groupType: string = SectionUtils.GROUP_TYPE_SELECTED_USERS;
        if (SectionUtils.hasUsersGroup(groups, SectionUtils.LOCAL_USERS_GROUP)) {
            groupType = SectionUtils.GROUP_TYPE_ALL_LOCAL_USERS;
        }
        else
        if (SectionUtils.hasUsersGroup(groups, SectionUtils.ADMINS_GROUP)) {
            groupType = SectionUtils.GROUP_TYPE_ADMIN;
        }
        return groupType;
    }
    
    static filterUsers(list: string[]): string[] {
        return Lang.unique(list.filter(x => x && x.indexOf("<") == -1 && x.indexOf(">") == -1));
    }

    static isConversationId(id: string): boolean {
        let key: string = "usergroup:";
        return id.indexOf(key) == 0 && id.length > key.length; 
    }
}

export interface SectionProvider {
    getSection(sectionId: section.SectionId): SectionService;
}

export class MultiSectionProvider extends MultiProvider<section.SectionId, SectionService, SectionProvider> implements SectionProvider {
    
    sectionProviders: SectionProvider[];
    
    constructor() {
        super((provider, sectionId) => provider.getSection(sectionId));
    }
    
    getSection(sectionId: section.SectionId): SectionService {
        return this.getValue(sectionId);
    }
}