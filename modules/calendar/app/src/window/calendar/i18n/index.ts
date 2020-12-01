import { i18n as da } from "./calendar-window-calendar-da.properties";
import { i18n as de } from "./calendar-window-calendar-de.properties";
import { i18n as en } from "./calendar-window-calendar-en.properties";
import { i18n as es_ES } from "./calendar-window-calendar-es-ES.properties";
import { i18n as fr } from "./calendar-window-calendar-fr.properties";
import { i18n as it } from "./calendar-window-calendar-it.properties";
import { i18n as nl } from "./calendar-window-calendar-nl.properties";
import { i18n as pl } from "./calendar-window-calendar-pl.properties";
import { i18n as sv_SE } from "./calendar-window-calendar-sv-SE.properties";

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
