interface JQuery {
    pfScroll(): {
        turnOn(): void;
        turnOff(): void;
        destroy(): void;
        scrollToBottom(): void;
    };
    pfScrollExperimental(): {
        turnOn(): void;
        turnOff(): void;
        destroy(): void;
        scrollBy(deltaPosition: number): void;
        scrollTo(newPosition: number): void;
        scrollToTop(): void;
        scrollToBottom(): void;
    };
    content(): JQuery;
    content(p: JQuery): JQuery;
}

declare function escape(str: string): string;
declare function unescape(str: string): string;

// For compatibility with typescript 2.9, remove after migrate to > ts 3.0
type unknown = any;
