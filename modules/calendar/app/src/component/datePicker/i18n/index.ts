import { i18n as da } from "./calendar-component-datePicker-da.properties";
import { i18n as de } from "./calendar-component-datePicker-de.properties";
import { i18n as en } from "./calendar-component-datePicker-en.properties";
import { i18n as es_ES } from "./calendar-component-datePicker-es-ES.properties";
import { i18n as fr } from "./calendar-component-datePicker-fr.properties";
import { i18n as it } from "./calendar-component-datePicker-it.properties";
import { i18n as nl } from "./calendar-component-datePicker-nl.properties";
import { i18n as pl } from "./calendar-component-datePicker-pl.properties";
import { i18n as sv_SE } from "./calendar-component-datePicker-sv-SE.properties";

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
