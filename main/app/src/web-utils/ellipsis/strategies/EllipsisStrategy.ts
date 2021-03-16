import { TextSpan } from "../TextSpan";
import { EllipsisSplitResult, Session, SingleSplitResult } from "../Types";

export abstract class EllipsisStrategy {
    
    constructor(protected session: Session) {
    }
    
    abstract performEllipsisSplit(textSpans: TextSpan[]): EllipsisSplitResult | null;
    
    protected getMaxLineWidthWithoutEllipsis(): number {
        const ellipsisWidth = this.session.fontMetrics.getCharWidth("…");
        return this.session.maxLineWidth - ellipsisWidth;
    }
    
    protected splitByLinesCount(textSpans: TextSpan[], linesCountLimit: number): SingleSplitResult<TextSpan[]> {
        const first: TextSpan[] = [];
        const second: TextSpan[] = [];
        let currLine: number = 1;
        for (let textSpan of textSpans) {
            if (currLine <= linesCountLimit) {
                first.push(textSpan);
                if (textSpan.getText().endsWith("\n")) {
                    currLine++;
                }
            }
            else {
                second.push(textSpan);
            }
        }
        return { first, second };
    }
    
    protected splitByTextWidth(textSpans: TextSpan[], widthLimit: number): SingleSplitResult<TextSpan[]> {
        const first: TextSpan[] = [];
        const second: TextSpan[] = [];
        let takenWidth: number = 0;
        let inSecondPart: boolean = false;
        for (let textSpan of textSpans) {
            if (inSecondPart) {
                second.push(textSpan);
                continue;
            }
            const text = textSpan.getText();
            const charWidths = textSpan.getCharWidths();
            for (let i = 0; i < text.length; ++i) {
                const charWidth = charWidths[i];
                if (takenWidth + charWidth > widthLimit) {
                    if (i == 0) {
                        second.push(textSpan);
                    }
                    else {
                        const firstText = text.substr(0, i);
                        const secondText = text.substr(i);
                        const firstTextSpan: TextSpan = textSpan.cloneWithNewText(firstText);
                        const secondTextPart: TextSpan = textSpan.cloneWithNewText(secondText);
                        first.push(firstTextSpan);
                        second.push(secondTextPart);
                    }
                    inSecondPart = true;
                    takenWidth = 0;
                    break;
                }
                else {
                    takenWidth += charWidth;
                }
            }
            if (takenWidth > 0) {
                first.push(textSpan);
            }
        }
        return { first, second };
    }
    
}
