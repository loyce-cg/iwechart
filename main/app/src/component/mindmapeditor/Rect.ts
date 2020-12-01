export class Rect {
    
    constructor(public x0: number, public y0: number, public width: number, public height: number) {
    }
    
    get x1(): number {
        return this.x0 + this.width;
    }
    
    get y1(): number {
        return this.y0 + this.height;
    }
    
    clone(): Rect {
        return new Rect(this.x0, this.y0, this.width, this.height);
    }
    
    equals(r: Rect): boolean {
        return r.x0 == this.x0 && r.y0 == this.y0 && r.width == this.width && r.height == this.height;
    }
    
}
