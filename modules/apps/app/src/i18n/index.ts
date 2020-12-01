import { i18n as da } from "./apps-common-da.properties";
import { i18n as de } from "./apps-common-de.properties";
import { i18n as en } from "./apps-common-en.properties";
import { i18n as es_ES } from "./apps-common-es-ES.properties";
import { i18n as fr } from "./apps-common-fr.properties";
import { i18n as it } from "./apps-common-it.properties";
import { i18n as nl } from "./apps-common-nl.properties";
import { i18n as pl } from "./apps-common-pl.properties";
import { i18n as sv_SE } from "./apps-common-sv-SE.properties";

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
