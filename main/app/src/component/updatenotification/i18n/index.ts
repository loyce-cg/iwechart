import { i18n as da } from "./pmc-component-updatenotification-da.properties";
import { i18n as de } from "./pmc-component-updatenotification-de.properties";
import { i18n as en } from "./pmc-component-updatenotification-en.properties";
import { i18n as es_ES } from "./pmc-component-updatenotification-es-ES.properties";
import { i18n as fr } from "./pmc-component-updatenotification-fr.properties";
import { i18n as it } from "./pmc-component-updatenotification-it.properties";
import { i18n as nl } from "./pmc-component-updatenotification-nl.properties";
import { i18n as pl } from "./pmc-component-updatenotification-pl.properties";
import { i18n as sv_SE } from "./pmc-component-updatenotification-sv-SE.properties";

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
