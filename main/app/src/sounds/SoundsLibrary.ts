export type SoundsCategoryName = "notification" | "screenshot" | "unreadBadgeClick";

export interface SoundsCategory {
    name: SoundsCategoryName;
    defaultSound: string;
}

export interface Sound {
    fileName: string;
    i18nKey: string;
    categories: SoundsCategoryName[];
}

export class SoundsLibrary {
    
    categories: SoundsCategory[] = [
        { name: "notification", defaultSound: "sound1.wav" },
        { name: "unreadBadgeClick", defaultSound: "sound2.wav" },
        // { name: "screenshot", defaultSound: "screenshot.mp3" },
    ];
    sounds: Sound[] = [
        // { fileName: "message-deleted.wav", i18nKey: "messageDeleted", categories: ["notification", "screenshot"] },
        // { fileName: "message-sent.wav", i18nKey: "messageSent", categories: ["notification", "screenshot"] },
        // { fileName: "new-messages.wav", i18nKey: "newMessages", categories: ["notification"] },
        // { fileName: "screenshot.mp3", i18nKey: "screenshot", categories: ["screenshot"] },
        { fileName: "sound1.wav", i18nKey: "sound1", categories: ["notification"] },
        { fileName: "sound2.wav", i18nKey: "sound2", categories: ["notification", "unreadBadgeClick"] },
        { fileName: "sound3.wav", i18nKey: "sound3", categories: ["notification"] },
        { fileName: "sound4.wav", i18nKey: "sound4", categories: ["notification"] },
        { fileName: "sound5.wav", i18nKey: "sound5", categories: ["notification"] },
    ];
    
    constructor() {
    }
    
    getSoundsByCategory(categoryName: SoundsCategoryName): Sound[] {
        return this.sounds.filter(x => x.categories.indexOf(categoryName) >= 0);
    }
    
    getDefaultSoundName(categoryName: SoundsCategoryName): string {
        return this.categories.filter(x => x.name == categoryName)[0].defaultSound;
    }
    
    getExistingSoundName(categoryName: SoundsCategoryName, soundName: string): string {
        let sound = this.sounds.filter(x => x.fileName == soundName)[0];
        if (sound && sound.categories.indexOf(categoryName) >= 0) {
            return soundName;
        }
        return this.getDefaultSoundName(categoryName);
    }
    
}
