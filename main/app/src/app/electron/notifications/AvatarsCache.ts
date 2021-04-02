import { ElectronApplication } from "../ElectronApplication";
import { NativeImage } from "electron";
import * as path from "path";
import { AvatarWithVersion, Person } from "../../../mail/person/Person";
import { NotificationsService } from "./NotificationsService";

export class AvatarsCache {
    private static BASE_NOTIFICATION_ICON: string = "base-notification-icon";
    nativeImagesMap: {[id: string]: NativeImage} = {};

    constructor(public app: ElectronApplication) {
        this.nativeImagesMap[AvatarsCache.BASE_NOTIFICATION_ICON] = this.app.getAvatarFromDataUrl(path.resolve(this.app.getResourcesPath(), "dist/icons", NotificationsService.BASE_NOTIF_ICON));
    }

    getByPerson(person: Person): NativeImage {
        let avatarWithVersion = person.getAvatarWithVersion();
        const mapId = person.getHashmail() + "-" + avatarWithVersion.revision;
        if (! this.nativeImagesMap[mapId]) {
            this.nativeImagesMap[mapId] = this.app.getAvatarFromDataUrl(avatarWithVersion.avatar);
        }
        return this.nativeImagesMap[mapId];
    }

    getByPath(path: string): NativeImage {
        if (! this.nativeImagesMap[path]) {
            this.nativeImagesMap[path] = this.app.getAvatarFromPath(path, 72);
        }
        return this.nativeImagesMap[path]; 
    }

    getFromBaseNotificationIcon(): NativeImage {
        return this.nativeImagesMap[AvatarsCache.BASE_NOTIFICATION_ICON];
    }
}