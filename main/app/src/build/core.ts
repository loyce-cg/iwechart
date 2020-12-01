import * as app from "../app";
import * as component from "../component/main";
import * as mail from "../mail";
import * as service from "../service";
import * as utils from "../utils";
import * as window from "../window/main";
import * as Types from "../Types";
import * as TalkPage from "../pages/TalkPage";
import {WebApplication} from "../app/browser/WebApplication";
import * as Q from "q";
import Logger = require("simplito-logger");
import * as Utils from "simplito-utils";
import Promise = require("simplito-promise");
import PrivmxException = require("privmx-exception");
import * as privfs from "privfs-client";
import {SubidentityLoginService} from "../mail/subidentity/SubidentityLoginService";

export {
    //code
    app,
    component,
    mail,
    service,
    utils,
    window,
    Types,
    
    //apps
    TalkPage,
    WebApplication,
    SubidentityLoginService,
    
    //libs
    Q,
    Logger,
    Utils,
    Promise,
    PrivmxException,
    privfs
}
