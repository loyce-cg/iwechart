import {BaseView} from "../BaseView";
import {func as mainTemplate} from "./template/main.html";
import {func as profilePreviewTemplate} from "./template/profile-preview.html";
import {SettingsWindowView} from "../SettingsWindowView";
import {Model} from "./PublicProfileController";
import {Profile} from "../../../mail/UserPreferences";
import {ImageLoader} from "../../../web-utils/ImageLoader";
import {Lang} from "../../../utils/Lang";

export class PublicProfileView extends BaseView<Model> {
    
    static readonly PROFILE_IMAGE_MAX_WIDTH: number = 200;
    static readonly PROFILE_IMAGE_MAX_HEIGHT: number = 200;
    
    hashmail: string;
    profile: Profile;
    testMode: boolean;
    loginExternal: string;
    savedImage: string = null;
    
    constructor(parent: SettingsWindowView) {
        super(parent, mainTemplate);
        this.menuModel = {
            id: "publicProfile",
            priority: 100,
            groupId: "account",
            icon: "vcard-o",
            labelKey: "window.settings.menu.item.publicProfile.label"
        };
    }
    
    initTab() {
        this.$main.on("click", "[data-trigger=upload-image]", this.onUploadProfileImage.bind(this));
        this.$main.on("click", "[data-trigger=new-photo]", this.onNewPhotoClick.bind(this));
        this.$main.on("click", "[data-trigger=remove-image]", this.onRemoveProfileImage.bind(this));
        this.$main.on("input", "[name='profile.name']", this.onProfileNameInput.bind(this));
        this.$main.on("input", "[name='profile.description']", this.onProfilDescriptionInput.bind(this));
    }
    
    afterRenderContent(model: Model): Q.IWhenable<void> {
        this.hashmail = model.hashmail;
        this.profile = model.profile;
        this.testMode = model.testMode;
        this.loginExternal = model.loginExternal;
        if (!this.profile.name) {
            this.profile.name = this.getProperName();
        }
        this.savedImage = this.profile.image;
        this.renderProfileImage();
        this.renderPreview();
    }
    
    renderProfileImage(): void {
        let $section = this.$main.find(".section");
        let $image = $section.find(".image-preview");
        let $input = $section.find("input[name='profile.image']");
        let $removeButton = $section.find("[data-trigger=remove-image]");
        if (this.profile.image) {
            $image.attr("src", this.profile.image).show();
            $removeButton.show();
            $input.val(this.profile.image);
        }
        else {
            $image.attr("src", "").hide();
            $removeButton.hide();
            $input.val("");
        }
        this.updateDirty();
    }
    
    renderPreview(): void {
        let html = this.templateManager.createTemplate(profilePreviewTemplate).renderToJQ(this.profile);
        this.$main.find(".section .profile-preview-container").content(html);
    }
    
    onUploadProfileImage(): void {
        let imageLoader = new ImageLoader();
        imageLoader.testMode = this.testMode;
        imageLoader.max = {
            width: PublicProfileView.PROFILE_IMAGE_MAX_WIDTH,
            height: PublicProfileView.PROFILE_IMAGE_MAX_HEIGHT,
        };
        imageLoader.onLoad = this.onLoadProfileImage.bind(this);
        imageLoader.start();
    }
    
    onNewPhotoClick(): void {
        this.triggerEvent("newPhoto");
    }
    
    onLoadProfileImage(dataUrl: string): void {
        this.profile.image = dataUrl;
        this.renderProfileImage();
        this.renderPreview();
    }
    
    async usePhoto(dataUrl: string): Promise<void> {
        const scaledDataUrl = await this._scaleProfileImage(dataUrl);
        this.onLoadProfileImage(scaledDataUrl);
    }
    
    private async _scaleProfileImage(dataUrl: string): Promise<string> {
        const img = document.createElement("img");
        const imgLoadPromise = new Promise<void>(resolve => {
            img.onload = () => { resolve(); };
        });
        img.src = dataUrl;
        await imgLoadPromise;
        
        const origWidth = img.naturalWidth;
        const origHeight = img.naturalHeight;
        const { width: targetWidth, height: targetHeight } = this._getTargetProfileImageSize(origWidth, origHeight);
        
        const cnv = document.createElement("canvas");
        const ctx = cnv.getContext("2d");
        cnv.width = targetWidth;
        cnv.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        return cnv.toDataURL("image/png", 1.0);
    }
    
    private _getTargetProfileImageSize(origWidth: number, origHeight: number): { width: number, height: number } {
        const maxWidth = PublicProfileView.PROFILE_IMAGE_MAX_WIDTH;
        const maxHeight = PublicProfileView.PROFILE_IMAGE_MAX_HEIGHT;
        
        if (origWidth <= maxWidth && origHeight <= maxHeight) {
            return {
                width: origWidth,
                height: origHeight,
            };
        }
        
        const overwidthRatio = origWidth / maxWidth;
        const overheightRatio = origHeight / maxHeight;
        const scale: number = 1.0 / Math.max(overwidthRatio, overheightRatio);
        
        return {
            width: origWidth * scale,
            height: origHeight * scale,
        };
    }
    
    onRemoveProfileImage(): void {
        this.profile.image = "";
        this.renderProfileImage();
        this.renderPreview();
    }
    
    onProfileNameInput(): void {
        this.profile.name = Lang.getTrimmedString(<string>this.$main.find("[name='profile.name']").val()) || this.getProperName();
        this.renderPreview();
    }
    
    onProfilDescriptionInput(): void {
        this.profile.description = Lang.getTrimmedString(<string>this.$main.find("[name='profile.description']").val());
        this.renderPreview();
    }
    
    getProperName(): string {
        return this.loginExternal || this.hashmail.split("#")[0];
    }
    
    isDirty(): boolean {
        if (this.savedImage != this.profile.image) {
            return true;
        }
        return super.isDirty();
    }
    
    clearSaveButtonState(): void {
        this.savedImage = this.profile.image;
        super.clearSaveButtonState();
    }
    
}
