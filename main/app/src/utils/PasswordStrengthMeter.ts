import {ExternalLibs, zxcvbn} from "../web-utils/ExternalLibs";
import {LocaleService} from "../mail/LocaleService";

export class PasswordStrengthMeter {
    
    localeService: LocaleService;
    zxcvbn: zxcvbn;
    
    constructor(localeService: LocaleService) {
        this.localeService = localeService;
        this.zxcvbn = ExternalLibs.getZxcvbn();
    }
    
    check(password: string): {score: number, scoreText: string, suggestions: string|string[], warning: string|string[]} {
        let result = this.zxcvbn(password);
        return {
            score: result.score,
            scoreText: this.translateScoreText(result.score),
            suggestions: this.translateFeedback(result.feedback.suggestions),
            warning: this.translateFeedback(result.feedback.warning)
        };
    }
    
    translateFeedback(feedback: string|string[]): string|string[] {
        let translate = (text: string): string => {
            if (TranslationMap[text]) {
                return this.localeService.i18n(TranslationMap[text]);
            }
            return text;
        };
        if (feedback) {
            if (Array.isArray(feedback)) {
                return feedback.map(translate);
            }
            return translate(feedback);
        }
        return null;
    }
    
    translateScoreText(score: number): string {
        return this.localeService.i18n("passwordStrengthMeter.score." + score + ".text");
    }
}
let TranslationMap: {[name: string]: string} = {
    "Use a few words, avoid common phrases": "passwordStrengthMeter.feedback.useFewWordsAvoidCommonPhrases",
    "No need for symbols, digits, or uppercase letters": "passwordStrengthMeter.feedback.noNeedForSymbolsDigitsOrUppercaseLetters",
    "Add another word or two. Uncommon words are better.": "passwordStrengthMeter.feedback.addAnotherWordOrTwo",
    "Straight rows of keys are easy to guess": "passwordStrengthMeter.feedback.straightRowsOfKeysAreEasyToGuess",
    "Short keyboard patterns are easy to guess": "passwordStrengthMeter.feedback.shortKeyboardPatternsAreEasyToGuess",
    "Use a longer keyboard pattern with more turns": "passwordStrengthMeter.feedback.useLongerKeyboardPatternWithMoreTurns",
    "Repeats like \"aaa\" are easy to guess": "passwordStrengthMeter.feedback.repeatsLikeAaaAreEasyToGuess",
    "Repeats like \"abcabcabc\" are only slightly harder to guess than \"abc\"": "passwordStrengthMeter.feedback.repeatsLikeAbcAbcAbcAreSlightlyHarderThanAbc",
    "Avoid repeated words and characters": "passwordStrengthMeter.feedback.avoidRepeatedWordsAndCharacters",
    "Sequences like abc or 6543 are easy to guess": "passwordStrengthMeter.feedback.sequencesLikeAbcOr6543AreEasyToGuess",
    "Avoid sequences": "passwordStrengthMeter.feedback.avoidSequences",
    "Recent years are easy to guess": "passwordStrengthMeter.feedback.recentYearsAreEasyToGuess",
    "Avoid recent years": "passwordStrengthMeter.feedback.avoidRecentYears",
    "Avoid years that are associated with you": "passwordStrengthMeter.feedback.avoidYearsAssociated",
    "Dates are often easy to guess": "passwordStrengthMeter.feedback.datesAreOftenEasyToGuess",
    "Avoid dates and years that are associated with you": "passwordStrengthMeter.feedback.avoidDatesAndYears",
    "This is a top-10 common password": "passwordStrengthMeter.feedback.top10",
    "This is a top-100 common password": "passwordStrengthMeter.feedback.top100",
    "This is a very common password": "passwordStrengthMeter.feedback.veryCommon",
    "This is similar to a commonly used password": "passwordStrengthMeter.feedback.similarToCommon",
    "A word by itself is easy to guess": "passwordStrengthMeter.feedback.easyItself",
    "Names and surnames by themselves are easy to guess": "passwordStrengthMeter.feedback.namesAreEasy",
    "Common names and surnames are easy to guess": "passwordStrengthMeter.feedback.commonNamesAreEasy",
    "Capitalization doesn't help very much": "passwordStrengthMeter.feedback.capitalizationWeak",
    "All-uppercase is almost as easy to guess as all-lowercase": "passwordStrengthMeter.feedback.allUpercaseWeak",
    "Reversed words aren't much harder to guess": "passwordStrengthMeter.feedback.reversedWordsWeak",
    "Predictable substitutions like '@' instead of 'a' don't help very much": "passwordStrengthMeter.feedback.predictableSubstitutions"
};
