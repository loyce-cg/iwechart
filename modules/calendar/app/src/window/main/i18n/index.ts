import { i18n as da } from "./calendar-window-main-da.properties";
import { i18n as de } from "./calendar-window-main-de.properties";
import { i18n as en } from "./calendar-window-main-en.properties";
import { i18n as es_ES } from "./calendar-window-main-es-ES.properties";
import { i18n as fr } from "./calendar-window-main-fr.properties";
import { i18n as it } from "./calendar-window-main-it.properties";
import { i18n as nl } from "./calendar-window-main-nl.properties";
import { i18n as pl } from "./calendar-window-main-pl.properties";
import { i18n as sv_SE } from "./calendar-window-main-sv-SE.properties";

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
