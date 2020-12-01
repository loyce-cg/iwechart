import { PlayerPosition } from "./OpusAudio";

export class PositionCalculator {
    
    static getPositionByIndex(min: number, max: number, index: number, length: number): PlayerPosition {
        return PositionCalculator.getPositionByAngle(PositionCalculator.getValueForIndex(min, max, index, length));
    }
    
    static getValueForIndex(min: number, max: number, index: number, length: number) {
        let range = max - min;
        let step = range / (length + 1);
        return min + step * (index + 1);
    }
    
    static getPositionByAngle(angle: number): PlayerPosition {
        let cos = Math.cos(angle * Math.PI / 180);
        let c = 1;
        let b = cos * c;
        let a = Math.sqrt(c * c - b * b);
        return {x: Math.sign(angle) * a, y: b, z: 1};
    }
}