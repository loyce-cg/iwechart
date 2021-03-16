import * as Q from "q";
import {app} from "../Types";
import * as RootLogger from "simplito-logger";
let Logger = RootLogger.get("privfs-mail-client.webUtils.AvatarService");

export interface Options {
    width: number;
    height: number;
    autoSize?: boolean;
}

export interface PersonProvider {
    getPersonAvatarByHashmail(hashmail: string): app.PersonAvatar;
}

export interface AssetsProvider {
    getAssetByName(url: string): string;
}

export class AvatarService {
    
    personProvider: PersonProvider;
    assetsProvider: AssetsProvider;
    map: {[name: string]: Info};
    defaultInfo: {[name: string]: Info};
    
    constructor(personProvider: PersonProvider, assetsProvider: AssetsProvider) {
        this.personProvider = personProvider;
        this.assetsProvider = assetsProvider;
        this.map = {};
        this.defaultInfo = {};
    }
    
    draw(canvas: HTMLCanvasElement, hashmail: string, options: Options, forceDraw: boolean): void {
        let info = this.getInfoSync(hashmail);
        if (info) {
            try {
                info.image.drawToWithRevision(canvas, options, info.revision, forceDraw);
                return;
            }
            catch (e) {
                Logger.error("AvatarService error", e);
            }
        }
        
        Q().then(() => {
            return this.getInfo(hashmail);
        })
        .then(info => {
            canvas.classList.toggle("default-avatar", info.isDefaultAvatar);
            return info.image.drawToWithRevision(canvas, options, info.revision, forceDraw);
        })
        .fail(e => {
            Logger.error("AvatarService error", e);
        });
    }
    
    getInfoSync(hashmail: string): Info {
        let person = this.personProvider.getPersonAvatarByHashmail(hashmail);
        let info = this.map[hashmail];
        if (info != null && info.revision == person.avatar.revision && info.image) {
            return info;
        }
        return null;
    }
    
    getInfo(hashmail: string): Q.Promise<Info> {
        return Q().then(() => {
            let person = this.personProvider.getPersonAvatarByHashmail(hashmail);

            let info = this.map[hashmail];
            if (info && info.revision == person.avatar.revision) {
                return info.whenReady();
            }
            info = new Info(person.avatar.revision);
            this.map[hashmail] = info;
            info.isDefaultAvatar = !person.avatar.avatar;
            return Q().then(() => {
                return person.avatar.avatar ? this.createImageFromDataUrl(person.avatar.avatar)
                    : this.getDefaultImage(this.assetsProvider.getAssetByName(
                        person.isEmail ? "DEFAULT_EMAIL_AVATAR_INVERSE" : "DEFAULT_USER_AVATAR"));
            })
            .then(image => {
                info.setImage(image);
                return info;
            });
        });
    }
    
    createImageFromDataUrl(dataUrl: string): Q.Promise<Image> {
        let img = document.createElement("img");
        img.src = dataUrl;
        return this.getImageData(img);
    }
    
    getDefaultImage(src: string): Q.Promise<Image> {
        return Q().then(() => {
            if (src in this.defaultInfo) {
                return this.defaultInfo[src].whenReady();
            }
            let defaultInfo = new Info();
            return Q().then(() => {
                let img = document.createElement("img");
                img.src = src;
                return this.getImageData(img);
            })
            .then(image => {
                defaultInfo.setImage(image);
                this.defaultInfo[src] = defaultInfo;
                return defaultInfo;
            });
        })
        .then(() => {
            return this.defaultInfo[src].image;
        });
    }
    
    getImageData(img: HTMLImageElement): Q.Promise<Image> {
        let defer = Q.defer<Image>();
        img.onload = () => {
            defer.resolve(new Image(img));
        };
        return defer.promise;
    }
}

export class Info {
    
    revision: string;
    image: Image;
    defer: Q.Deferred<Info>;
    isDefaultAvatar: boolean;
    
    constructor(revision?: string) {
        this.revision = revision;
        this.defer = Q.defer();
    }
    
    whenReady(): Q.Promise<Info> {
        return this.defer.promise;
    }
    
    setImage(image: Image): void {
        this.image = image;
        this.defer.resolve(this);
    }
}

interface CanvasInfo {
    canvas: HTMLCanvasElement|HTMLImageElement;
    ctx?: CanvasRenderingContext2D;
}

interface CanvasInfo2 {
    canvas: HTMLCanvasElement;
    ctx?: CanvasRenderingContext2D;
}

export interface CanvasResult {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}

export class Image {
    
    image: HTMLImageElement;
    sizes: {[size: string]: {width: number, height: number, imageData: ImageData}};
    highDpi: boolean;
    
    constructor(image: HTMLImageElement, highDpi: boolean = true) {
        this.image = image;
        this.sizes = {};
        this.highDpi = highDpi;
    }
    
    drawToWithRevision(canvas: HTMLCanvasElement, options: Options, revision: string, forceDraw: boolean) {
        const revisionStr = revision + "-" + options.width + "x" + options.height + "-as" + (!!options.autoSize) + "-hdpi" + this.highDpi;
        if (!forceDraw && revisionStr == canvas.getAttribute("revision")) {
            return;
        }
        this.drawTo(canvas, options)
        canvas.setAttribute("revision", revisionStr);
    }
    
    drawTo(canvas: HTMLCanvasElement, options: Options) {
        let ctx = canvas.getContext("2d");
        if (this.highDpi) {
            options = {
                width: options.width * 2,
                height: options.height * 2,
                autoSize: options.autoSize
            };
        }
        let key = options.width + "x" + options.height;
        let resized = this.sizes[key];
        if (resized == null) {
            let targetWidth = options.width;
            let targetHeight = options.height;
            if (this.image.naturalWidth > this.image.naturalHeight) {
                targetHeight = targetWidth / this.image.naturalWidth * this.image.naturalHeight;
            }
            else {
                targetWidth = targetHeight / this.image.naturalHeight * this.image.naturalWidth;
            }
            let info = targetWidth >= this.image.naturalWidth ? Image.scaleImage(this.image, targetWidth, targetHeight) :
                Image.downScaleCanvas(Image.convertImageToCanvas(this.image), targetWidth / this.image.naturalWidth);
            if (options.autoSize) {
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                ctx.drawImage(info.canvas, 0, 0, info.width, info.height, 0, 0, targetWidth, targetHeight);
            }
            else {
                canvas.width = options.width;
                canvas.height = options.height;
                ctx.drawImage(info.canvas, 0, 0, info.width, info.height, (canvas.width - targetWidth) / 2, (canvas.height - targetHeight) / 2, targetWidth, targetHeight);
            }
            this.sizes[key] = {
                width: canvas.width,
                height: canvas.height,
                imageData: ctx.getImageData(0, 0, canvas.width, canvas.height)
            };
            if (this.highDpi) {
                canvas.style.width = (canvas.width / 2) + "px";
                canvas.style.height = (canvas.height / 2) + "px";
            }
        }
        else {
            canvas.width = resized.width;
            canvas.height = resized.height;
            ctx.putImageData(resized.imageData, 0, 0);
            if (this.highDpi) {
                canvas.style.width = (canvas.width / 2) + "px";
                canvas.style.height = (canvas.height / 2) + "px";
            }
        }
    }
    
    static scaleImage(image: HTMLImageElement, targetWidth: number, targetHeight: number): CanvasResult {
        let tmp: CanvasInfo2[] = [];
        tmp[0] = {canvas: document.createElement("canvas")};
        tmp[0].canvas.width = image.naturalWidth;
        tmp[0].canvas.height = image.naturalHeight;
        tmp[0].ctx = tmp[0].canvas.getContext("2d");
        tmp[1] = {canvas: document.createElement("canvas")};
        tmp[1].canvas.width = image.naturalWidth;
        tmp[1].canvas.height = image.naturalHeight;
        tmp[1].ctx = tmp[1].canvas.getContext("2d");
        let width = image.naturalWidth;
        let height = image.naturalHeight;
        let lastWidth = width;
        let lastHeight = height;
        let source: CanvasInfo = {canvas: image};
        let dest = tmp[0];
        let i = 0;
        while (true) {
            dest.ctx.clearRect(0, 0, dest.canvas.width, dest.canvas.height);
            dest.ctx.drawImage(source.canvas, 0, 0, lastWidth, lastHeight, 0, 0, width, height);
            lastWidth = width;
            lastHeight = height;
            width *= 0.5;
            height *= 0.5;
            if (width < targetWidth || height < targetHeight) {
                break;
            }
            source = tmp[i % 2];
            dest = tmp[(i + 1) % 2];
            i++;
        }
        return {
            canvas: dest.canvas,
            width: lastWidth,
            height: lastHeight
        };
    }
    
    static convertImageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
        let canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        let ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
    
    static downScaleCanvas(cv: HTMLCanvasElement, scale: number): CanvasResult {
        if (!(scale < 1) || !(scale > 0)) throw ('scale must be a positive number <1 ');
        var sqScale = scale * scale; // square scale = area of source pixel within target
        var sw = cv.width; // source image width
        var sh = cv.height; // source image height
        var tw = Math.ceil(sw * scale); // target image width
        var th = Math.ceil(sh * scale); // target image height
        var sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
        var tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
        var tX = 0, tY = 0; // rounded tx, ty
        var w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
        // weight is weight of current source point within target.
        // next weight is weight of current source point within next target's point.
        var crossX = false; // does scaled px cross its current px right border ?
        var crossY = false; // does scaled px cross its current px bottom border ?
        var sBuffer = cv.getContext('2d').
        getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
        var tBuffer = new Float32Array(4 * sw * sh); // target buffer Float32 rgb
        var sR = 0, sG = 0,  sB = 0; // source's current point r,g,b
        // untested !
        var sA = 0;  //source alpha
        
        for (sy = 0; sy < sh; sy++) {
            ty = sy * scale; // y src position within target
            tY = 0 | ty;     // rounded : target pixel's y
            yIndex = 4 * tY * tw;  // line index within target array
            crossY = (tY != (0 | ty + scale));
            if (crossY) { // if pixel is crossing botton target pixel
                wy = (tY + 1 - ty); // weight of point within target pixel
                nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
            }
            for (sx = 0; sx < sw; sx++, sIndex += 4) {
                tx = sx * scale; // x src position within target
                tX = 0 |  tx;    // rounded : target pixel's x
                tIndex = yIndex + tX * 4; // target pixel index within target array
                crossX = (tX != (0 | tx + scale));
                if (crossX) { // if pixel is crossing target pixel's right
                    wx = (tX + 1 - tx); // weight of point within target pixel
                    nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
                }
                sR = sBuffer[sIndex    ];   // retrieving r,g,b for curr src px.
                sG = sBuffer[sIndex + 1];
                sB = sBuffer[sIndex + 2];
                sA = sBuffer[sIndex + 3];
                
                if (!crossX && !crossY) { // pixel does not cross
                    // just add components weighted by squared scale.
                    tBuffer[tIndex    ] += sR * sqScale;
                    tBuffer[tIndex + 1] += sG * sqScale;
                    tBuffer[tIndex + 2] += sB * sqScale;
                    tBuffer[tIndex + 3] += sA * sqScale;
                } else if (crossX && !crossY) { // cross on X only
                    w = wx * scale;
                    // add weighted component for current px
                    tBuffer[tIndex    ] += sR * w;
                    tBuffer[tIndex + 1] += sG * w;
                    tBuffer[tIndex + 2] += sB * w;
                    tBuffer[tIndex + 3] += sA * w;
                    // add weighted component for next (tX+1) px
                    nw = nwx * scale
                    tBuffer[tIndex + 4] += sR * nw; // not 3
                    tBuffer[tIndex + 5] += sG * nw; // not 4
                    tBuffer[tIndex + 6] += sB * nw; // not 5
                    tBuffer[tIndex + 7] += sA * nw; // not 6
                } else if (crossY && !crossX) { // cross on Y only
                    w = wy * scale;
                    // add weighted component for current px
                    tBuffer[tIndex    ] += sR * w;
                    tBuffer[tIndex + 1] += sG * w;
                    tBuffer[tIndex + 2] += sB * w;
                    tBuffer[tIndex + 3] += sA * w;
                    // add weighted component for next (tY+1) px
                    nw = nwy * scale
                    tBuffer[tIndex + 4 * tw    ] += sR * nw; // *4, not 3
                    tBuffer[tIndex + 4 * tw + 1] += sG * nw; // *4, not 3
                    tBuffer[tIndex + 4 * tw + 2] += sB * nw; // *4, not 3
                    tBuffer[tIndex + 4 * tw + 3] += sA * nw; // *4, not 3
                } else { // crosses both x and y : four target points involved
                    // add weighted component for current px
                    w = wx * wy;
                    tBuffer[tIndex    ] += sR * w;
                    tBuffer[tIndex + 1] += sG * w;
                    tBuffer[tIndex + 2] += sB * w;
                    tBuffer[tIndex + 3] += sA * w;
                    // for tX + 1; tY px
                    nw = nwx * wy;
                    tBuffer[tIndex + 4] += sR * nw; // same for x
                    tBuffer[tIndex + 5] += sG * nw;
                    tBuffer[tIndex + 6] += sB * nw;
                    tBuffer[tIndex + 7] += sA * nw;
                    // for tX ; tY + 1 px
                    nw = wx * nwy;
                    tBuffer[tIndex + 4 * tw    ] += sR * nw; // same for mul
                    tBuffer[tIndex + 4 * tw + 1] += sG * nw;
                    tBuffer[tIndex + 4 * tw + 2] += sB * nw;
                    tBuffer[tIndex + 4 * tw + 3] += sA * nw;
                    // for tX + 1 ; tY +1 px
                    nw = nwx * nwy;
                    tBuffer[tIndex + 4 * tw + 4] += sR * nw; // same for both x and y
                    tBuffer[tIndex + 4 * tw + 5] += sG * nw;
                    tBuffer[tIndex + 4 * tw + 6] += sB * nw;
                    tBuffer[tIndex + 4 * tw + 7] += sA * nw;
                }
            } // end for sx
        } // end for sy

        // create result canvas
        var resCV = document.createElement('canvas');
        resCV.width = tw;
        resCV.height = th;
        var resCtx = resCV.getContext('2d');
        var imgRes = resCtx.getImageData(0, 0, tw, th);
        var tByteBuffer = imgRes.data;
        // convert float32 array into a UInt8Clamped Array
        var pxIndex = 0; //
        for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 4, tIndex += 4, pxIndex++) {
            tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
            tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
            tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
            tByteBuffer[tIndex + 3] = Math.ceil(tBuffer[sIndex + 3]);
        }
        // writing result to canvas.
        resCtx.putImageData(imgRes, 0, 0);
        return {
            canvas: resCV,
            width: tw,
            height: th
        };
    }
}
