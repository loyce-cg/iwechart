module.exports = function(extractPath, electronVersion, platform, arch, done) {
    if (platform == "linux") {
        const fs = require("fs");
        fs.copyFileSync("../../main/app/README", extractPath + "/README");
        fs.copyFileSync("../../main/app/src/icons/app-icon.png", extractPath + "/resources/app-icon.png");
        //fs.copyFileSync("../../main/privfs-mail-client/app/privmx.desktop", extractPath + "/resources/privmx.desktop");
    }
    done();
};
