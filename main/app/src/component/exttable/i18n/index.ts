import { i18n as da } from "./pmc-component-exttable-da.properties";
import { i18n as de } from "./pmc-component-exttable-de.properties";
import { i18n as en } from "./pmc-component-exttable-en.properties";
import { i18n as es_ES } from "./pmc-component-exttable-es-ES.properties";
import { i18n as fr } from "./pmc-component-exttable-fr.properties";
import { i18n as it } from "./pmc-component-exttable-it.properties";
import { i18n as nl } from "./pmc-component-exttable-nl.properties";
import { i18n as pl } from "./pmc-component-exttable-pl.properties";
import { i18n as sv_SE } from "./pmc-component-exttable-sv-SE.properties";

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
