import { i18n as da } from "./tasks-window-main-da.properties";
import { i18n as de } from "./tasks-window-main-de.properties";
import { i18n as en } from "./tasks-window-main-en.properties";
import { i18n as es_ES } from "./tasks-window-main-es-ES.properties";
import { i18n as fr } from "./tasks-window-main-fr.properties";
import { i18n as it } from "./tasks-window-main-it.properties";
import { i18n as nl } from "./tasks-window-main-nl.properties";
import { i18n as pl } from "./tasks-window-main-pl.properties";
import { i18n as sv_SE } from "./tasks-window-main-sv-SE.properties";

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
