import { i18n as da } from "./pmc-window-admin-logins-da.properties";
import { i18n as de } from "./pmc-window-admin-logins-de.properties";
import { i18n as en } from "./pmc-window-admin-logins-en.properties";
import { i18n as es_ES } from "./pmc-window-admin-logins-es-ES.properties";
import { i18n as fr } from "./pmc-window-admin-logins-fr.properties";
import { i18n as it } from "./pmc-window-admin-logins-it.properties";
import { i18n as nl } from "./pmc-window-admin-logins-nl.properties";
import { i18n as pl } from "./pmc-window-admin-logins-pl.properties";
import { i18n as sv_SE } from "./pmc-window-admin-logins-sv-SE.properties";

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
