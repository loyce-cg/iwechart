import { TextSpan } from "./TextSpan";
import { LineBreak } from "./Types";

export class LineBreaker {
    
    constructor(private textSpans: TextSpan[], private maxLineWidth: number) {
        
    }
    
    breakIntoLines(allowBreakInsideWords: boolean): LineBreak {
        let newTextSpans: TextSpan[] = [];
        let takenLineWidth: number = 0;
        let linesCount: number = 1;
        for (let textPartIndex = 0; textPartIndex < this.textSpans.length; ++textPartIndex) {
            const textSpan = this.textSpans[textPartIndex];
            const text = textSpan.getText();
            const charWidths = textSpan.getCharWidths();
            const breakOpportunities: number[] = textSpan.getBreakOpportunitiesIndexes(allowBreakInsideWords);
            let lastBreakOpportunity: number = textPartIndex > 0 ? 0 : -1;
            let newText: string = "";
            for (let i = 0; i < text.length; ++i) {
                if (breakOpportunities.includes(i)) {
                    lastBreakOpportunity = i;
                }
                let char = text[i];
                let charWidth = charWidths[i];
                if (takenLineWidth + charWidth > this.maxLineWidth) {
                    if (lastBreakOpportunity == i || lastBreakOpportunity < 0) {
                        newText += "\n";
                        newTextSpans.push(textSpan.cloneWithNewText(newText));
                        newText = "";
                    }
                    else if (lastBreakOpportunity == 0) {
                        const previousTextSpan = newTextSpans[newTextSpans.length - 1];
                        newTextSpans[newTextSpans.length - 1] = previousTextSpan.cloneWithNewText(previousTextSpan.getText() + "\n");
                    }
                    else {
                        const x = newText.length - (i - lastBreakOpportunity);
                        newText = newText.substr(0, x) + "\n";
                        newTextSpans.push(textSpan.cloneWithNewText(newText));
                        newText = "";
                        i = lastBreakOpportunity;
                        char = text[i];
                        charWidth = charWidths[i];
                    }
                    linesCount++;
                    takenLineWidth = 0;
                    lastBreakOpportunity = -1;
                }
                takenLineWidth += charWidth;
                newText += char;
            }
            if (newText.length > 0) {
                newTextSpans.push(textSpan.cloneWithNewText(newText));
                newText = "";
            }
        }
        return {
            linesCount: linesCount,
            textSpans: newTextSpans,
        };
    }
    
}
