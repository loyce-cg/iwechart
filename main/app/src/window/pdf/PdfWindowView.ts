import {WindowView} from "../base/BaseWindowView";
import {func as mainTemplate} from "./template/main.html";
import {app} from "../../Types";
import * as $ from "jquery";
import * as PDFJS from "pdfjs-dist";
import * as RootLogger from "simplito-logger";
import Q = require("q");
import {EditorWindowView} from "../editor/EditorWindowView";
let Logger = RootLogger.get("privfs-mail-client.window.pdf.PdfWindowView");

declare var pdfjsLib: typeof PDFJS;

@WindowView
export class PdfWindowView extends EditorWindowView {
    
    currentViewId: number;
    pdfDocument: PDFJS.PDFDocumentProxy;
    $pdfContainer: JQuery;
    isLoading: boolean = false;
    loadedPages: number = 0;
    onWindowResizeDelay: any = null;
    pdfOpenDeferred: Q.Deferred<void> = Q.defer();
    forPrint: boolean = false;
    currentDataUrl: string;
    pagesDimensions: { width: number, height: number }[] = [];
    intersectionObserver: IntersectionObserver = null;
    
    constructor(parent: app.ViewParent) {
        super(parent, mainTemplate);
    }
    
    onInitWindow(): void {
        this.$pdfContainer = this.$main.find(".pdf-container");
        this.$pdfContainer.on("scroll", this.onPdfScroll.bind(this));
        this.clearState(true);
        $(window).on("resize", this.onWindowResize.bind(this));
    }
    
    clearState(addLoading: boolean) {
        this.pdfDocument = null;
        this.isLoading = false;
        this.loadedPages = 0;
        this.$main.find(".pdf-container canvas").remove();
        super.clearState(addLoading);
    }
    
    onPdfScroll() {
        if (this.isLoading) {
            return;
        }
        this.restartQualityFixTimer();
    }
    
    showPage(currentViewId: number, pageNum: number, redraw: boolean = false, doneDef: Q.Deferred<void> = null) {
        if (window == null || currentViewId != this.currentViewId) {
            return;
        }
        if (!this.pdfDocument) {
            return;
        }
        if (this.pdfDocument.numPages < pageNum) {
            return;
        }
        if (!redraw && this.$pdfContainer.find("[data-canvas-id='"+pageNum+"']").length) {
            return;
        }
        
        this.isLoading = true;
        let $canvas = this.$pdfContainer.find("canvas[data-canvas-id='" + pageNum + "']");
        if ($canvas.length == 0) {
            this.loadedPages++;
            $canvas = $("<canvas class='pdf-canvas' data-canvas-id='"+this.loadedPages+"'></canvas>");
            this.$pdfContainer.append($canvas);
        }
        else if ($canvas.hasClass("placeholder")) {
            $canvas.removeClass("placeholder");
        }
        return this.pdfDocument.getPage(pageNum).then(page => {
            if (currentViewId != this.currentViewId) {
                return;
            }
            
            let vw = page.getViewport(1.0).width;
            let scale = this.calcScale(vw, this.$pdfContainer.innerWidth());
            let canvas: HTMLCanvasElement = <HTMLCanvasElement>$canvas.get(0);
            let context = canvas.getContext("2d");
            let viewport = page.getViewport(scale);
            let $tmpCanvas = $("<canvas></canvas>");
            let tmpCanvas = <HTMLCanvasElement>$tmpCanvas.get(0);
            let tmpContext = tmpCanvas.getContext("2d");
            $canvas.data("pdf-scale", scale);
            $canvas.data("pdf-vw", vw);
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            tmpCanvas.width = viewport.width;
            tmpCanvas.height = viewport.height;
            let renderContext = {
              canvasContext: tmpContext,
              viewport: viewport
            };
            page.render(renderContext).promise.then(() => {
                context.drawImage(tmpCanvas, 0, 0);
                if (doneDef) {
                    doneDef.resolve();
                }
            });
            this.isLoading = false;
        })
    }
    
    setDataCore(currentViewId: number, data: app.BlobData) {
        if (window == null || currentViewId != this.currentViewId) {
            return;
        }
        let task: PDFJS.PDFLoadingTask<PDFJS.PDFDocumentProxy> = pdfjsLib.getDocument(this.getResourceDataUrl(data));
        task.promise.then(pdfDocument => {
            this.pdfDocument = pdfDocument;
            if (pdfDocument.numPages == 0) {
                return;
            }
            this.clearLoading();
            if (!this.printMode) {
                this.makeCustomScroll(this.$pdfContainer);
            }
            this.pdfOpenDeferred.resolve();
            return this.loadPagesDimensions().then(() => {
                if (this.intersectionObserver) {
                    this.intersectionObserver.disconnect();
                }
                this.intersectionObserver = new IntersectionObserver(this.onIntersectionChange.bind(this), {
                    root: this.$pdfContainer[0],
                });
                this.createPlaceholders();
            });
        })
        .then(() => {}, e => {
            Logger.error("Error during loading pdf", e);
        });
    }
    
    calcScale(vw: number, containerWidth: number) {
        return (vw > 0 ? Math.max(containerWidth / vw, 0.5) : 1.0) * (this.forPrint ? 2.0 : 1.0);
    }
    
    getVisibleOrClosePages(onlyBadQuality: boolean = false, qualityRefWidth: number = 841.8): number[] {
        let closeMargin = 750;
        let areaTop = -closeMargin;
        let areaBottom = closeMargin + this.$pdfContainer[0].getBoundingClientRect().height;
        let visiblePages: number[] = [];
        this.$pdfContainer.find("canvas.pdf-canvas").each((_, canvas) => {
            let $canvas = $(canvas);
            if (onlyBadQuality) {
                let canvasScale = Number($canvas.data("pdf-scale"));
                let canvasVw = Number($canvas.data("pdf-vw"));
                let desiredScale = this.calcScale(canvasVw, qualityRefWidth);
                if (desiredScale / canvasScale < 1.1) {
                    return;
                }
            }
            let canvasTop = $canvas.offset().top;
            let canvasBottom = canvasTop + $canvas.height();
            if (areaTop <= canvasBottom && areaBottom >= canvasTop) {
                visiblePages.push(Number($canvas.data("canvas-id")));
            }
        });
        return visiblePages;
    }
    
    ensureVisibleCanvasesQuality(): void {
        this.getVisibleOrClosePages(true, this.$pdfContainer.width()).forEach(canvasId => {
            this.showPage(this.currentViewId, canvasId, true);
        });
    }
    
    onWindowResize(): void {
        this.restartQualityFixTimer();
    }
    
    restartQualityFixTimer(): void {
        if (this.onWindowResizeDelay !== null) {
            clearTimeout(this.onWindowResizeDelay);
        }
        this.onWindowResizeDelay = setTimeout(() => {
            this.ensureVisibleCanvasesQuality();
            this.onWindowResizeDelay = null;
        }, 100);
    }
    
    prepareToPrint(): void {
        this.forPrint = true;
        this.showAll().then(() => {
            setTimeout(() => {
                this.triggerEvent("preparedToPrint");
            }, 1000);
        });
    }
    
    showAll(): Q.Promise<void> {
        return this.pdfOpenDeferred.promise
        .then(() => {
            let promises: Q.Promise<void>[] = [];
            for (let i = 1; i <= this.pdfDocument.numPages; ++i) {
                let def = Q.defer<void>();
                let prom = this.showPage(this.currentViewId, i, true, def);
                if (prom) {
                    promises.push(def.promise);
                }
            }
            return Q.all(promises).thenResolve(null);
        });
    }
    
    loadPagesDimensions(): Q.Promise<void> {
        let prom = Q();
        for (let i = 1; i <= this.pdfDocument.numPages; ++i) {
            prom = prom.then(() => {
                let def = Q.defer<void>();
                this.pdfDocument.getPage(i).then(page => {
                    let v = page.getViewport(1.0);
                    this.pagesDimensions[i] = {
                        width: v.width,
                        height: v.height,
                    };
                    def.resolve();
                });
                return def.promise;
            });
        }
        return prom;
    }
    
    createPlaceholders(): void {
        for (let i = 1; i <= this.pdfDocument.numPages; ++i) {
            let scale = this.calcScale(this.pagesDimensions[i].width, this.$pdfContainer.innerWidth());
            let w = this.pagesDimensions[i].width * scale;
            let h = this.pagesDimensions[i].height * scale;
            let $canvas = this.$pdfContainer.find("canvas[data-canvas-id='" + i + "']");
            if ($canvas.length == 0) {
                $canvas = $("<canvas class='pdf-canvas placeholder' data-canvas-id='" + i + "' width='" + w + "' height='" + h + "'></canvas>");
                this.$pdfContainer.append($canvas);
            }
            this.intersectionObserver.observe($canvas[0]);
        }
    }
    
    onIntersectionChange(entries: IntersectionObserverEntry[]): void {
        for (let entry of entries) {
            if (entry.isIntersecting) {
                let $canvas = $(entry.target);
                if ($canvas.hasClass("placeholder")) {
                    let pageId = $canvas.data("canvas-id");
                    this.showPage(this.currentViewId, pageId, true);
                }
            }
        }
    }
    
}
