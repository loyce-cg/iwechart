export class UniqueId {

    static usedIds: string[] = [];
    
    static next(): string {
        let n = 1000;
        while (n-- > 0) {
            let id = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
            if (this.usedIds.indexOf(id) < 0) {
                this.usedIds.push(id);
                return id;
            }
        }
    }
    
}
