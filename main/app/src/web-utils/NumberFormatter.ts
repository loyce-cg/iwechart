export class NumberFormatter {
    
    static formatSimpleWithSuffix(n: number): string {
        let suffixes = ["k", "m", "g"];
        for (let i = suffixes.length - 1; i >= 0; --i) {
            let m = Math.pow(10, (i + 1) * 3);
            if (n >= m) {
                return `${Math.floor(n / m)}${suffixes[i]}`;
            }
        }
        return `${n}`;
    }
    
}
