import { FontMetricsView } from "../../app/common/fontMetrics/FontMetricsView";
import { EllipsisOptions, EllipsisSplitResult, LineBreak, Session, SimpleTextSpan } from "./Types";
import { TextSpan } from "./TextSpan";
import { AfterFirstLineStrategy } from "./strategies/AfterFirstLineStrategy";
import { WithoutEllipsisStrategy } from "./strategies/WithoutEllipsisStrategy";

export class Ellipsis {
    
    private session: Session | null = null;
    
    constructor(private options: EllipsisOptions) {
    }
    
    reset(): void {
        this.session = null;
    }
    
    apply($container: JQuery, simpleTextSpans: SimpleTextSpan[]): void {
        // Prepare
        const text = simpleTextSpans.map(simpleTextSpan => simpleTextSpan.text).join("");
        this.prepareContainer($container);
        this.ensureInitializedFromSampleEmptyContainer($container);
        this.prepareText(text);
        
        // Compute and apply ellipsis
        const textSpans: TextSpan[] = this.createTextsFromTextSpans(simpleTextSpans);
        const splitResult: EllipsisSplitResult = this.performEllipsisSplit(textSpans);
        const resultHtml: string = this.getHtmlFromEllipsisSplitResult(splitResult);
        $container.html(resultHtml);
    }
    
    private prepareContainer($container: JQuery): void {
        $container.css({
            fontKerning: "none",
            textRendering: "optimizeSpeed",
            wordBreak: "normal",
            whiteSpace: "pre",
        });
        $container.empty();
    }
    
    private ensureInitializedFromSampleEmptyContainer($sampleEmptyContainer: JQuery) {
        if (this.session === null) {
            this.initFromSampleEmptyContainer($sampleEmptyContainer);
        }
    }
    
    private initFromSampleEmptyContainer($sampleEmptyContainer: JQuery) {
        const style = window.getComputedStyle($sampleEmptyContainer[0]);
        const maxLines: number = parseInt($sampleEmptyContainer.data("max-lines"));
        this.session = {
            fontMetrics: new FontMetricsView(),
            maxLineWidth: 0,
            maxLines: 0,
            wordBreakOptions: this.options.wordBreak,
        };
        this.session.fontMetrics.setFontFromComputedStyle(style);
        this.session.fontMetrics.add(" …");
        this.session.maxLineWidth = parseFloat(style.width);
        this.session.maxLines = !isNaN(maxLines) ? maxLines : Math.floor(parseFloat(style.height) / parseFloat(style.lineHeight));
    }
    
    private prepareText(text: string): void {
        this.session.fontMetrics.add(text);
        this.session.fontMetrics.measure();
    }
    
    private createTextsFromTextSpans(textSpans: SimpleTextSpan[]): TextSpan[] {
        const texts: TextSpan[] = [];
        for (let textSpan of textSpans) {
            texts.push(new TextSpan(textSpan, this.session));
        }
        return texts;
    }
    
    private performEllipsisSplit(textSpans: TextSpan[]): EllipsisSplitResult {
        const Strategies = [
            WithoutEllipsisStrategy,
            AfterFirstLineStrategy,
        ];
        for (let Strategy of Strategies) {
            const strategy = new Strategy(this.session);
            const result = strategy.performEllipsisSplit(textSpans);
            if (result !== null) {
                return result;
            }
        }
        return {
            prefix: textSpans,
            middle: [],
            suffix: [],
        };
    }
    
    private getHtmlFromEllipsisSplitResult(ellipsisSplitResult: EllipsisSplitResult): string {
        const { suffix, middle: removedMiddle, prefix } = ellipsisSplitResult;
        if (removedMiddle.length === 0 && suffix.length === 0) {
            return this.convertTextSpansToHtml(prefix);
        }
        const prefixStr = `<span class="prefix">${this.convertTextSpansToHtml(prefix)}</span>`;
        const dotsStr = `<span class="dots">…</span>`;
        const middleStr = `<span class="removed-middle">${this.convertTextSpansToHtml(removedMiddle)}</span>`;
        const suffixStr = `<span class="suffix">${this.convertTextSpansToHtml(suffix)}</span>`;
        return `${prefixStr}${middleStr}${dotsStr}${suffixStr}`;
    }
    
    private convertTextSpansToHtml(textSpans: TextSpan[]): string {
        return textSpans
            .map(textSpan => textSpan.getHtml())
            .join("");
    }
    
}
