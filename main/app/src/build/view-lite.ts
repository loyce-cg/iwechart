import {TemplateManager} from "../web-utils/template/Manager";
import {Template} from "../web-utils/template/Template";
import * as $ from "jquery";
import {MomentService} from "../mail/MomentService";
import {BasicViewHelper} from "../web-utils/BasicViewHelper";
import {AvatarGenerator} from "../web-utils/AvatarGenerator";
require("../web-utils/JQueryExt");

export {
    AvatarGenerator,
    TemplateManager,
    Template,
    $,
    MomentService,
    BasicViewHelper as ViewHelper
}