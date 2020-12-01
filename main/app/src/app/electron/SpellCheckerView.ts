import { WebFrame } from "electron";
import { SpellCheckerCommon } from "./SpellCheckerCommon";

export class SpellCheckerView {
	static isSpellCheckerEnabled: boolean = false;
	static cache: { [key: string]: boolean } = {};
	static channelPromise: <T = void>(name: string, ...args: any[]) => Q.Promise<T>;
	
	static init(lang: string, channelPromise: <T = void>(name: string, ...args: any[]) => Q.Promise<T>): void {
		this.channelPromise = channelPromise;
		lang = SpellCheckerCommon.resolveLang(lang);
        
        const webFrame: WebFrame = (<any>window).electronRequire("electron").webFrame;
        
        (<any>webFrame.setSpellCheckProvider)(lang, <any>{
            spellCheck: (words: any, callback: any) => {
                setTimeout(() => {
                    if (!this.isSpellCheckerEnabled) {
                        callback([]);
                        return;
					}
					let misspelled: string[] = [];
					let toCheck: string[] = [];
					for (let i = 0, l = words.length; i < l; ++i) {
						let word = words[i];
						if (word in this.cache) {
							if (this.cache[word]) {
								misspelled.push(word);
							}
						}
						else {
							toCheck.push(word);
						}
					}
					if (toCheck.length > 0) {
						this.channelPromise<string>("checkSpelling", JSON.stringify(toCheck)).then(misspelledStr => {
							let misspelled2: string[] = JSON.parse(misspelledStr);
							for (let i = 0, l = misspelled2.length; i < l; ++i) {
								let word = misspelled2[i];
								misspelled.push(word);
								this.cache[word] = true;
							}
							for (let i = 0, l = toCheck.length; i < l; ++i) {
								let word = toCheck[i];
								if (misspelled2.indexOf(word) < 0) {
									this.cache[word] = false;
								}
							}
							callback(misspelled);
						});
					}
					else {
						callback(misspelled);
					}
                }, 0);
            }
        });
	}
	
	static stop(): void {
        this.isSpellCheckerEnabled = false;
	}
	
}
