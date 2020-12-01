import { i18n as da } from "./tasks-common-da.properties";
import { i18n as de } from "./tasks-common-de.properties";
import { i18n as en } from "./tasks-common-en.properties";
import { i18n as es_ES } from "./tasks-common-es-ES.properties";
import { i18n as fr } from "./tasks-common-fr.properties";
import { i18n as it } from "./tasks-common-it.properties";
import { i18n as nl } from "./tasks-common-nl.properties";
import { i18n as pl } from "./tasks-common-pl.properties";
import { i18n as sv_SE } from "./tasks-common-sv-SE.properties";

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
