import { WebFrame } from "electron";
import { SpellCheckerCommon } from "./SpellCheckerCommon";

export class SpellCheckerController {
	static initialized: boolean = false;
	static spellchecker: any;
	static currentLang: string;
	
	static init(lang: string, platform: string): void {
		if (this.initialized && lang == this.currentLang) {
			return;
		}
		this.currentLang = lang;
		this.initialized = true;
		
		let frequire = require;
        this.spellchecker = frequire("spellchecker");
		let path = this.spellchecker.getDictionaryPath();
		path = path.replace("node_modules/spellchecker/vendor/hunspell_dictionaries", "dist/dictionaries");
		if (platform == "linux" && path.indexOf("/app.asar/") >= 0) {
			path = this.fixLinuxAsar(path);
		}
		else if (platform == "linux") {
			const fs = require("fs");
			if (!fs.existsSync(path)) {
				path = path.replace("/dist/", "/src/");
			}
		}
		lang = SpellCheckerCommon.resolveLang(lang);
		this.spellchecker.setDictionary(lang, path);
	}
	
	static fixLinuxAsar(path: string): string {
		const fs = require("fs");
		path = path.replace("/app/dist/", "/dist/");
		let from = path;
		let to = path.replace("/app.asar/dist/dictionaries", "/app.asar.unpacked/dist/dictionaries");
		if (fs.existsSync(from) && !fs.existsSync(to)) {
			let [basePath, toSplit] = to.split("/app.asar.unpacked/");
			basePath += "/app.asar.unpacked";
			if (!fs.existsSync(basePath)) {
				fs.mkdirSync(basePath);
			}
			for (let s of toSplit.split("/")) {
				basePath += "/" + s;
				if (!fs.existsSync(basePath)) {
					fs.mkdirSync(basePath);
				}
			}
			let files = fs.readdirSync(from);
			for (let f of files) {
				fs.copyFileSync(from + "/" + f, to + "/" + f);
			}
		}
		
		if (fs.existsSync(to)) {
			path = to;
		}
		
		return path;
	}
	
	static isMisspelled(word: string): boolean {
		return this.spellchecker.isMisspelled(word);
	}
	
}
