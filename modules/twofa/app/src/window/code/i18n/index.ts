import { i18n as da } from "./twofa-window-code-da.properties";
import { i18n as de } from "./twofa-window-code-de.properties";
import { i18n as en } from "./twofa-window-code-en.properties";
import { i18n as es_ES } from "./twofa-window-code-es-ES.properties";
import { i18n as fr } from "./twofa-window-code-fr.properties";
import { i18n as it } from "./twofa-window-code-it.properties";
import { i18n as nl } from "./twofa-window-code-nl.properties";
import { i18n as pl } from "./twofa-window-code-pl.properties";
import { i18n as sv_SE } from "./twofa-window-code-sv-SE.properties";

export type i18nLang = { [name: string]: string };
export type i18nLangs = { [lang: string]: i18nLang };

export let i18n: i18nLangs = {
    "da": da,
    "de": de,
    "en": en,
    "es-ES": es_ES,
    "fr": fr,
    "it": it,
    "nl": nl,
    "pl": pl,
    "sv-SE": sv_SE,
};
