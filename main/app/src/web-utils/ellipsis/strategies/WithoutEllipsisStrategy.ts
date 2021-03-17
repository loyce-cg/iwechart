import { LineBreaker } from "../LineBreaker";
import { TextSpan } from "../TextSpan";
import { EllipsisSplitResult } from "../Types";
import { EllipsisStrategy } from "./EllipsisStrategy";

export class WithoutEllipsisStrategy extends EllipsisStrategy {
    
    performEllipsisSplit(textSpans: TextSpan[]): EllipsisSplitResult | null {
        const lineBreaker = new LineBreaker(textSpans, this.session.maxLineWidth);
        const possibleLineBreaks = [
            lineBreaker.breakIntoLines(false),
            lineBreaker.breakIntoLines(true),
        ];
        const optimalLineBreakWithoutEllipsis = possibleLineBreaks.find(lineBreak => lineBreak.linesCount <= this.session.maxLines);
        if (!optimalLineBreakWithoutEllipsis) {
            return null;
        }
        return {
            prefix: optimalLineBreakWithoutEllipsis.textSpans,
            middle: [],
            suffix: [],
        };
    }
    
}
