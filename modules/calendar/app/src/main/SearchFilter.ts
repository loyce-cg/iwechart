export class SearchFilter {
    
    static prepareString(str: string): string {
        return str
            .toLocaleLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ł/g, "l");
    }
    
    static prepareHaystack(haystack: string): string {
        return this.prepareString(haystack);
    }
    
    static prepareNeedle(needle: string): string {
        return this.prepareString(needle);
    }
    
    static matches(preparedNeedle: string, haystack: string): boolean {
        let preparedHaystack = this.prepareString(haystack);
        return preparedHaystack.indexOf(preparedNeedle) >= 0;
    }
    
}
