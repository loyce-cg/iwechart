export class SpellCheckerCommon {
	
	static resolveLang(lang: string): string {
        let langs: { [key: string]: string } = {
            "en": "en-US",
            "pl": "pl-PL",
        };
        if (lang in langs) {
            lang = langs[lang];
        }
        else {
			let langsArr = [];
			for (let k in langs) {
				langsArr.push(langs[k]);
			}
			if (langsArr.indexOf(lang) < 0) {
				lang = "en-US";
			}
		}
		return lang;
	}
	
}
