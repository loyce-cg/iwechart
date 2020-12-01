interface JQuery {
    pfScroll(): {
        turnOn(): void;
        turnOff(): void;
        destroy(): void;
    };
    content(): JQuery;
    content(p: JQuery): JQuery;
}

declare function escape(str: string): string;
declare function unescape(str: string): string;