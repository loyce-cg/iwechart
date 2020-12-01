import { i18n as da } from "./editor-common-da.properties";
import { i18n as de } from "./editor-common-de.properties";
import { i18n as en } from "./editor-common-en.properties";
import { i18n as es_ES } from "./editor-common-es-ES.properties";
import { i18n as fr } from "./editor-common-fr.properties";
import { i18n as it } from "./editor-common-it.properties";
import { i18n as nl } from "./editor-common-nl.properties";
import { i18n as pl } from "./editor-common-pl.properties";
import { i18n as sv_SE } from "./editor-common-sv-SE.properties";

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
