import { i18n as da } from "./pmc-window-admin-trusted-da.properties";
import { i18n as de } from "./pmc-window-admin-trusted-de.properties";
import { i18n as en } from "./pmc-window-admin-trusted-en.properties";
import { i18n as es_ES } from "./pmc-window-admin-trusted-es-ES.properties";
import { i18n as fr } from "./pmc-window-admin-trusted-fr.properties";
import { i18n as it } from "./pmc-window-admin-trusted-it.properties";
import { i18n as nl } from "./pmc-window-admin-trusted-nl.properties";
import { i18n as pl } from "./pmc-window-admin-trusted-pl.properties";
import { i18n as sv_SE } from "./pmc-window-admin-trusted-sv-SE.properties";

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