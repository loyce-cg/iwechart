import { i18n as da } from "./pmc-window-sectionnew-da.properties";
import { i18n as de } from "./pmc-window-sectionnew-de.properties";
import { i18n as en } from "./pmc-window-sectionnew-en.properties";
import { i18n as es_ES } from "./pmc-window-sectionnew-es-ES.properties";
import { i18n as fr } from "./pmc-window-sectionnew-fr.properties";
import { i18n as it } from "./pmc-window-sectionnew-it.properties";
import { i18n as nl } from "./pmc-window-sectionnew-nl.properties";
import { i18n as pl } from "./pmc-window-sectionnew-pl.properties";
import { i18n as sv_SE } from "./pmc-window-sectionnew-sv-SE.properties";

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
