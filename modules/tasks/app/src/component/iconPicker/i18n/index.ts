import { i18n as da } from "./tasks-component-iconPicker-da.properties";
import { i18n as de } from "./tasks-component-iconPicker-de.properties";
import { i18n as en } from "./tasks-component-iconPicker-en.properties";
import { i18n as es_ES } from "./tasks-component-iconPicker-es-ES.properties";
import { i18n as fr } from "./tasks-component-iconPicker-fr.properties";
import { i18n as it } from "./tasks-component-iconPicker-it.properties";
import { i18n as nl } from "./tasks-component-iconPicker-nl.properties";
import { i18n as pl } from "./tasks-component-iconPicker-pl.properties";
import { i18n as sv_SE } from "./tasks-component-iconPicker-sv-SE.properties";

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
