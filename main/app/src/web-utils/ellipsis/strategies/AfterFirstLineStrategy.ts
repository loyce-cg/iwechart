import { LineBreaker } from "../LineBreaker";
import { TextSpan } from "../TextSpan";
import { EllipsisSplitResult } from "../Types";
import { EllipsisStrategy } from "./EllipsisStrategy";

export class AfterFirstLineStrategy extends EllipsisStrategy {
    
    performEllipsisSplit(textSpans: TextSpan[]): EllipsisSplitResult {
        let prefix: TextSpan[];
        let middle: TextSpan[];
        let suffix: TextSpan[];
        
        const firstSplitResult = this.splitByTextWidth(textSpans, this.getMaxLineWidthWithoutEllipsis());
        prefix = firstSplitResult.first;
        
        const lineBreaker = new LineBreaker(TextSpan.reverseTextSpans(firstSplitResult.second), this.session.maxLineWidth);
        const textSpansWithLinesWithoutFirstLine = lineBreaker.breakIntoLines(true).textSpans;
        const secondSplitResult = this.splitByLinesCount(textSpansWithLinesWithoutFirstLine, this.session.maxLines - 1);
        middle = TextSpan.reverseTextSpans(secondSplitResult.second);
        suffix = TextSpan.reverseTextSpans(secondSplitResult.first);
        
        return {
            prefix: prefix,
            middle: middle,
            suffix: suffix,
        };
    }
    
}
