export class ProxyUtils {
    static deserializeAcl(acl: string): string[] {
        let ret: string[] = [];
        if (acl.length > 0) {
            if (acl.indexOf("|") > -1) {
                ret = acl.split("|");
            }
            else {
                ret = [acl];
            }
        }
        return ret;
    }
}