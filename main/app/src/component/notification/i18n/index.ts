import { i18n as da } from "./pmc-component-notification-da.properties";
import { i18n as de } from "./pmc-component-notification-de.properties";
import { i18n as en } from "./pmc-component-notification-en.properties";
import { i18n as es_ES } from "./pmc-component-notification-es-ES.properties";
import { i18n as fr } from "./pmc-component-notification-fr.properties";
import { i18n as it } from "./pmc-component-notification-it.properties";
import { i18n as nl } from "./pmc-component-notification-nl.properties";
import { i18n as pl } from "./pmc-component-notification-pl.properties";
import { i18n as sv_SE } from "./pmc-component-notification-sv-SE.properties";

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
