import * as Types from "../../Types";
export class StickersList {
    static stickersCompat: string[] = ["1f600", "1f606", "1f604", "1f44c", "1f91e", "1f44d", "1f44e", "1f44f", "1f91d"];
    static stickersCompat2: string[] = [
        'ok1',
        'nieok1',
        'brawo1',
        'machanie1',
        'cacuszko1',
        'victory',
        
        'devil1',
        'devil2',
        'kciuki1',
        'uscisk1',
        'spocksalut1',
        'damyrade1',
        
        'ave1',
        'nadloniach1',
        'avelapka1',
        'call1',
        'fuck',
        'muskuly1',
        
        'pisze1',
        'wskazujacy1',
        'wskazujewbok1',
        'wskazujewbok2',
        'zolwik1',
        'zolwik2',

        'smile1',
        'smuta1',
        'przymroz1',
        'przymrozsmiech1',
        
        'ooo1',
        'wniebie1',
        'dolar',
        'lezka1',
        'lovitserce1',
        
        'okularnik chil1',
        'okularnik1',
        'wtf1',
        'wrrr1',
        'zgon1',        
    ];
    static stickersCompat3 = [
        'plus1',
        'minus1',
        'amen',
        'beka',
        'fajnoooo',
        'hmmmm',
        'facepalm',
        'nazimno'
    ];
    static stickersCompat4 = [
        'blush1',
    ];

    static get(group?: "hands" | "faces"): string[] {
        if (group && group == "hands") {
            return [
                'ok1', //1
                'cacuszko1', // 2
                'uscisk1', //3
                'muskuly1', //4
                'brawo1', // 5
                'ave1', // 6
                'kciuki1', //7
                'victory', //8
                'devil2', // 9
                'nieok1', //10
                'fuck', //11
                'amen',// 12

            ]
        }
        else if (group && group == "faces") {
            return [
                'fajnoooo', //1
                'smile1', //2
                'nazimno', //3
                'smuta1', //4
                'lezka1', //5
                'ooo1', //6
                'przymroz1', //7
                'lovitserce1', //8
                'zgon1', //9
                'beka',// 10
                'hmmmm',// 11
                'facepalm',
                'blush1', //12
                'plus1', //13
                'minus1',//14

            ]
        }

        // all
        return StickersList.stickersCompat.concat(StickersList.stickersCompat2).concat(StickersList.stickersCompat3).concat(StickersList.stickersCompat4);
    }
}