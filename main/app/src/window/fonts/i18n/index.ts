import { i18n as da } from "./pmc-window-fonts-da.properties";
import { i18n as de } from "./pmc-window-fonts-de.properties";
import { i18n as en } from "./pmc-window-fonts-en.properties";
import { i18n as es_ES } from "./pmc-window-fonts-es-ES.properties";
import { i18n as fr } from "./pmc-window-fonts-fr.properties";
import { i18n as it } from "./pmc-window-fonts-it.properties";
import { i18n as nl } from "./pmc-window-fonts-nl.properties";
import { i18n as pl } from "./pmc-window-fonts-pl.properties";
import { i18n as sv_SE } from "./pmc-window-fonts-sv-SE.properties";

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
