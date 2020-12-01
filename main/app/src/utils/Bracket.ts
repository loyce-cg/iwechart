export class Bracket {
    
    static Curly = 1;
    static Angle = 2;
    static Lenticular = 3;
    
    constructor() {
    }
    
    static getChars(type: number): {open: string, close: string} {
        if (!type || type == Bracket.Curly) {
            return {
                open: "(",
                close: ")"
            };
        }
        if (type == Bracket.Angle) {
            return {
                open: "<",
                close: ">"
            };
        }
        if (type == Bracket.Lenticular) {
            return {
                open: "[",
                close: "]"
            };
        }
    }
}

