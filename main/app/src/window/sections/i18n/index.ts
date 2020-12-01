import { i18n as da } from "./pmc-window-sections-da.properties";
import { i18n as de } from "./pmc-window-sections-de.properties";
import { i18n as en } from "./pmc-window-sections-en.properties";
import { i18n as es_ES } from "./pmc-window-sections-es-ES.properties";
import { i18n as fr } from "./pmc-window-sections-fr.properties";
import { i18n as it } from "./pmc-window-sections-it.properties";
import { i18n as nl } from "./pmc-window-sections-nl.properties";
import { i18n as pl } from "./pmc-window-sections-pl.properties";
import { i18n as sv_SE } from "./pmc-window-sections-sv-SE.properties";

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