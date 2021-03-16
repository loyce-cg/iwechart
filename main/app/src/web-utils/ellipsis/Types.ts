import { FontMetricsView } from "../../app/common/fontMetrics/FontMetricsView";
import { TextSpan } from "./TextSpan";

export interface BreakOpportunities {
    betweenWords: number[];
    insideWords: number[];
}

export interface SingleSplitResult<T> {
    first: T;
    second: T;
}

export interface EllipsisOptions {
    wordBreak: WordBreakOptions;
}

export interface EllipsisSplitResult {
    prefix: TextSpan[];
    middle: TextSpan[];
    suffix: TextSpan[];
}

export interface LineBreak {
    textSpans: TextSpan[];
    linesCount: number;
}

export interface Session {
    fontMetrics: FontMetricsView;
    maxLines: number;
    maxLineWidth: number;
    wordBreakOptions: WordBreakOptions;
}

export interface SimpleTextSpan {
    text: string;
    textToHtml: (text: string) => string;
}

export interface WordBreakDisabledOptions {
    isEnabled: false;
}

export interface WordBreakEnabledOptions {
    isEnabled: true;
    minWordLength: number;
    minPrefixLength: number;
    minSuffixLength: number;
}

export type WordBreakOptions = WordBreakDisabledOptions | WordBreakEnabledOptions;
