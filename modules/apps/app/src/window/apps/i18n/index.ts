import { i18n as da } from "./apps-window-apps-da.properties";
import { i18n as de } from "./apps-window-apps-de.properties";
import { i18n as en } from "./apps-window-apps-en.properties";
import { i18n as es_ES } from "./apps-window-apps-es-ES.properties";
import { i18n as fr } from "./apps-window-apps-fr.properties";
import { i18n as it } from "./apps-window-apps-it.properties";
import { i18n as nl } from "./apps-window-apps-nl.properties";
import { i18n as pl } from "./apps-window-apps-pl.properties";
import { i18n as sv_SE } from "./apps-window-apps-sv-SE.properties";

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
