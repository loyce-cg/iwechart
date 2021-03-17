import { BreakOpportunities, Session, SimpleTextSpan } from "./Types";

interface WordPosition {
    start: number;
    length: number;
}

export class TextSpan {
    
    static reverseTextSpans(textSpans: TextSpan[]): TextSpan[] {
        return textSpans
            .slice()
            .reverse()
            .map(textSpan => textSpan.cloneReversed());
    }
    
    
    
    
    
    private simpleTextSpan: SimpleTextSpan;
    private session: Session;
    private breakOpportunities: BreakOpportunities;
    private charWidths: number[];
    private wordPositions: WordPosition[];
    
    constructor(simpleTextSpan: SimpleTextSpan, session: Session) {
        this.simpleTextSpan = simpleTextSpan;
        this.session = session;
        this.computeTextCharacteristics();
    }
    
    getHtml(): string {
        return this.simpleTextSpan.textToHtml(this.simpleTextSpan.text);
    }
    
    getText(): string {
        return this.simpleTextSpan.text;
    }
    
    getCharWidths(): number[] {
        return [...this.charWidths];
    }
    
    getBreakOpportunitiesIndexes(allowBreakInsideWords: boolean): number[] {
        if (allowBreakInsideWords) {
            const breakOpportunitiesIndexes = [
                ...this.breakOpportunities.betweenWords,
                ...this.breakOpportunities.insideWords,
            ];
            return breakOpportunitiesIndexes.sort();
        }
        else {
            return [...this.breakOpportunities.betweenWords];
        }
    }
    
    cloneWithNewText(newText: string): TextSpan {
        const newTextSpan: SimpleTextSpan = {
            text: newText,
            textToHtml: this.simpleTextSpan.textToHtml,
        };
        return new TextSpan(newTextSpan, this.session);
    }
    
    cloneReversed(): TextSpan {
        const newTextSpan: SimpleTextSpan = {
            text: this.simpleTextSpan.text.split("").reverse().join(""),
            textToHtml: this.simpleTextSpan.textToHtml,
        };
        return new TextSpan(newTextSpan, this.session);
    }
    
    setText(text: string): void {
        this.simpleTextSpan.text = text;
        this.computeTextCharacteristics();
    }
    
    private computeTextCharacteristics(): void {
        this.computeCharWidths();
        this.computeWordPositions();
        this.computeBreakOpportunities();
    }
    
    private computeCharWidths(): void {
        this.charWidths = this.simpleTextSpan.text
            .split("")
            .map(char => this.session.fontMetrics.getCharWidth(char));
    }
    
    private computeWordPositions(): void {
        const wordPositions: WordPosition[] = [];
        const text: string = this.simpleTextSpan.text;
        let currentWordLength: number = 0;
        for (let i = 0; i < text.length; ++i) {
            const char = text[i];
            if (this.isWhitespace(char)) {
                wordPositions.push({
                    start: i - currentWordLength,
                    length: currentWordLength,
                });
                currentWordLength = 0;
            }
            else {
                currentWordLength++;
            }
        }
        if (currentWordLength > 0) {
            wordPositions.push({
                start: text.length - currentWordLength,
                length: currentWordLength,
            });
        }
        this.wordPositions = wordPositions;
    }
    
    private computeBreakOpportunities(): void {
        this.breakOpportunities = {
            betweenWords: this.computeAndGetBreakOpportunitiesBetweenWords(),
            insideWords: this.computeAndGetBreakOpportunitiesInsideWords(),
        };
    }
    
    private isWhitespace(char: string): boolean {
        return char.trim().length == 0;
    }
    
    private computeAndGetBreakOpportunitiesBetweenWords(): number[] {
        return this.wordPositions
            .map(wordPosition => wordPosition.start)
            .filter(wordStartIndex => wordStartIndex > 0);
    }
    
    private computeAndGetBreakOpportunitiesInsideWords(): number[] {
        if (!this.session.wordBreakOptions.isEnabled) {
            return;
        }
        const minWordLength: number = this.session.wordBreakOptions.minWordLength;
        const minPrefixLength: number = this.session.wordBreakOptions.minPrefixLength;
        const minSuffixLength: number = this.session.wordBreakOptions.minSuffixLength;
        return this.wordPositions
            .filter(wordPosition => wordPosition.length >= minWordLength)
            .map(wordPosition => {
                const maxPrefixLength = wordPosition.length - minSuffixLength;
                const wordBreakOpportunities: number[] = [];
                for (let i = minPrefixLength; i <= maxPrefixLength; ++i) {
                    wordBreakOpportunities.push(wordPosition.start + i);
                }
                return wordBreakOpportunities;
            })
            .reduce((previousValue, currentValue) => [...previousValue, ...currentValue], []);
    }
    
}
