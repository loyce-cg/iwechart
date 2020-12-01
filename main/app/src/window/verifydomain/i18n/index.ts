import { i18n as da } from "./pmc-window-verifydomain-da.properties";
import { i18n as de } from "./pmc-window-verifydomain-de.properties";
import { i18n as en } from "./pmc-window-verifydomain-en.properties";
import { i18n as es_ES } from "./pmc-window-verifydomain-es-ES.properties";
import { i18n as fr } from "./pmc-window-verifydomain-fr.properties";
import { i18n as it } from "./pmc-window-verifydomain-it.properties";
import { i18n as nl } from "./pmc-window-verifydomain-nl.properties";
import { i18n as pl } from "./pmc-window-verifydomain-pl.properties";
import { i18n as sv_SE } from "./pmc-window-verifydomain-sv-SE.properties";

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
