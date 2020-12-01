import {Crc32} from "./Crc32";

export class Random {
    
    static MAGIC = 16807;
    static TWO_31 = 2147483646;
    
    seed: number;
    
    constructor(seed: number|string) {
        this.seed = (typeof(seed) == "number" ? seed : Crc32.crc32(seed)) % Random.TWO_31;
        if (this.seed <= 0) {
            this.seed += Random.TWO_31;
        }
    }
    
    next() {
        return this.seed = this.seed * Random.MAGIC % Random.TWO_31;
    }
    
    nextBoolean() {
        return this.nextFloat() < 0.5;
    }
    
    nextFloat() {
        return (this.next() - 1) / Random.TWO_31;
    }
}