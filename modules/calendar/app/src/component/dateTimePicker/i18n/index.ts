import { i18n as da } from "./calendar-component-dateTimePicker-da.properties";
import { i18n as de } from "./calendar-component-dateTimePicker-de.properties";
import { i18n as en } from "./calendar-component-dateTimePicker-en.properties";
import { i18n as es_ES } from "./calendar-component-dateTimePicker-es-ES.properties";
import { i18n as fr } from "./calendar-component-dateTimePicker-fr.properties";
import { i18n as it } from "./calendar-component-dateTimePicker-it.properties";
import { i18n as nl } from "./calendar-component-dateTimePicker-nl.properties";
import { i18n as pl } from "./calendar-component-dateTimePicker-pl.properties";
import { i18n as sv_SE } from "./calendar-component-dateTimePicker-sv-SE.properties";

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
