import { MsgBoxOptions, MsgBoxResult } from "../msgbox/MsgBoxWindowController";
import { CommonApplication } from "../../app/common/CommonApplication";
import { BaseWindowController } from "../base/BaseWindowController";
import * as Q from "q";

export type ConfirmType = "add-proxy" | "modify-proxy";

export class WindowUtils {
    static CONFIRM_ADD_PROXY: ConfirmType = "add-proxy";
    static CONFIRM_MODIFY_PROXY: ConfirmType = "modify-proxy";

    static getConfirm(app: CommonApplication, parentWindow: BaseWindowController, confirmType: ConfirmType) {
        let message = confirmType == WindowUtils.CONFIRM_ADD_PROXY ? "window.admin.userExternalAdd.addProxy" : "window.admin.userExternalAdd.modifyProxy";
        let confirmOptions: MsgBoxOptions = {
            width: 400,
            height: 140,
            title: parentWindow.i18n("window.admin.userExternalAdd.proxyConfirmTitle"),
            message: parentWindow.i18n(message),
            //info: entry.tree.shared ? this.i18n("plugin.notes2.component.filesList.actions.delete-shared.info") : "",
            yes: {
                label: parentWindow.i18n("core.button.ok.label"),
                btnClass: "btn-success",
            },
            no: {
                btnClass: "btn-default",
                label: parentWindow.i18n("core.button.cancel.label")
            }
        };

        let confirmDeferred: Q.Deferred<MsgBoxResult> = null;
        let confirm = () => {
            if (confirmDeferred == null) {
                confirmDeferred = Q.defer();
                parentWindow.confirmEx(confirmOptions).then(res => {
                    if (res.result == "yes") {
                        confirmDeferred.resolve();
                    }
                });
            }
            return confirmDeferred.promise;
        };
        return confirm();
    }
    
    static getErrorNoLocalProxy(parentWindow: BaseWindowController) {
        return parentWindow.alert(parentWindow.i18n("window.admin.userExternalAdd.error.proxy.no-local-proxy"));
    }

    static getErrorNoRemoteProxy(parentWindow: BaseWindowController) {
        return parentWindow.alert(parentWindow.i18n("window.admin.userExternalAdd.error.proxy.no-remote-proxy"));
    }

    static getErrorNoUser(parentWindow: BaseWindowController) {
        return parentWindow.alert(parentWindow.i18n("window.admin.userExternalAdd.error.proxy.no-user"));
    }

}