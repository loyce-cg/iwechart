import * as window from "./window";
import {CommonApplication} from "./CommonApplication";
import {ErrorLog} from "./ErrorLog";
import {MsgBox} from "./MsgBox";
import {PluginManager} from "./PluginManager";
import {AssetsManager, AssetSpec, UrlAssetSpec, PathAssetSpec} from "./AssetsManager";
import {FileStyle, FileStyleResolver} from "./FileStyleResolver";
import { SearchFilter } from "./SearchFilter";
import { Router } from "./router/Router";
import * as shell from "./shell/ShellRegistry";
import * as shelltypes from "./shell/ShellTypes";
import * as clipboard from "./clipboard/Clipboard";
import * as voicechat from "./voicechat/VoiceChatService";
import * as videoconferences from "./videoconferences/VideoConferencesService";
import {ContextHistory, Context, IContext, ICreatorContext} from "./contexthistory";

export {
    AssetsManager,
    AssetSpec,
    UrlAssetSpec,
    PathAssetSpec,
    window,
    CommonApplication,
    ErrorLog,
    MsgBox,
    PluginManager,
    FileStyle,
    FileStyleResolver,
    SearchFilter,
    shell,
    shelltypes,
    clipboard,
    voicechat,
    videoconferences,
    ContextHistory,
    Context, IContext, ICreatorContext,
    Router
};