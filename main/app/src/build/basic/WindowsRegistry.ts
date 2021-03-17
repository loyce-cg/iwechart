import {MsgBoxWindowView} from "../../window/msgbox/MsgBoxWindowView";
import {HelperWindowView} from "../../window/helper/HelperWindowView";
import {AboutWindowView} from "../../window/about/AboutWindowView";
import {SupportWindowView} from "../../window/support/SupportWindowView";
import {ControlCenterWindowView} from "../../window/controlcenter/ControlCenterWindowView";
import {ErrorWindowView} from "../../window/error/ErrorWindowView";
import {TextViewerWindowView} from "../../window/textviewer/TextViewerWindowView";
import { VideoConferenceInfoWindowView } from "../../window/videoconferenceinfo/VideoConferenceInfoWindowView";

export let registry: {className: string, clazz: {new(...args: any[]): any;}}[] = [
    {className: "com.privmx.core.window.msgbox.MsgBoxWindowView", clazz: MsgBoxWindowView},
    {className: "com.privmx.core.window.helper.HelperWindowView", clazz: HelperWindowView},
    {className: "com.privmx.core.window.about.AboutWindowView", clazz: AboutWindowView},
    {className: "com.privmx.core.window.support.SupportWindowView", clazz: SupportWindowView},
    {className: "com.privmx.core.window.controlcenter.ControlCenterWindowView", clazz: ControlCenterWindowView},
    {className: "com.privmx.core.window.error.ErrorWindowView", clazz: ErrorWindowView},
    {className: "com.privmx.core.window.textviewer.TextViewerWindowView", clazz: TextViewerWindowView},
    {className: "com.privmx.core.window.videoconferenceinfo.VideoConferenceInfoWindowView", clazz: VideoConferenceInfoWindowView},
];