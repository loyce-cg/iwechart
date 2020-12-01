import { i18n as da } from "./pmc-window-helper-da.properties";
import { i18n as de } from "./pmc-window-helper-de.properties";
import { i18n as en } from "./pmc-window-helper-en.properties";
import { i18n as es_ES } from "./pmc-window-helper-es-ES.properties";
import { i18n as fr } from "./pmc-window-helper-fr.properties";
import { i18n as it } from "./pmc-window-helper-it.properties";
import { i18n as nl } from "./pmc-window-helper-nl.properties";
import { i18n as pl } from "./pmc-window-helper-pl.properties";
import { i18n as sv_SE } from "./pmc-window-helper-sv-SE.properties";

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
