import {Random} from "../utils/Random";

export class AvatarGenerator {
    
    random: Random;
    imageWidth: number;
    imageHeight: number;
    width: number;
    height: number;
    colCount: number;
    centerIndex: number;
    dotWidth: number;
    dotHeight: number;
    minDotsCount: number;
    htmlColor: string;
    drw: CanvasRenderingContext2D;
    data: boolean[][];
    
    constructor(options: {
        seed?: number|string,
        imageWidth?: number,
        imageHeight?: number,
        width?: number,
        height?: number,
        minDotsCount?: number,
        htmlColor?: string
    }) {
        this.random = new Random(options.seed || Math.random());
        this.imageWidth = options.imageWidth || 60;
        this.imageHeight = options.imageHeight || 60;
        this.width = options.width || 7;
        this.height = options.height || 7;
        if (this.width % 2 != 1) {
            throw new Error("Width has to be odd");
        }
        this.colCount = Math.floor(this.width / 2);
        this.centerIndex = Math.ceil(this.width / 2) - 1;
        this.dotWidth = Math.floor(this.imageWidth / this.width);
        this.dotHeight = Math.floor(this.imageHeight / this.height);
        this.minDotsCount = options.minDotsCount || 6;
        this.htmlColor = "rgb(" + (this.random.next() % 200) + "," + (this.random.next() % 200) + "," + (this.random.next() % 200) + ")";
        this.htmlColor = options.htmlColor || this.htmlColor;
        this.data = this.createData();
    }
    
    createData() {
        let data: boolean[][] = [];
        let dots = 0;
        do {
            for (let y = 0; y < this.height; y++) {
                data[y] = new Array<boolean>(this.width);
                for (let x = 0; x < this.colCount; x++) {
                    data[y][x] = data[y][this.width - 1 - x] = this.random.nextBoolean();
                    dots += data[y][x] ? 1 : 0;
                }
                data[y][this.centerIndex] = this.random.nextBoolean() && (!data[y][this.centerIndex - 1] || this.random.nextBoolean());
                dots += data[y][this.centerIndex] ? 1 : 0;
            }
        } while (dots < this.minDotsCount || data[0].indexOf(true) == -1 || data[this.centerIndex].indexOf(true) == -1);
        return data;
    }
    
    getDataUrl() {
        let element = document.createElement("canvas");
        let imageData = null;
        element.width = this.imageWidth;
        element.height = this.imageHeight;
        
        if (!element && !element.getContext) {
            throw new Error("Canvas not supported");
        }
        
        this.drw = element.getContext("2d");
        this.drw.fillStyle = this.htmlColor;
        
        for (let y = 0; y < this.data.length; y++) {
            for (let x = 0; x < this.data[y].length; x++) {
                if (this.data[y][x] === true) {
                    this.drw.fillRect(x * this.dotWidth, y * this.dotHeight, this.dotWidth, this.dotHeight);
                }
            }
        }
        
        imageData = element.toDataURL();
        
        element = null;
        return imageData;
    }
}