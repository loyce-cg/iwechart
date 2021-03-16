import * as autorefresh from "./autorefresh/main";
import * as base from "./base/main";
import * as channel from "./channel/main";
import * as conv2list from "./conv2list/main";
import * as conversationlist from "./conversationlist/main";
import * as customelementlist from "./customelementlist/main";
import * as customizationeditor from "./customizationeditor/main";
import * as editorbuttons from "./editorbuttons/main";
import * as extlist from "./extlist/main";
import * as emojipicker from "./emojipicker/main";
import * as emojiviewbar from "./emojiviewbar/main";
import * as exttable from "./exttable/main";
import * as mindmap from "./mindmapeditor/Mindmap";
import * as mindmapeditor from "./mindmapeditor/main";
import * as navbar from "./navbar/main";
import * as persons from "./persons/main";
import * as playercontrols from "./playercontrols/main";
import * as slider from "./slider/main";
import * as sectionlist from "./sectionlist/main";
import * as remotesectionlist from "./remotesectionlist/main";
import * as remotehostlist from "./remotehostlist/main";
import * as remoteconv2list from "./remoteconv2list/main";
import * as sectionstabs from "./sectionstabs/main";
import * as sidebar from "./sidebar/main";
import * as splitter from "./splitter/main";
import * as statusbar from "./statusbar/main";
import * as statusbarmain from "./statusbarmain/main";
import * as tooltip from "./tooltip/main";
import * as tasktooltip from "./tasktooltip/main";
import * as filetooltip from "./filetooltip/main";
import * as titletooltip from "./titletooltip/main";
import * as sectiontooltip from "./sectiontooltip/main";
import * as userslisttooltip from "./userslisttooltip/main";
import * as notification from "./notification/main";
import * as updatenotification from "./updatenotification/main";
import * as disabledsection from "./disabledsection/main";
import * as taskchooser from "./taskchooser/main";
import * as encryptioneffect from "./encryptioneffect/main";
import * as userguide from "./userguide/main";
import * as tree from "./tree/main";
import * as loading from "./loading/main";
import * as thumbs from "./thumbs/main";
import * as voicechatcontrols from "./voicechatcontrols/main";
import * as audioplayer from "./audioplayer/main";
import * as customselect from "./customselect/main";
import {app} from "../Types";
import {BaseAppWindowController} from "../window/base/BaseAppWindowController";
import {BaseCollection} from "../utils/collection/BaseCollection";
import {Settings} from "../utils/Settings";
import {SyncTaskStream} from "../task/SyncTaskStream";
import {MultiTaskStream} from "../task/MultiTaskStream";
import { CommonApplication } from "../app/common";
import { Session, SessionManager } from "../mail/session/SessionManager";

interface ComponentFactory {
    //createComponent(componentName: string, args: any[]): any;
    createComponent<T, U>(componentName: "autorefresh", args: [app.IpcContainer, autorefresh.Options<T, U>]): autorefresh.AutoRefreshController<T, U>;
    createComponent(componentName: "progress", args: [base.ComponentController, number]): channel.ProgressController;
    createComponent(componentName: "conv2list", args: [app.IpcContainer, conv2list.Conv2ListOptions]): conv2list.Conv2ListController;
    createComponent(componentName: "conversationlist", args: [app.IpcContainer, string]): conversationlist.ConversationListController;
    createComponent(componentName: "customelementlist", args: [app.IpcContainer, customelementlist.CustomElementListOptions]): customelementlist.CustomElementListController;
    createComponent(componentName: "customizationeditor", args: [app.IpcContainer, customizationeditor.CustomizationEditorOptions]): customizationeditor.CustomizationEditorController;
    createComponent(componentName: "editorbuttons", args: [editorbuttons.EditorButtonsParent]): editorbuttons.EditorButtonsController;
    createComponent<T>(componentName: "extlist", args: [app.IpcContainer, BaseCollection<T>]): extlist.ExtListController<T>;
    createComponent<T>(componentName: "exttable", args: [app.IpcContainer, exttable.Column[], BaseCollection<T>]): exttable.ExtTableController<T>;
    createComponent(componentName: "mindmapeditor", args: [BaseAppWindowController, CommonApplication, mindmapeditor.Options]): mindmapeditor.MindmapEditorController;
    createComponent(componentName: "navbar", args: [BaseAppWindowController]): navbar.NavBarController;
    createComponent(componentName: "notification", args: [app.IpcContainer]): notification.NotificationController;
    createComponent(componentName: "persons", args: [app.IpcContainer]): persons.PersonsController;
    createComponent(componentName: "playercontrols", args: [app.IpcContainer, boolean]): playercontrols.PlayerControlsController;
    createComponent(componentName: "slider", args: [app.IpcContainer, slider.SliderOptions]): slider.SliderController;
    createComponent(componentName: "sectionlist", args: [app.IpcContainer, sectionlist.SectionListOptions]): sectionlist.SectionListController;
    createComponent(componentName: "remotesectionlist", args: [app.IpcContainer, remotesectionlist.RemoteSectionListOptions]): remotesectionlist.RemoteSectionListController;
    createComponent(componentName: "remotehostlist", args: [app.IpcContainer, remotehostlist.RemoteHostListControllerOptions]): remotehostlist.RemoteHostListController;
    createComponent(componentName: "remoteconv2list", args: [app.IpcContainer, remoteconv2list.RemoteConv2ListOptions]): remoteconv2list.RemoteConv2ListController;
    createComponent(componentName: "sectionstabs", args: [app.IpcContainer, sectionstabs.Options]): sectionstabs.SectionsTabsController;
    createComponent(componentName: "sidebar", args: [app.IpcContainer, sidebar.SidebarOptions]): sidebar.SidebarController;
    createComponent(componentName: "splitter", args: [app.IpcContainer, Settings]): splitter.SplitterController;
    createComponent(componentName: "statusbar", args: [app.IpcContainer, SyncTaskStream]): statusbar.StatusBarController;
    createComponent(componentName: "statusbarmain", args: [app.IpcContainer, MultiTaskStream]): statusbarmain.StatusBarMainController;
    createComponent(componentName: "tooltip", args: [app.IpcContainer]): tooltip.TooltipController;
    createComponent(componentName: "tasktooltip", args: [app.IpcContainer]): tasktooltip.TaskTooltipController;
    createComponent(componentName: "filetooltip", args: [app.IpcContainer]): filetooltip.FileTooltipController;
    createComponent(componentName: "titletooltip", args: [app.IpcContainer]): titletooltip.TitleTooltipController;
    createComponent(componentName: "sectiontooltip", args: [app.IpcContainer]): sectiontooltip.SectionTooltipController;
    createComponent(componentName: "userslisttooltip", args: [app.IpcContainer]): userslisttooltip.UsersListTooltipController;    
    createComponent(componentName: "emojipicker", args: [app.IpcContainer]): emojipicker.EmojiPickerController;
    createComponent(componentName: "emojiviewbar", args: [app.IpcContainer]): emojiviewbar.EmojiViewBarController;
    createComponent(componentName: "updatenotification", args: [app.IpcContainer]): updatenotification.UpdateNotificationController;
    createComponent(componentName: "disabledsection", args: [app.IpcContainer, string]): disabledsection.DisabledSectionController;
    createComponent(componentName: "taskchooser", args: [app.IpcContainer, CommonApplication, taskchooser.TaskChooserOptions]): taskchooser.TaskChooserController;
    createComponent(componentName: "encryptioneffect", args: [app.IpcContainer]): encryptioneffect.EncryptionEffectController;
    createComponent(componentName: "userguide", args: [app.IpcContainer, userguide.UserGuideOptions]): userguide.UserGuideController;
    createComponent<T extends tree.BaseType>(componentName: "tree", args: [app.IpcContainer, string, BaseCollection<T>, () => string]): tree.TreeController<T>;
    createComponent(componentName: "loading", args: [app.IpcContainer]): loading.LoadingController;
    createComponent(componentName: "thumbs", args: [app.IpcContainer, CommonApplication, thumbs.ThumbsOptions]): thumbs.ThumbsController;
    createComponent(componentName: "voicechatcontrols", args: [app.IpcContainer, CommonApplication]): voicechatcontrols.VoiceChatControlsController;
    createComponent(componentName: "audioplayer", args: [app.IpcContainer, CommonApplication]): audioplayer.AudioPlayerController;
    createComponent(componentName: "customselect", args: [app.IpcContainer, customselect.CustomSelectOptions]): customselect.CustomSelectController;
}

export {
    ComponentFactory,
    autorefresh,
    base,
    conv2list,
    conversationlist,
    channel,
    customelementlist,
    customizationeditor,
    editorbuttons,
    extlist,
    exttable,
    mindmap,
    mindmapeditor,
    navbar,
    persons,
    playercontrols,
    slider,
    sectionlist,
    remotesectionlist,
    remotehostlist,
    remoteconv2list,
    sidebar,
    splitter,
    statusbar,
    statusbarmain,
    notification,
    tree,
    tooltip,
    tasktooltip,
    filetooltip,
    titletooltip,
    sectiontooltip,
    userslisttooltip,
    sectionstabs,
    emojipicker,
    emojiviewbar,
    updatenotification,
    disabledsection,
    taskchooser,
    encryptioneffect,
    userguide,
    loading,
    thumbs,
    voicechatcontrols,
    audioplayer,
    customselect,
}