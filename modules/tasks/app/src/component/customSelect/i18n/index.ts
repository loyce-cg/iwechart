import { i18n as da } from "./tasks-component-customSelect-da.properties";
import { i18n as de } from "./tasks-component-customSelect-de.properties";
import { i18n as en } from "./tasks-component-customSelect-en.properties";
import { i18n as es_ES } from "./tasks-component-customSelect-es-ES.properties";
import { i18n as fr } from "./tasks-component-customSelect-fr.properties";
import { i18n as it } from "./tasks-component-customSelect-it.properties";
import { i18n as nl } from "./tasks-component-customSelect-nl.properties";
import { i18n as pl } from "./tasks-component-customSelect-pl.properties";
import { i18n as sv_SE } from "./tasks-component-customSelect-sv-SE.properties";

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
