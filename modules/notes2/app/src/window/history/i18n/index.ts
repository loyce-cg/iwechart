import { i18n as da } from "./notes2-window-history-da.properties";
import { i18n as de } from "./notes2-window-history-de.properties";
import { i18n as en } from "./notes2-window-history-en.properties";
import { i18n as es_ES } from "./notes2-window-history-es-ES.properties";
import { i18n as fr } from "./notes2-window-history-fr.properties";
import { i18n as it } from "./notes2-window-history-it.properties";
import { i18n as nl } from "./notes2-window-history-nl.properties";
import { i18n as pl } from "./notes2-window-history-pl.properties";
import { i18n as sv_SE } from "./notes2-window-history-sv-SE.properties";

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
