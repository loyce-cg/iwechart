import * as privfs from "privfs-client";
import {Lang} from "../../utils/Lang";
import {ImageTypeDetector} from "../../utils/ImageTypeDetector";
import {mail} from "../../Types";

export class IdentityProfile {
    
    constructor(
        public profileProvider: mail.ProfileProvider,
        public sinkProvider: mail.SinkProvider
    ) {
    }
    
    buildUserInfoProfile(): privfs.types.core.UserInfoProfile {
        let userInfoProfile: privfs.types.core.UserInfoProfile = {};
        userInfoProfile.sinks = this.sinkProvider.getInboxes().concat([]);
        let profile = this.profileProvider.getProfile();
        if (profile) {
            userInfoProfile.name = Lang.getTrimmedString(profile.name) || undefined;
            userInfoProfile.description = Lang.getTrimmedString(profile.description) || undefined;
            let img = profile.image;
            userInfoProfile.image = img ? ImageTypeDetector.extractBufferFromDatatUrl(img) : undefined
        }
        return userInfoProfile;
    }
}