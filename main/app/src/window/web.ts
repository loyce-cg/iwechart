import * as about from "./about/web";
import * as admin from "./admin/web";
import * as adminadduser from "./adminadduser/web";
import * as adminaddexternaluser from "./adminaddexternaluser/web";
import * as adminedituser from "./adminedituser/web";
import * as audio from "./audio/web";
import * as base from "./base/web";
import * as changepassword from "./changepassword/web";
import * as clearcache from "./clearcache/web";
import * as compose from "./compose/web";
import * as container from "./container/web";
import * as download from "./download/web";
import * as downloadattachment from "./downloadattachment/web";
import * as editor from "./editor/web";
import * as emailinfo from "./emailinfo/web";
import * as emailpassword from "./emailpassword/web";
import * as empty from "./empty/web";
import * as helper from "./helper/web";
import * as playerhelper from "./playerhelper/web";
import * as image from "./image/web";
import * as login from "./login/web";
import * as message from "./message/web";
import * as msgbox from "./msgbox/web";
import * as sectionpicker from "./sectionpicker/web";
import * as secureformdev from "./secureformdev/web";
import * as selectcontacts from "./selectcontacts/web";
import * as settings from "./settings/web";
import * as source from "./source/web";
import * as subid from "./subid/web";
import * as taskchooser from "./taskchooser/web";
import * as unsupported from "./unsupported/web";
import * as url from "./url/web";
import * as verifydomain from "./verifydomain/web";
import * as video from "./video/web";
import * as sections from "./sections/web";
import * as sectionnew from "./sectionnew/web";
import * as sectionsummary from "./sectionsummary/web";
import * as fonts from "./fonts/web";
import * as imageeditor from "./imageeditor/web";
import * as notifications from "./notifications/web";
import * as openexternal from "./openexternal/web";
import * as pdf from "./pdf/web";
import * as sectionedit from "./sectionedit/web";
import * as update from "./update/web";
import * as licence from "./licence/web";
import * as licensevendors from "./licensevendors/web";
import * as mindmapeditor from "./mindmapeditor/web";
import * as controlcenter from "./controlcenter/web";
import * as support from "./support/web";
import * as error from "./error/web";
import * as textviewer from "./error/web";
import * as switchvoicechatconfirm from "./switchvoicechatconfirm/web";
import * as videorecorder from "./videorecorder/web";
import * as deviceselector from "./deviceselector/web";
import * as devconsole from "./devconsole/web";
import * as videoconferenceinfo from "./videoconferenceinfo/web";
import * as uploadservice from "./uploadservice/web";

// base 1.8MB (jquery and other base libs)
// ComposeWindowView - includes 100KB typeahed
// LoginWindowView - includes 100KB PasswordStrengthMeter (shared with settings)
// SecureFormDevWindowView - includes 700KB highlight.js for syntax highlight

export {
    about,
    admin,
    adminadduser,
    adminaddexternaluser,
    adminedituser,
    audio,
    base,
    changepassword,
    clearcache,
    compose,
    container,
    download,
    downloadattachment,
    editor,
    emailinfo,
    emailpassword,
    empty,
    helper,
    playerhelper,
    image,
    login,
    message,
    msgbox,
    sectionpicker,
    secureformdev,
    selectcontacts,
    settings,
    source,
    subid,
    taskchooser,
    unsupported,
    url,
    verifydomain,
    video,
    sections,
    sectionnew,
    sectionsummary,
    fonts,
    imageeditor,
    notifications,
    openexternal,
    pdf,
    sectionedit,
    update,
    licence,
    licensevendors,
    controlcenter,
    support,
    error,
    textviewer,
    mindmapeditor,
    switchvoicechatconfirm,
    videorecorder,
    deviceselector,
    devconsole,
    videoconferenceinfo,
    uploadservice
};
